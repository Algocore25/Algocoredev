import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';

import { auth } from '../firebase';

import { ref, set, onValue, onDisconnect, remove, update, get } from 'firebase/database';
import { database } from '../firebase';

const AuthContext = createContext(null);


// List of emails allowed to have multiple sessions
const MULTI_SESSION_ALLOWED = [
  '99220041106@klu.ac.in'
];


// Session configuration
const SESSION_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  NEW_LOGIN_DETECTION_WINDOW: 2000, // 2 seconds to detect new login vs page refresh
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionEnforced, setSessionEnforced] = useState(true);

  // Session management refs
  const sessionIdRef = React.useRef(null);
  const sessionUnsubRef = React.useRef(null);
  const heartbeatRef = React.useRef(null);
  const sessionPathRef = React.useRef(null);
  const isManualLogoutRef = React.useRef(false);
  const isInitializingSessionRef = React.useRef(false);
  const cleanupTimeoutRef = React.useRef(null);
  const isOnlineRef = React.useRef(navigator.onLine);

  // Generate a more robust session ID
  const generateSessionId = () => {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  // Enhanced cleanup function
  const cleanupSessionListeners = useCallback(() => {
    console.log('Cleaning up session listeners');
    
    // Clear heartbeat
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    // Clear cleanup timeout
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    
    // Unsubscribe from session listener
    if (sessionUnsubRef.current) {
      try { 
        sessionUnsubRef.current(); 
      } catch (error) {
        console.warn('Error unsubscribing from session listener:', error);
      }
      sessionUnsubRef.current = null;
    }
    
    // Reset refs
    sessionIdRef.current = null;
    sessionPathRef.current = null;
    isManualLogoutRef.current = false;
    isInitializingSessionRef.current = false;
  }, []);

  // Enhanced logout function with proper cleanup
  const logout = useCallback(async (isAuto = false, reason = 'manual') => {
    try {
      console.log(`Logging out - Auto: ${isAuto}, Reason: ${reason}`);
      
      // Set manual logout flag if this is not an automatic logout
      if (!isAuto) {
        isManualLogoutRef.current = true;
      }

      // Clean up session listeners first
      cleanupSessionListeners();

      // Try to remove the session record from database
      const uid = auth.currentUser?.uid || user?.uid;
      if (uid && sessionPathRef.current) {
        try {
          await remove(ref(database, `sessions/${uid}`));
          console.log('Session record removed from database');
        } catch (error) {
          console.warn('Failed to remove session record:', error);
        }
      }

      // Sign out from Firebase
      await firebaseSignOut(auth);
      setUser(null);
      
      // Show modal for automatic logouts only
      if (isAuto && reason !== 'manual') {
        showLogoutModal(reason);
      }
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [user?.uid, cleanupSessionListeners]);

  // Show logout modal
  const showLogoutModal = (reason) => {
    // Remove any existing modals first
    const existingModal = document.querySelector('.session-logout-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'session-logout-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    const reasonText = reason === 'new-login' 
      ? 'You have been logged out because your account was signed in from another device or browser.'
      : reason === 'session-removed'
      ? 'Your session was terminated by another login.'
      : 'Your session has ended.';

    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-yellow-500 text-2xl">⚠️</span>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Session Ended</h3>
        </div>
        <p class="text-gray-600 dark:text-gray-300 mb-6">
          ${reasonText}
        </p>
        <div class="flex justify-end gap-2">
          <button 
            id="modal-ok-btn"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            OK
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle interactions
    const removeModal = () => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    };

    const okBtn = modal.querySelector('#modal-ok-btn');
    okBtn?.addEventListener('click', removeModal);
    
    // Auto-remove after 15 seconds
    setTimeout(removeModal, 15000);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        removeModal();
      }
    });
  };

  // Enhanced session initialization
  const initSingleSession = useCallback(async (uid) => {
    if (isInitializingSessionRef.current) {
      console.log('Session initialization already in progress');
      return;
    }

    try {
      isInitializingSessionRef.current = true;
      console.log('Initializing single session for user:', uid);

      // Generate new session ID
      const newSessionId = generateSessionId();
      sessionIdRef.current = newSessionId;
      sessionPathRef.current = `sessions/${uid}`;
      
      const sessionRef = ref(database, sessionPathRef.current);

      // Create comprehensive session data
      const sessionData = {
        sessionId: newSessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastActive: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
        language: typeof navigator !== 'undefined' ? navigator.language : 'unknown'
      };

      // Check for existing session
      const snapshot = await get(sessionRef);
      const existingSession = snapshot.val();
      
      if (existingSession) {
        console.log('Existing session found:', existingSession.sessionId);
        // Don't immediately terminate - let the new session take over
      }

      // Set new session data
      await set(sessionRef, sessionData);
      console.log('New session created:', newSessionId);

      // Don't set up onDisconnect handler to avoid logout on network issues
      // Sessions will be cleaned up by new logins instead
      console.log('Session will persist through network disconnections');

      // Set up session listener
      sessionUnsubRef.current = onValue(sessionRef, (snapshot) => {
        const sessionValue = snapshot.val();
        
        if (!sessionValue) {
          console.log('Session removed from database');
          // Only logout if we're online (to avoid false logout on network issues)
          if (!isManualLogoutRef.current && isOnlineRef.current) {
            console.log('Session genuinely removed while online - logging out');
            logout(true, 'session-removed');
          } else if (!isOnlineRef.current) {
            console.log('Session removed but offline - keeping user logged in');
          }
          return;
        }

        // Check if session ID has changed (new login detected)
        if (sessionValue.sessionId && sessionValue.sessionId !== sessionIdRef.current) {
          console.log('Session ID changed - new login detected');
          console.log('Current session:', sessionIdRef.current);
          console.log('New session:', sessionValue.sessionId);
          
          // Check if this is a genuine new login (not just a page refresh)
          const now = Date.now();
          const sessionCreated = sessionValue.createdAt || sessionValue.updatedAt;
          const timeSinceCreation = now - sessionCreated;
          
          // If the session was created very recently, it's likely a new login
          const isNewLogin = timeSinceCreation <= SESSION_CONFIG.NEW_LOGIN_DETECTION_WINDOW;
          
          if (!isManualLogoutRef.current) {
            if (isNewLogin || sessionValue.sessionId !== sessionIdRef.current) {
              console.log('Terminating current session due to new login');
              logout(true, 'new-login');
            } else {
              // Update our session ID to match (shouldn't happen often)
              console.log('Updating session ID to match database');
              sessionIdRef.current = sessionValue.sessionId;
            }
          }
        }

        // No session timeout based on inactivity - sessions persist until new login
        console.log('Session heartbeat received, session remains active');
      }, (error) => {
        console.error('Session listener error:', error);
        // Don't logout on database connection errors
        if (error.code === 'PERMISSION_DENIED') {
          console.log('Permission denied - user may have been signed out');
          logout(true, 'permission-denied');
        }
      });

      // Set up heartbeat to maintain session presence
      const sendHeartbeat = async () => {
        if (isManualLogoutRef.current || !sessionPathRef.current) {
          return;
        }

        try {
          await update(ref(database, sessionPathRef.current), {
            lastActive: Date.now(),
            updatedAt: Date.now()
          });
          // Only log heartbeat in development/debug mode
          if (process.env.NODE_ENV === 'development') {
            console.log('Session heartbeat sent');
          }
        } catch (error) {
          console.warn('Failed to send heartbeat:', error);
          // If we can't send heartbeat due to permission issues, the user might be signed out
          if (error.code === 'PERMISSION_DENIED') {
            console.log('Permission denied on heartbeat - logging out');
            logout(true, 'permission-denied');
          }
        }
      };

      // Send initial heartbeat
      await sendHeartbeat();

      // Set up heartbeat interval
      heartbeatRef.current = setInterval(sendHeartbeat, SESSION_CONFIG.HEARTBEAT_INTERVAL);
      console.log('Session initialized with heartbeat. No timeout - session persists until new login detected.');

    } catch (error) {
      console.error('Failed to initialize session:', error);
    } finally {
      isInitializingSessionRef.current = false;
    }
  }, [logout]);

  // Network status tracking
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: ONLINE');
      isOnlineRef.current = true;
    };
    
    const handleOffline = () => {
      console.log('Network: OFFLINE');
      isOnlineRef.current = false;
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth state listener
  useEffect(() => {
    console.log('Setting up auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid || 'null');
      
      if (firebaseUser) {
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL
        };
        setUser(userData);
      } else {
        console.log('No user found, cleaning up');
        setUser(null);
        cleanupSessionListeners();
      }
      
      setLoading(false);
    });

    return () => {
      console.log('Cleaning up auth state listener');
      unsubscribe();
      cleanupSessionListeners();
    };
  }, [cleanupSessionListeners]);

  // Session enforcement effect
  useEffect(() => {
    if (!user?.uid || !sessionEnforced || loading) {
      return;
    }


    const isMultiSessionUser = MULTI_SESSION_ALLOWED.includes(user.email);

    if (isMultiSessionUser) {
    console.log(`Multi-session allowed for ${user.email}. Skipping single-session enforcement.`);
    return; // ✅ Skip session enforcement entirely
  }



    console.log('Starting session enforcement for user:', user.uid);
    
    // Small delay to ensure auth is fully settled
    const timeoutId = setTimeout(() => {
      initSingleSession(user.uid);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      cleanupSessionListeners();
    };
  }, [user?.uid, sessionEnforced, loading, initSingleSession, cleanupSessionListeners]);

  // Enhanced Google sign-in
  const googleSignIn = async () => {
    try {
      console.log('Starting Google sign-in');
      
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      
      // Store user data in database
      await set(ref(database, `users/${result.user.uid}`), {
        email: result.user.email,
        name: result.user.displayName,
        profilePhoto: result.user.photoURL,
        lastLogin: Date.now(),
        provider: 'google'
      });
      
      console.log('Google sign-in successful');
      toast.success('Signed in successfully!');
      
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in was cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Pop-up was blocked. Please allow pop-ups and try again.');
      } else {
        toast.error('Failed to sign in. Please try again.');
      }
      
      throw error;
    }
  };

  // Email/password login placeholder
  const login = async ({ email, password }) => {
    throw new Error("Email/password login not implemented yet");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSessionListeners();
    };
  }, [cleanupSessionListeners]);

  const value = {
    user,
    loading,
    googleSignIn,
    logout: (isAuto = false) => logout(isAuto, 'manual'),
    login,
    sessionEnforced,
    setSessionEnforced
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};