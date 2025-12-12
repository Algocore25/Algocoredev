import { useEffect, useRef, useState } from 'react';
import { ref, set, onValue, remove, get, onDisconnect } from 'firebase/database';
import { database } from '../../firebase';

/**
 * Redesigned WebRTC streaming hook - Simplified and more robust
 * Architecture: Student creates persistent offer, Admin creates answer
 * Supports dual stream: camera + screen share
 */
export const useWebRTCStream = (testid, userId, localStream, screenStream = null, isActive = false) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeConnections, setActiveConnections] = useState(0);
  const peerConnectionsRef = useRef(new Map());
  const iceCandidateQueuesRef = useRef(new Map());
  const listenersRef = useRef([]);

  const rtcConfig = {
    iceServers: (() => {
      const servers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ];
      // Optional TURN via env if provided
      const turnUrl = process.env.REACT_APP_TURN_URL;
      const turnUser = process.env.REACT_APP_TURN_USERNAME;
      const turnCred = process.env.REACT_APP_TURN_CREDENTIAL;
      if (turnUrl && turnUser && turnCred) {
        servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
      }
      // Optional TURN from runtime global (e.g., injected via script)
      if (typeof window !== 'undefined' && window.__TURN_CONFIG__) {
        const t = window.__TURN_CONFIG__;
        if (t.urls) servers.push({ urls: t.urls, username: t.username, credential: t.credential });
      }
      return servers;
    })(),
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
    sdpSemantics: 'unified-plan'
  };

  // Cleanup function
  const cleanup = () => {
    console.log('[WebRTC] Cleaning up connections');
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, adminId) => {
      console.log('[WebRTC] Closing connection with admin:', adminId);
      pc.close();
    });
    peerConnectionsRef.current.clear();
    iceCandidateQueuesRef.current.clear();

    // Remove Firebase listeners
    listenersRef.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') unsubscribe();
    });
    listenersRef.current = [];

    // Remove presence
    if (testid && userId) {
      remove(ref(database, `LiveStreams/${testid}/${userId}`));
    }
    
    setConnectionStatus('disconnected');
    setActiveConnections(0);
  };

  useEffect(() => {
    if (!isActive || !localStream || !testid || !userId) {
      console.log('[WebRTC] Not initializing:', { isActive, hasStream: !!localStream, testid, userId });
      cleanup();
      return;
    }

    console.log('[WebRTC] ===== Starting WebRTC Stream for user:', userId, '=====');
    setConnectionStatus('initializing');

    // Set presence - this tells admin we're available
    const presenceRef = ref(database, `LiveStreams/${testid}/${userId}`);
    set(presenceRef, {
      active: true,
      userId,
      timestamp: Date.now(),
      status: 'available',
    });

    // Auto-cleanup on disconnect
    onDisconnect(presenceRef).remove();

    // Listen for incoming viewer requests
    const viewersRef = ref(database, `LiveStreams/${testid}/${userId}/viewers`);
    const unsubscribeViewers = onValue(viewersRef, async (snapshot) => {
      const viewers = snapshot.val();
      if (!viewers) return;

      console.log('[WebRTC] Active viewers:', Object.keys(viewers));

      for (const [viewerId, viewerData] of Object.entries(viewers)) {
        // Skip if we already have a connection
        if (peerConnectionsRef.current.has(viewerId)) {
          const existingPc = peerConnectionsRef.current.get(viewerId);
          if (existingPc.connectionState === 'connected' || existingPc.connectionState === 'connecting') {
            continue;
          }
        }

        console.log('[WebRTC] Setting up connection for viewer:', viewerId);
        await setupPeerConnection(viewerId, localStream, screenStream);
      }
    });

    listenersRef.current.push(unsubscribeViewers);

    // Update status
    setConnectionStatus('ready');

    // Cleanup on unmount
    return cleanup;
  }, [isActive, localStream, screenStream, testid, userId]);

  // Setup individual peer connection
  const setupPeerConnection = async (viewerId, cameraStream, screenStream = null) => {
    try {
      console.log('[WebRTC] Creating peer connection for:', viewerId);
      console.log('[WebRTC] Camera stream:', !!cameraStream, 'Screen stream:', !!screenStream);

      // Close existing connection if any
      const existingPc = peerConnectionsRef.current.get(viewerId);
      if (existingPc) {
        existingPc.close();
      }

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionsRef.current.set(viewerId, pc);
      iceCandidateQueuesRef.current.set(viewerId, []);

      // Add camera tracks first
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
          // IMPORTANT: Ensure track is enabled before adding
          track.enabled = true;
          
          const sender = pc.addTrack(track, cameraStream);
          console.log('[WebRTC] Added CAMERA track:', track.kind, 'with label:', track.label, 'enabled:', track.enabled, 'muted:', track.muted, 'readyState:', track.readyState);
          
          // Set encoding parameters for better quality
          if (track.kind === 'video') {
            const parameters = sender.getParameters();
            if (!parameters.encodings || parameters.encodings.length === 0) {
              parameters.encodings = [{}];
            }
            
            // Optimize video encoding
            parameters.encodings[0].maxBitrate = 2000000; // 2 Mbps max
            parameters.encodings[0].maxFramerate = 30;
            parameters.encodings[0].scaleResolutionDownBy = 1; // No downscaling
            
            sender.setParameters(parameters)
              .then(() => console.log('[WebRTC] Camera video encoding parameters set'))
              .catch(e => console.error('[WebRTC] Failed to set camera encoding params:', e));
          } else if (track.kind === 'audio') {
            // Optimize audio encoding for clarity
            const parameters = sender.getParameters();
            if (!parameters.encodings || parameters.encodings.length === 0) {
              parameters.encodings = [{}];
            }
            
            // Set audio bitrate for clear voice
            parameters.encodings[0].maxBitrate = 128000; // 128 kbps for audio
            
            sender.setParameters(parameters)
              .then(() => console.log('[WebRTC] Camera audio encoding parameters set'))
              .catch(e => console.error('[WebRTC] Failed to set audio encoding params:', e));
          }
        });
      }
      
      // Add screen share tracks if available
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          const sender = pc.addTrack(track, screenStream);
          console.log('[WebRTC] Added SCREEN SHARE track:', track.kind, 'with label:', track.label);
          
          // Set encoding parameters for screen share (higher quality for screen content)
          if (track.kind === 'video') {
            const parameters = sender.getParameters();
            if (!parameters.encodings || parameters.encodings.length === 0) {
              parameters.encodings = [{}];
            }
            
            // Screen share needs higher bitrate and frame rate for clarity
            parameters.encodings[0].maxBitrate = 3000000; // 3 Mbps for screen
            parameters.encodings[0].maxFramerate = 30;
            parameters.encodings[0].scaleResolutionDownBy = 1;
            
            sender.setParameters(parameters)
              .then(() => console.log('[WebRTC] Screen share encoding parameters set'))
              .catch(e => console.error('[WebRTC] Failed to set screen encoding params:', e));
          }
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateRef = ref(
            database,
            `LiveStreams/${testid}/${userId}/ice/${viewerId}/student/${Date.now()}`
          );
          set(candidateRef, event.candidate.toJSON());
        }
      };

      // Track ICE restart attempts per viewer
      const restartAttemptedRef = { value: false };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state [${viewerId}]:`, pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setConnectionStatus('streaming');
          updateActiveConnections();
        } else if (pc.connectionState === 'failed') {
          // Try a one-time ICE restart to recover
          if (!restartAttemptedRef.value && typeof pc.restartIce === 'function') {
            console.warn('[WebRTC] Connection failed, attempting ICE restart for viewer:', viewerId);
            restartAttemptedRef.value = true;
            try {
              pc.restartIce();
            } catch (e) {
              console.error('[WebRTC] ICE restart error:', e);
            }
          } else {
            peerConnectionsRef.current.delete(viewerId);
            updateActiveConnections();
          }
        } else if (pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(viewerId);
          updateActiveConnections();
        }
      };

      // Handle ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE state [${viewerId}]:`, pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log(`[WebRTC] ICE gathering [${viewerId}]:`, pc.iceGatheringState);
      };

      // Create and send offer with optimal settings
      const offer = await pc.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false,
        voiceActivityDetection: false,
        iceRestart: false
      });
      
      // Optimize SDP for better video quality and compatibility
      const optimizeSDP = (sdp) => {
        try {
          let lines = sdp.split('\n');
          
          // Prefer H.264 for better compatibility
          const mLineIndex = lines.findIndex(l => l.startsWith('m=video'));
          if (mLineIndex !== -1) {
            const h264Pt = lines
              .filter(l => l.startsWith('a=rtpmap:'))
              .map(l => ({ pt: l.match(/a=rtpmap:(\d+)/)?.[1], codec: l.toLowerCase() }))
              .find(x => x.codec.includes('h264'))?.pt;
            
            if (h264Pt) {
              const parts = lines[mLineIndex].split(' ');
              const header = parts.slice(0, 3);
              const pts = parts.slice(3).filter(Boolean);
              const reordered = [h264Pt, ...pts.filter(p => p !== h264Pt)];
              lines[mLineIndex] = [...header, ...reordered].join(' ');
            }
            
            // Add bandwidth constraints for smooth streaming
            const insertAfter = mLineIndex + 1;
            lines.splice(insertAfter, 0, 
              'b=AS:2000',
              'b=TIAS:2000000'
            );
          }
          
          return lines.join('\n');
        } catch (e) {
          console.error('[WebRTC] SDP optimization error:', e);
          return sdp;
        }
      };
      
      const mungedOffer = { ...offer, sdp: optimizeSDP(offer.sdp) };
      await pc.setLocalDescription(mungedOffer);

      console.log('[WebRTC] Sending offer to viewer:', viewerId);
      await set(ref(database, `LiveStreams/${testid}/${userId}/offers/${viewerId}`), {
        sdp: mungedOffer.sdp,
        type: mungedOffer.type,
        timestamp: Date.now(),
      });

      // Listen for answer
      const answerRef = ref(database, `LiveStreams/${testid}/${userId}/answers/${viewerId}`);
      const unsubscribeAnswer = onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (!answer || !answer.sdp) return;

        console.log('[WebRTC] Received answer from:', viewerId);
        
        if (pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            
            // Process queued ICE candidates
            const queue = iceCandidateQueuesRef.current.get(viewerId) || [];
            for (const candidate of queue) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            iceCandidateQueuesRef.current.set(viewerId, []);
            
            console.log('[WebRTC] Remote description set and candidates processed');
          } catch (error) {
            console.error('[WebRTC] Error setting remote description:', error);
          }
        }
      });

      listenersRef.current.push(unsubscribeAnswer);

      // Listen for ICE candidates from viewer
      const viewerIceRef = ref(database, `LiveStreams/${testid}/${userId}/ice/${viewerId}/viewer`);
      const unsubscribeIce = onValue(viewerIceRef, (snapshot) => {
        const candidates = snapshot.val();
        if (!candidates) return;

        Object.values(candidates).forEach(async (candidate) => {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error('[WebRTC] Error adding ICE candidate:', error);
            }
          } else {
            // Queue for later
            const queue = iceCandidateQueuesRef.current.get(viewerId) || [];
            queue.push(candidate);
            iceCandidateQueuesRef.current.set(viewerId, queue);
          }
        });
      });

      listenersRef.current.push(unsubscribeIce);

    } catch (error) {
      console.error('[WebRTC] Error setting up peer connection:', error);
      peerConnectionsRef.current.delete(viewerId);
    }
  };

  const updateActiveConnections = () => {
    let count = 0;
    peerConnectionsRef.current.forEach((pc) => {
      if (pc.connectionState === 'connected') {
        count++;
      }
    });
    setActiveConnections(count);
  };

  return {
    isStreaming: connectionStatus === 'streaming' || activeConnections > 0,
    connectionStatus,
    activeConnections,
  };
};
