import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ref, onValue, set, remove } from 'firebase/database';
import { database } from '../../firebase';
import { FiVideo, FiVideoOff, FiVolume2, FiVolumeX, FiMaximize2, FiRefreshCw } from 'react-icons/fi';

/**
 * Component to display a single student's livestream
 */
const StudentStreamCard = ({ testid, userId, userName, userEmail }) => {
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [connectionState, setConnectionState] = useState('new');
  const [error, setError] = useState(null);
  const candidatesQueueRef = useRef([]);
  const adminIdRef = useRef(`admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const isInitializingRef = useRef(false);
  const connectionTimeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const unsubscribersRef = useRef([]);

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

  // Clean up peer connection
  const cleanupPeerConnection = useCallback(() => {
    // Clear timeouts
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Unsubscribe from Firebase listeners
    unsubscribersRef.current.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    unsubscribersRef.current = [];

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
    setConnectionState('closed');
    isInitializingRef.current = false;
  }, []);

  // Initialize peer connection and request stream
  const initializeConnection = useCallback(async () => {
    // Prevent multiple simultaneous initialization attempts
    if (isInitializingRef.current) {
      console.log('Already initializing connection for', userId);
      return;
    }

    try {
      isInitializingRef.current = true;
      setError(null);
      cleanupPeerConnection();

      setConnectionState('connecting');

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('Received track from student:', userId);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateRef = ref(
            database,
            `LiveStreams/${testid}/${userId}/adminCandidates/${adminIdRef.current}/${Date.now()}`
          );
          set(candidateRef, {
            candidate: event.candidate.toJSON(),
            timestamp: Date.now(),
          });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log(`Connection state for ${userId}: ${pc.connectionState}`);
        setConnectionState(pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setIsConnected(true);
          setError(null);
          isInitializingRef.current = false;
          // Clear connection timeout
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
        } else if (pc.connectionState === 'failed') {
          setIsConnected(false);
          setError('Connection failed');
          isInitializingRef.current = false;
          // Don't auto-retry, let user manually retry
          pc.close();
        } else if (pc.connectionState === 'disconnected') {
          setIsConnected(false);
          isInitializingRef.current = false;
        }
      };

      // Set connection timeout (30 seconds)
      connectionTimeoutRef.current = setTimeout(() => {
        if (pc.connectionState !== 'connected') {
          setError('Connection timeout');
          isInitializingRef.current = false;
          cleanupPeerConnection();
        }
      }, 30000);

      // Request offer from student
      const requestRef = ref(database, `LiveStreams/${testid}/${userId}/signaling/${adminIdRef.current}`);
      await set(requestRef, {
        type: 'request-offer',
        timestamp: Date.now(),
      });

      // Listen for offer from student
      const offerRef = ref(database, `LiveStreams/${testid}/${userId}/offers/${adminIdRef.current}`);
      const unsubscribeOffer = onValue(offerRef, async (snapshot) => {
        const data = snapshot.val();
        if (data && data.offer && pc.signalingState !== 'closed') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            
            // Process queued candidates
            while (candidatesQueueRef.current.length > 0) {
              const candidate = candidatesQueueRef.current.shift();
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.error('Error adding queued ICE candidate:', err);
              }
            }

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer to student
            const answerRef = ref(database, `LiveStreams/${testid}/${userId}/signaling/${adminIdRef.current}`);
            await set(answerRef, {
              type: 'answer',
              answer: {
                type: answer.type,
                sdp: answer.sdp,
              },
              timestamp: Date.now(),
            });

            // Remove the offer
            await remove(offerRef);
          } catch (error) {
            console.error('Error handling offer:', error);
            setError('Failed to establish connection');
          }
        }
      });

      // Listen for ICE candidates from student
      const candidatesRef = ref(database, `LiveStreams/${testid}/${userId}/candidates/${adminIdRef.current}`);
      const unsubscribeCandidates = onValue(candidatesRef, (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && pc && pc.connectionState !== 'closed') {
          Object.values(candidates).forEach(async (candidateData) => {
            if (candidateData.candidate) {
              try {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidateData.candidate));
                } else {
                  candidatesQueueRef.current.push(candidateData.candidate);
                }
              } catch (error) {
                // Ignore errors if connection is already established
                if (pc.connectionState !== 'connected') {
                  console.error('Error adding ICE candidate:', error);
                }
              }
            }
          });
        }
      });

      // Store unsubscribers
      unsubscribersRef.current.push(unsubscribeOffer, unsubscribeCandidates);

      isInitializingRef.current = false;
    } catch (error) {
      console.error('Error initializing connection:', error);
      setError('Failed to initialize connection');
      isInitializingRef.current = false;
    }
  }, [testid, userId, cleanupPeerConnection]);

  // Initialize on mount with debounce
  useEffect(() => {
    // Delay initial connection to avoid race conditions
    const initTimer = setTimeout(() => {
      initializeConnection();
    }, 500);

    return () => {
      clearTimeout(initTimer);
      cleanupPeerConnection();
    };
  }, [initializeConnection, cleanupPeerConnection]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const retry = () => {
    if (!isInitializingRef.current) {
      // Debounce retry attempts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryTimeoutRef.current = setTimeout(() => {
        initializeConnection();
      }, 1000);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'failed':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-700">
      {/* Video element */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay when not connected */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 bg-opacity-90">
            {error ? (
              <>
                <FiVideoOff className="text-red-400 text-4xl mb-2" />
                <p className="text-red-400 text-sm mb-3">{error}</p>
                <button
                  onClick={retry}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                >
                  <FiRefreshCw size={14} />
                  Retry
                </button>
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
                <p className="text-gray-400 text-sm">Connecting...</p>
              </>
            )}
          </div>
        )}

        {/* Connection status indicator */}
        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getConnectionStatusColor()} ${isConnected ? 'animate-pulse' : ''}`}></div>
      </div>

      {/* Student info and controls */}
      <div className="p-3 bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{userName}</p>
            <p className="text-gray-400 text-xs truncate">{userEmail}</p>
          </div>
          
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={toggleMute}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
            </button>
            
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              title="Fullscreen"
            >
              <FiMaximize2 size={16} />
            </button>
          </div>
        </div>
        
        {/* Connection state text */}
        <div className="mt-2 text-xs text-gray-500">
          Status: <span className={`font-medium ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
            {connectionState}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Main component to display all active livestreams for an exam
 */
const LiveStreamViewer = ({ testid }) => {
  const [activeStreams, setActiveStreams] = useState([]);
  const [users, setUsers] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!testid) return;

    // Listen for active streams
    const streamsRef = ref(database, `LiveStreams/${testid}`);
    const unsubscribeStreams = onValue(streamsRef, (snapshot) => {
      const streams = snapshot.val();
      if (streams) {
        const activeUserIds = Object.keys(streams).filter(
          (userId) => streams[userId]?.active === true
        );
        setActiveStreams(activeUserIds);
      } else {
        setActiveStreams([]);
      }
      setIsLoading(false);
    });

    // Fetch user details
    const usersRef = ref(database, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val();
      if (usersData) {
        setUsers(usersData);
      }
    });

    return () => {
      unsubscribeStreams();
      unsubscribeUsers();
    };
  }, [testid]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (activeStreams.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
        <FiVideoOff className="text-gray-500 text-5xl mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No active livestreams</p>
        <p className="text-gray-500 text-sm mt-2">Students will appear here when they start their exam</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">
          Live Camera Feeds ({activeStreams.length})
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activeStreams.map((userId) => {
          const user = users[userId];
          return (
            <StudentStreamCard
              key={userId}
              testid={testid}
              userId={userId}
              userName={user?.name || 'Unknown Student'}
              userEmail={user?.email || 'No email'}
            />
          );
        })}
      </div>
    </div>
  );
};

export default LiveStreamViewer;
