import { useState, useEffect, useRef } from 'react';
import { getDatabase, ref, set, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const useActivityTracker = () => {
  const [isActive, setIsActive] = useState(true);
  const startTime = useRef(Date.now());
  const db = getDatabase();
  const auth = getAuth();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away - save the time spent
        setIsActive(false);
        saveCurrentActiveTime();
      } else {
        // User returned - start counting again
        setIsActive(true);
        startTime.current = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      // Save time before user leaves the website
      saveCurrentActiveTime();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const saveCurrentActiveTime = async () => {
    if (auth.currentUser && isActive) {
      const currentSessionTime = Date.now() - startTime.current;
      await addToTotalTime(currentSessionTime);
      startTime.current = Date.now(); // Reset start time
    }
  };

  const addToTotalTime = async (additionalTime) => {
    if (!auth.currentUser) return;
    
    const userId = auth.currentUser.uid;
    const timeRef = ref(db, `Activitytime/${userId}/`);
    
    try {
      // Get current total time
      const snapshot = await get(timeRef);
      const currentTotal = snapshot.exists() ? snapshot.val() : 0;
      
      // Add new time to existing total
      const newTotal = currentTotal + additionalTime;
      
      // Save back to Firebase
      await set(timeRef, newTotal);
    } catch (error) {
      console.error('Error updating active time:', error);
    }
  };

  // Save time every 30 seconds while user is active
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (isActive && auth.currentUser) {
        saveCurrentActiveTime();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(saveInterval);
  }, [isActive]);

  return { isActive };
};

export default useActivityTracker;
