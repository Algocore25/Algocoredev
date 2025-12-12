import React, { useEffect, useState } from "react";
import { auth, database } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { useAuth } from "./context/AuthContext";
import LoadingPage from "./pages/LoadingPage";
import SignInRequiredPage from "./pages/SignInRequiredPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";



const ProtectedRoute = ({ children, requireAdmin = false, requireUser = false }) => {
  const [authStatus, setAuthStatus] = useState("loading"); // 'loading', 'unauthenticated', 'authenticated', 'unauthorized'

  const { user } = useAuth();


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthStatus("unauthenticated");
        return;
      }


      // Get user's role from Realtime Database
      try {
        const userRef = ref(database, `Admins/${user.uid}`);
        const snapshot = await get(userRef);


        let isAdmin = false;

        if (snapshot.exists()) {
          isAdmin = true;
        }

        if (requireAdmin && !isAdmin) {
          setAuthStatus("unauthorized");
          console.log("meow1");
        } else {
          setAuthStatus("authenticated");
        }

        const stu = await get(   ref(database , `Students` ) );

        if( stu.exists() )
        {
          if( stu.val().indexOf( user.email ) === -1 && !isAdmin )
          {
            setAuthStatus("unauthorized");
          }
        }


      } catch (error) {
        console.error("Error fetching user data:", error);
        setAuthStatus("unauthorized");
      }
    });

    return () => unsubscribe();
  }, [requireAdmin, requireUser, user]);

  if (authStatus === "loading") return <LoadingPage message="Loading page, please wait..." />;
  if (authStatus === "unauthenticated") return <SignInRequiredPage/>;
  if (authStatus === "unauthorized") return <UnauthorizedPage/> ;

  return children;
};

export default ProtectedRoute;
