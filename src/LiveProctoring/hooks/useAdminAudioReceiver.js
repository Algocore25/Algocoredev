import { useEffect, useRef, useState } from 'react';
import { ref, set, onValue, remove, onDisconnect } from 'firebase/database';
import { database } from '../../firebase';

/**
 * Hook to receive and play admin audio on student side
 */
export const useAdminAudioReceiver = (testid, userId, isActive = false) => {
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [adminConnectionStatus, setAdminConnectionStatus] = useState('disconnected');
  const adminPeerConnectionsRef = useRef(new Map());
  const adminListenersRef = useRef([]);
  const audioElementRef = useRef(null);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };

  // Cleanup function
  const cleanup = () => {
    console.log('[AdminAudioReceiver] Cleaning up admin audio connections');
    
    // Close all peer connections
    adminPeerConnectionsRef.current.forEach((pc, adminId) => {
      console.log('[AdminAudioReceiver] Closing connection with admin:', adminId);
      pc.close();
    });
    adminPeerConnectionsRef.current.clear();

    // Remove audio element
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }

    // Remove Firebase listeners
    adminListenersRef.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    adminListenersRef.current = [];
    
    setIsReceivingAudio(false);
    setAdminConnectionStatus('disconnected');
  };

  // Setup individual peer connection for admin audio - defined before useEffect
  const setupAdminAudioConnection = async (adminId) => {
    try {
      console.log('[AdminAudioReceiver] Creating peer connection for admin:', adminId);

      // Close existing connection if any
      const existingPc = adminPeerConnectionsRef.current.get(adminId);
      if (existingPc) {
        existingPc.close();
      }

      const pc = new RTCPeerConnection(rtcConfig);
      adminPeerConnectionsRef.current.set(adminId, pc);

      // Handle incoming audio tracks
      pc.ontrack = (event) => {
        console.log('[AdminAudioReceiver] ===== ADMIN AUDIO TRACK RECEIVED =====');
        console.log('[AdminAudioReceiver] Track kind:', event.track.kind);
        console.log('[AdminAudioReceiver] Track readyState:', event.track.readyState);
        console.log('[AdminAudioReceiver] Track enabled:', event.track.enabled);
        
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          console.log('[AdminAudioReceiver] Stream ID:', stream.id);
          console.log('[AdminAudioReceiver] Stream active:', stream.active);
          console.log('[AdminAudioReceiver] Stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.readyState}`));
          
          // Create or reuse audio element
          if (!audioElementRef.current) {
            audioElementRef.current = document.createElement('audio');
            audioElementRef.current.autoplay = true;
            audioElementRef.current.volume = 1.0;
            audioElementRef.current.muted = false;
            document.body.appendChild(audioElementRef.current);
            console.log('[AdminAudioReceiver] Audio element created and added to DOM');
          }

          // Set the stream to audio element
          audioElementRef.current.srcObject = stream;
          
          // Force play
          audioElementRef.current.play()
            .then(() => {
              console.log('[AdminAudioReceiver] ✅ Admin audio playback started successfully');
              console.log('[AdminAudioReceiver] Audio element volume:', audioElementRef.current.volume);
              console.log('[AdminAudioReceiver] Audio element muted:', audioElementRef.current.muted);
              setIsReceivingAudio(true);
              setAdminConnectionStatus('receiving');
            })
            .catch(error => {
              console.error('[AdminAudioReceiver] Error playing admin audio:', error);
              // Try to play on user interaction
              const playOnInteraction = () => {
                audioElementRef.current.play()
                  .then(() => {
                    console.log('[AdminAudioReceiver] ✅ Audio started after user interaction');
                    document.removeEventListener('click', playOnInteraction);
                  })
                  .catch(e => console.error('[AdminAudioReceiver] Still failed:', e));
              };
              document.addEventListener('click', playOnInteraction, { once: true });
            });
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[AdminAudioReceiver] Sending ICE candidate:', event.candidate.type);
          const candidateRef = ref(
            database,
            `AdminAudio/${testid}/${userId}/ice/${adminId}/student/${Date.now()}`
          );
          set(candidateRef, event.candidate.toJSON())
            .catch(error => {
              console.error('[AdminAudioReceiver] Error sending ICE candidate:', error);
            });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`[AdminAudioReceiver] Connection state [${adminId}]:`, state);
        
        if (state === 'connected') {
          console.log('[AdminAudioReceiver] ✅ Admin audio connection established');
          setAdminConnectionStatus('receiving');
        } else if (state === 'failed' || state === 'disconnected') {
          console.error(`[AdminAudioReceiver] Connection ${state} with admin:`, adminId);
          adminPeerConnectionsRef.current.delete(adminId);
          if (adminPeerConnectionsRef.current.size === 0) {
            setIsReceivingAudio(false);
          }
        } else if (state === 'closed') {
          adminPeerConnectionsRef.current.delete(adminId);
          if (adminPeerConnectionsRef.current.size === 0) {
            setIsReceivingAudio(false);
          }
        }
      };

      // Handle ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log(`[AdminAudioReceiver] ICE state [${adminId}]:`, pc.iceConnectionState);
      };

      // Listen for offer from admin
      const offerRef = ref(database, `AdminAudio/${testid}/${userId}/offers/${adminId}`);
      const unsubscribeOffer = onValue(offerRef, async (snapshot) => {
        const offer = snapshot.val();
        if (!offer || !offer.sdp) return;

        console.log('[AdminAudioReceiver] Received offer from admin:', adminId);
        console.log('[AdminAudioReceiver] Current signaling state:', pc.signalingState);

        if (pc.signalingState !== 'stable') {
          console.log('[AdminAudioReceiver] Skipping offer, wrong signaling state:', pc.signalingState);
          return;
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          console.log('[AdminAudioReceiver] Remote description set');

          // Create answer
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('[AdminAudioReceiver] Local description set');

          console.log('[AdminAudioReceiver] Sending answer to admin');
          await set(ref(database, `AdminAudio/${testid}/${userId}/answers/${adminId}`), {
            sdp: answer.sdp,
            type: answer.type,
            timestamp: Date.now(),
          });
          console.log('[AdminAudioReceiver] Answer sent successfully');
        } catch (error) {
          console.error('[AdminAudioReceiver] Error handling offer:', error);
        }
      });

      adminListenersRef.current.push(unsubscribeOffer);

      // Listen for ICE candidates from admin
      const adminIceRef = ref(database, `AdminAudio/${testid}/${userId}/ice/${adminId}/admin`);
      const unsubscribeIce = onValue(adminIceRef, (snapshot) => {
        const candidates = snapshot.val();
        if (!candidates) return;

        Object.values(candidates).forEach(async (candidate) => {
          // Check if peer connection is still valid before adding candidate
          if (pc.signalingState === 'closed' || pc.connectionState === 'closed') {
            console.log('[AdminAudioReceiver] Peer connection closed, skipping ICE candidate');
            return;
          }

          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[AdminAudioReceiver] Added admin ICE candidate');
          } catch (error) {
            // Only log error if connection is not closed (expected error)
            if (pc.signalingState !== 'closed' && pc.connectionState !== 'closed') {
              console.error('[AdminAudioReceiver] Error adding ICE candidate:', error);
            }
          }
        });
      });

      adminListenersRef.current.push(unsubscribeIce);

    } catch (error) {
      console.error('[AdminAudioReceiver] Error setting up admin audio connection:', error);
      adminPeerConnectionsRef.current.delete(adminId);
    }
  };

  useEffect(() => {
    if (!isActive || !testid || !userId) {
      console.log('[AdminAudioReceiver] Not initializing:', { isActive, testid, userId });
      cleanup();
      return;
    }

    console.log('[AdminAudioReceiver] ===== Listening for admin audio for user:', userId, '=====');
    setAdminConnectionStatus('listening');

    // Listen for admin audio offers
    const adminAudioRef = ref(database, `AdminAudio/${testid}/${userId}/admin`);
    const unsubscribeAdmin = onValue(adminAudioRef, async (snapshot) => {
      const admins = snapshot.val();
      if (!admins) {
        // No admins speaking, cleanup existing connections
        console.log('[AdminAudioReceiver] No active admin speakers, cleaning up connections');
        
        // Close and remove all peer connections
        adminPeerConnectionsRef.current.forEach((pc, adminId) => {
          console.log('[AdminAudioReceiver] Closing connection with admin:', adminId);
          pc.close();
        });
        adminPeerConnectionsRef.current.clear();
        
        // Clear audio element
        if (audioElementRef.current && audioElementRef.current.srcObject) {
          audioElementRef.current.srcObject.getTracks().forEach(track => track.stop());
          audioElementRef.current.srcObject = null;
        }
        
        setIsReceivingAudio(false);
        return;
      }

      console.log('[AdminAudioReceiver] Active admin speakers:', Object.keys(admins));

      // Check for admins that are no longer active and close their connections
      adminPeerConnectionsRef.current.forEach((pc, adminId) => {
        if (!admins[adminId] || !admins[adminId].active) {
          console.log('[AdminAudioReceiver] Admin no longer active, closing connection:', adminId);
          pc.close();
          adminPeerConnectionsRef.current.delete(adminId);
        }
      });

      for (const [adminId, adminData] of Object.entries(admins)) {
        if (!adminData.active) {
          console.log('[AdminAudioReceiver] Admin not active:', adminId);
          continue;
        }

        // Skip if we already have a connection
        if (adminPeerConnectionsRef.current.has(adminId)) {
          const existingPc = adminPeerConnectionsRef.current.get(adminId);
          if (existingPc.connectionState === 'connected' || existingPc.connectionState === 'connecting') {
            console.log('[AdminAudioReceiver] Already connected to admin:', adminId);
            continue;
          } else if (existingPc.connectionState === 'closed' || existingPc.connectionState === 'failed') {
            console.log('[AdminAudioReceiver] Removing stale connection for admin:', adminId);
            adminPeerConnectionsRef.current.delete(adminId);
          }
        }

        console.log('[AdminAudioReceiver] Setting up connection for admin:', adminId);
        await setupAdminAudioConnection(adminId);
      }
    });

    adminListenersRef.current.push(unsubscribeAdmin);

    // Cleanup on unmount
    return cleanup;
  }, [isActive, testid, userId]);

  return {
    isReceivingAudio,
    adminConnectionStatus,
  };
};
