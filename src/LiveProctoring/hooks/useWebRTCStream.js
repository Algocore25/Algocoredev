import { useEffect, useRef, useCallback, useState } from 'react';
import { ref, set, onValue, remove, push, off } from 'firebase/database';
import { database } from '../../firebase';

/**
 * Custom hook for WebRTC streaming
 * Used by students to broadcast their camera/audio to admins
 */
export const useWebRTCStream = (testid, userId, localStream, isActive = false) => {
  const peerConnectionsRef = useRef(new Map());
  const signalListenersRef = useRef([]);
  const processedSignalsRef = useRef(new Set());
  const [streamStatus, setStreamStatus] = useState('inactive');

  // WebRTC configuration with public STUN servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  // Create a peer connection for a specific admin
  const createPeerConnection = useCallback((adminId) => {
    if (!localStream) return null;

    // Close existing connection for this admin if any
    const existingPc = peerConnectionsRef.current.get(adminId);
    if (existingPc) {
      existingPc.close();
      peerConnectionsRef.current.delete(adminId);
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks to the connection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateRef = ref(
          database,
          `LiveStreams/${testid}/${userId}/candidates/${adminId}/${Date.now()}`
        );
        set(candidateRef, {
          candidate: event.candidate.toJSON(),
          timestamp: Date.now(),
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${adminId}: ${peerConnection.connectionState}`);
      
      if (peerConnection.connectionState === 'connected') {
        setStreamStatus('streaming');
      } else if (peerConnection.connectionState === 'failed') {
        console.log(`Connection failed with ${adminId}, cleaning up`);
        peerConnection.close();
        peerConnectionsRef.current.delete(adminId);
        setStreamStatus('error');
      } else if (peerConnection.connectionState === 'disconnected') {
        console.log(`Connection disconnected with ${adminId}`);
        setStreamStatus('disconnected');
      }
    };

    peerConnectionsRef.current.set(adminId, peerConnection);
    return peerConnection;
  }, [localStream, testid, userId, rtcConfig]);

  // Handle incoming signaling messages from admins
  const handleSignaling = useCallback(async () => {
    if (!testid || !userId || !isActive) return;

    const signalingRef = ref(database, `LiveStreams/${testid}/${userId}/signaling`);
    
    const unsubscribe = onValue(signalingRef, async (snapshot) => {
      const signaling = snapshot.val();
      if (!signaling) return;

      for (const [adminId, data] of Object.entries(signaling)) {
        const signalKey = `${adminId}-${data.type}-${data.timestamp}`;
        
        // Skip if already processed
        if (processedSignalsRef.current.has(signalKey)) {
          continue;
        }
        processedSignalsRef.current.add(signalKey);

        if (data.type === 'request-offer') {
          // Admin is requesting a stream
          let pc = peerConnectionsRef.current.get(adminId);
          if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            pc = createPeerConnection(adminId);
          }

          if (pc && pc.signalingState === 'stable') {
            try {
              const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
              });
              await pc.setLocalDescription(offer);

              // Send offer to admin
              const offerRef = ref(database, `LiveStreams/${testid}/${userId}/offers/${adminId}`);
              await set(offerRef, {
                offer: {
                  type: offer.type,
                  sdp: offer.sdp,
                },
                timestamp: Date.now(),
              });

              // Remove the request
              await remove(ref(database, `LiveStreams/${testid}/${userId}/signaling/${adminId}`));
            } catch (error) {
              console.error('Error creating offer:', error);
            }
          }
        } else if (data.type === 'answer') {
          // Admin sent an answer
          const pc = peerConnectionsRef.current.get(adminId);
          if (pc && data.answer && pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              // Remove the answer
              await remove(ref(database, `LiveStreams/${testid}/${userId}/signaling/${adminId}`));
            } catch (error) {
              console.error('Error setting remote description:', error);
            }
          }
        }
      }
    });

    signalListenersRef.current.push(unsubscribe);
  }, [testid, userId, isActive, createPeerConnection]);

  // Listen for ICE candidates from admins
  const handleAdminCandidates = useCallback(() => {
    if (!testid || !userId || !isActive) return;

    const candidatesRef = ref(database, `LiveStreams/${testid}/${userId}/adminCandidates`);
    
    const unsubscribe = onValue(candidatesRef, async (snapshot) => {
      const adminCandidates = snapshot.val();
      if (!adminCandidates) return;

      for (const [adminId, candidates] of Object.entries(adminCandidates)) {
        const pc = peerConnectionsRef.current.get(adminId);
        if (pc && pc.remoteDescription) {
          for (const candidate of Object.values(candidates)) {
            if (candidate.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate.candidate));
              } catch (err) {
                // Ignore candidate errors if connection is already established
                if (pc.connectionState !== 'connected') {
                  console.error('Error adding ICE candidate:', err);
                }
              }
            }
          }
        }
      }
    });

    signalListenersRef.current.push(unsubscribe);
  }, [testid, userId, isActive]);

  // Initialize streaming
  useEffect(() => {
    if (!isActive || !localStream || !testid || !userId) {
      console.log('[WebRTC Stream] Not active:', { isActive, hasStream: !!localStream, testid, userId });
      return;
    }

    console.log('[WebRTC Stream] Initializing stream for user:', userId);

    // Set stream metadata
    const streamRef = ref(database, `LiveStreams/${testid}/${userId}`);
    set(streamRef, {
      active: true,
      userId: userId,
      timestamp: Date.now(),
      status: 'streaming',
    }).then(() => {
      console.log('[WebRTC Stream] Stream metadata set in Firebase');
    }).catch(err => {
      console.error('[WebRTC Stream] Error setting stream metadata:', err);
    });

    // Start listening for signaling
    handleSignaling();
    handleAdminCandidates();

    // Cleanup
    return () => {
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();

      // Remove all listeners
      signalListenersRef.current.forEach((unsubscribe) => {
        unsubscribe();
      });
      signalListenersRef.current = [];

      // Remove stream data from Firebase
      remove(ref(database, `LiveStreams/${testid}/${userId}`));
    };
  }, [isActive, localStream, testid, userId, handleSignaling, handleAdminCandidates]);

  return {
    isStreaming: isActive && localStream !== null,
    streamStatus,
  };
};
