import React, { useEffect, useRef, useState } from "react";
import screenfull from "screenfull";
import { database } from "../firebase";
import { ref, push, set, serverTimestamp } from "firebase/database";
import { useAuth } from "../context/AuthContext";

const FullscreenTracker = ({ violation, setviolation, isViolationReady, testid, enableViolationTracking = true }) => {
  const { user } = useAuth();
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exitCount, setExitCount] = useState(0);
  const [switchCount, setSwitchCount] = useState(0);
  const [hoverLeaveCount, setHoverLeaveCount] = useState(0);
  const [keypressCount, setKeypressCount] = useState(0);
  const [totalBlurTime, setTotalBlurTime] = useState(0);
  const [totalHoverLeaveTime, setTotalHoverLeaveTime] = useState(0);

  // Refs for timers and tracking
  const blurStartRef = useRef(null);
  const hoverLeaveStartRef = useRef(null);
  const lastExitRef = useRef(null);
  const switchActiveRef = useRef(false);
  const ignoreNextBlurRef = useRef(false);

  // Timer refs for cancellation (prevents duplicate violations)
  const fullscreenTimerRef = useRef(null);
  const blurTimerRef = useRef(null);
  const visibilityTimerRef = useRef(null);
  const mouseLeaveTimerRef = useRef(null);

  // --- Log violation to Firebase ---
  const logViolation = async (reason, details = {}) => {
    // Only log if violation tracking is enabled
    if (!enableViolationTracking) return;
    if (!testid || !user?.uid) return;
    
    try {
      const violationRef = ref(database, `Exam/${testid}/Violations/${user.uid}`);
      const newViolationRef = push(violationRef);
      
      await set(newViolationRef, {
        reason,
        timestamp: new Date().toISOString(),
        details,
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`,
      });
      
      console.log(`[Violation Logged] ${reason}`, details);
    } catch (error) {
      console.error("Error logging violation:", error);
    }
  };

  const markTabSwitch = () => {
    if (!switchActiveRef.current) {
      switchActiveRef.current = true;
      setSwitchCount((prev) => prev + 1);
      if (isViolationReady) {
        setviolation((prev) => {
          const nextValue = typeof prev === "number" ? prev + 1 : 1;
          return nextValue;
        });
        logViolation("tab_switch_detected", {
          detectedAt: new Date().toISOString(),
          reason: "Immediate tab/window blur",
        });
      }
    }
  };

  // --- Toggle fullscreen ---
  const toggleFullscreen = () => {
    if (screenfull.isEnabled) {
      screenfull.toggle(containerRef.current);
    }
  };

  // --- Fullscreen change detection (grace period: 1s) ---
  useEffect(() => {
    if (!screenfull.isEnabled) return;

    const onChange = () => {
      const fs = screenfull.isFullscreen;
      setIsFullscreen(fs);

      if (!fs) {
        lastExitRef.current = Date.now();
        switchActiveRef.current = false;
        blurStartRef.current = null;
        ignoreNextBlurRef.current = true;

        // Clear any pending timer to prevent duplicate violations
        if (fullscreenTimerRef.current) {
          clearTimeout(fullscreenTimerRef.current);
        }
        
        fullscreenTimerRef.current = setTimeout(() => {
          // Only count violation if user is still not fullscreen after 1s
          if (!screenfull.isFullscreen && isViolationReady) {
            console.warn("[Violation] Fullscreen exit detected");
            logViolation("fullscreen_exit", {
              exitTime: new Date().toISOString(),
              gracePeriod: "1000ms",
            });
            setviolation((prev) => prev + 1);
            setExitCount((prev) => prev + 1);
          }
          fullscreenTimerRef.current = null;
        }, 1000);
      }
    };

    screenfull.on("change", onChange);
    return () => screenfull.off("change", onChange);
  }, [isViolationReady, setviolation]);

  // --- Blur / Focus / Visibility Change (grace period: 2s) ---
  useEffect(() => {
    const handleBlur = () => {
      // Only track if not already tracking via visibility change
      if (!document.hidden && !blurStartRef.current) {
        if (ignoreNextBlurRef.current) {
          ignoreNextBlurRef.current = false;
          return;
        }
        blurStartRef.current = Date.now();
        markTabSwitch();

        // Clear any pending timer
        if (blurTimerRef.current) {
          clearTimeout(blurTimerRef.current);
        }
        
        blurTimerRef.current = setTimeout(() => {
          const stillBlurred = !document.hasFocus();
          if (stillBlurred && isViolationReady) {
            console.warn("[Violation] Window blur >2s");
            const duration = Date.now() - blurStartRef.current;
            logViolation("window_blur", {
              duration: `${duration}ms`,
              gracePeriod: "2000ms",
              hasFocus: document.hasFocus(),
            });
          }
          blurTimerRef.current = null;
        }, 2000);
      }
    };

    const handleFocus = () => {
      if (blurStartRef.current) {
        const duration = Date.now() - blurStartRef.current;
        setTotalBlurTime((prev) => prev + duration);
        blurStartRef.current = null;
      }
      switchActiveRef.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurStartRef.current = Date.now();
        markTabSwitch();

        // Cancel blur timer since visibility handles this better
        if (blurTimerRef.current) {
          clearTimeout(blurTimerRef.current);
          blurTimerRef.current = null;
        }
        
        // Clear any pending timer
        if (visibilityTimerRef.current) {
          clearTimeout(visibilityTimerRef.current);
        }
        
        visibilityTimerRef.current = setTimeout(() => {
          if (document.hidden && isViolationReady) {
            console.warn("[Violation] Page hidden >2s");
            const duration = Date.now() - blurStartRef.current;
            logViolation("tab_switch", {
              duration: `${duration}ms`,
              gracePeriod: "2000ms",
              pageHidden: document.hidden,
              visibilityState: document.visibilityState,
            });
          }
          visibilityTimerRef.current = null;
        }, 2000);
      } else if (blurStartRef.current) {
        const duration = Date.now() - blurStartRef.current;
        setTotalBlurTime((prev) => prev + duration);
        blurStartRef.current = null;
        switchActiveRef.current = false;
        ignoreNextBlurRef.current = false;
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      
      // Clear pending timers on cleanup
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      if (visibilityTimerRef.current) clearTimeout(visibilityTimerRef.current);
    };
  }, [isViolationReady, setviolation]);

  // --- Mouse leave detection (grace period: 2s) ---
  useEffect(() => {
    const handleMouseLeave = (e) => {
      // Ignore internal movements; trigger only if pointer leaves viewport
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        hoverLeaveStartRef.current = Date.now();
        
        // Capture mouse position before timeout
        const mousePosition = { x: e.clientX, y: e.clientY };
        
        // Clear any pending timer
        if (mouseLeaveTimerRef.current) {
          clearTimeout(mouseLeaveTimerRef.current);
        }
        
        mouseLeaveTimerRef.current = setTimeout(() => {
          const stillOutside = Date.now() - hoverLeaveStartRef.current > 2000;
          if (stillOutside && isViolationReady) {
            console.warn("[Violation] Mouse left screen >2s");
            const duration = Date.now() - hoverLeaveStartRef.current;
            logViolation("mouse_leave", {
              duration: `${duration}ms`,
              gracePeriod: "2000ms",
              lastPosition: mousePosition,
            });
            setviolation((prev) => prev + 1);
            setHoverLeaveCount((prev) => prev + 1);
          }
          mouseLeaveTimerRef.current = null;
        }, 2000);
      }
    };

    const handleMouseEnter = () => {
      if (hoverLeaveStartRef.current) {
        const duration = Date.now() - hoverLeaveStartRef.current;
        setTotalHoverLeaveTime((prev) => prev + duration);
        hoverLeaveStartRef.current = null;
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      
      // Clear pending timer on cleanup
      if (mouseLeaveTimerRef.current) clearTimeout(mouseLeaveTimerRef.current);
    };
  }, [isViolationReady, setviolation]);

  // --- Key press detection when page not focused ---
  useEffect(() => {
    const handleKeyDown = () => {
      if (document.hidden || !document.hasFocus()) {
        setKeypressCount((prev) => prev + 1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- Time formatting helper ---
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // --- Optional Debug / Exam Stats UI ---
  return (
    <div style={{ display: "none" }}>
      {/* Hidden tracker - uncomment for debug view */}
      {/* <button onClick={toggleFullscreen}>
        {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      </button>

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: isFullscreen ? "100vh" : "400px",
          background: "#111",
          color: "#0f0",
          padding: "20px",
          marginTop: "20px",
          overflow: "auto",
        }}
      >
        <h2>Fullscreen Tracker (Debug Mode)</h2>
        <p>Fullscreen Exits: {exitCount}</p>
        <p>Tab Switches: {switchCount}</p>
        <p>Total Blur Time: {formatTime(totalBlurTime)}</p>
        <p>Mouse Leave Count: {hoverLeaveCount}</p>
        <p>Total Mouse Leave Time: {formatTime(totalHoverLeaveTime)}</p>
        <p>Key Press (unfocused): {keypressCount}</p>
      </div> */}
    </div>
  );
};

export default FullscreenTracker;
