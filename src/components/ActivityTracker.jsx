import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';  // Use your existing hook
import useActivityTracker from '../hooks/useActivityTracker';

const ActivityTracker = ({ children }) => {
  const { user } = useAuth();  // Use your existing useAuth hook
  const { isActive } = useActivityTracker();

  useEffect(() => {
    if (user) {
      console.log('Activity tracking started for user:', user.uid);
    }
  }, [user]);

  return <>{children}</>;
};

export default ActivityTracker;
