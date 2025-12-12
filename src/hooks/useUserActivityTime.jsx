import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const useUserActivityTime = () => {
  const [totalTime, setTotalTime] = useState(0);
  const auth = getAuth();
  const db = getDatabase();

  useEffect(() => {
    if (auth.currentUser) {
      const userId = auth.currentUser.uid;
      const timeRef = ref(db, `Activitytime/${userId}/`);
      
      const unsubscribe = onValue(timeRef, (snapshot) => {
        if (snapshot.exists()) {
          setTotalTime(snapshot.val());
        }
      });

      return () => unsubscribe();
    }
  }, [auth.currentUser]);

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${totalSeconds}s`;
    }
  };

  return { totalTime, formatTime };
};

export default useUserActivityTime;
