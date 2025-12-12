import React, { useState, useEffect, useRef, useCallback } from "react";
import Exam2 from "./Exam2";
import { database } from "../../firebase";
import { ref, get, set, child, push } from "firebase/database";
import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePersonDetection } from "../../LiveProctoring/hooks/usePersonDetection";
import { useWebRTCStream } from "../../LiveProctoring/hooks/useWebRTCStreamV2";
import { useAdminAudioReceiver } from "../../LiveProctoring/hooks/useAdminAudioReceiver";
import { VideoCanvas } from "../../LiveProctoring/components/VideoCanvas";

import FullscreenTracker from "../FullscreenTracker";
import LoadingPage from "../LoadingPage";
import { User } from "lucide-react";

const DynamicExam = () => {
  const [stage, setStage] = useState("loading"); // 'loading', 'instructions', 'exam', 'warning', 'completed', 'resume', 'blocked'
  const [Questions, setQuestions] = useState([]);
  const [examStatus, setExamStatus] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [violation, setviolation] = useState(null);
  const [isViolationReady, setIsViolationReady] = useState(false); // New state

  const [configdata, setConfigdata] = useState({});
  const [duration, setDuration] = useState(60 * 30); // New state
  const containerRef = useRef(null);

  const [showPermModal, setShowPermModal] = useState(false);
  const [camOK, setCamOK] = useState(null);
  const [micOK, setMicOK] = useState(null);
  const [permError, setPermError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const [permVerified, setPermVerified] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [detections, setDetections] = useState([]);
  const detectionIntervalRef = useRef(null);
  const proctorStreamRef = useRef(null);
  const [proctorStream, setProctorStream] = useState(null);
  const screenStreamRef = useRef(null);
  const [screenStream, setScreenStream] = useState(null);
  const noPersonStartTime = useRef(null);
  const multiPersonStartTime = useRef(null);
  const violationTriggered = useRef({ noPerson: false, multiPerson: false });
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [proctorSettings, setProctorSettings] = useState({
    enableVideoProctoring: true,
    enableFullscreen: true,
    blockOnViolations: false
  });

  const { detectPersons, isLoading: aiLoading, error: aiError, modelReady } = usePersonDetection();

  const { testid } = useParams();

  const { user } = useAuth();

  // WebRTC livestream to admin - use state instead of ref with dual streams (camera + screen)
  const { isStreaming, connectionStatus, activeConnections } = useWebRTCStream(
    testid,
    user?.uid,
    proctorStream,
    screenStream,
    stage === "exam" && proctorSettings.enableVideoProctoring
  );

  // Admin audio receiver - allows admin to speak to this student
  // Active at any time after permissions are granted (not just during exam)
  const { isReceivingAudio, adminConnectionStatus } = useAdminAudioReceiver(
    testid,
    user?.uid,
    permVerified && (stage === "exam" || stage === "instructions" || stage === "resume") // Allow admin audio after permissions granted
  );

  const [examName, setExamName] = useState(null);
  const [results, setResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    console.log(isViolationReady);
  }, [isViolationReady]);

  // Debug logging for streaming
  useEffect(() => {
    console.log('[DynamicExam] Streaming status:', {
      isStreaming,
      connectionStatus,
      activeConnections,
      hasProctorStream: !!proctorStream,
      stage,
      enableVideoProctoring: proctorSettings.enableVideoProctoring
    });
  }, [isStreaming, connectionStatus, activeConnections, proctorStream, stage, proctorSettings.enableVideoProctoring]);

  // Debug logging for admin audio
  useEffect(() => {
    console.log('[DynamicExam] Admin audio status:', {
      isReceivingAudio,
      adminConnectionStatus,
      permVerified,
      stage,
      userId: user?.uid,
      testid
    });
  }, [isReceivingAudio, adminConnectionStatus, permVerified, stage, user?.uid, testid]);

  // Function to check exam status
  const checkExamStatus = async (allowResume = true) => {
    try {
      const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}`);
      const statusSnapshot = await get(statusRef);


      const examStatusRef = ref(database, `Exam/${testid}/Properties/status`);
      const examstatus = await get(examStatusRef);
      console.log(examstatus.val());

      const examPropertiesRef = ref(database, `Exam/${testid}/Properties`);
      const examPropertiesSnapshot = await get(examPropertiesRef);
      const examProperties = examPropertiesSnapshot.exists() ? examPropertiesSnapshot.val() : {};

      const durationFallbackSnapshot = await get(ref(database, `Exam/${testid}/duration`));
      const durationValue = examProperties?.duration ?? durationFallbackSnapshot.val() ?? duration;
      const durationMinutes = Number(durationValue) || 60;

      if (examstatus.val().toLowerCase() === "completed") {
        setStage("completed");
        return true;
      }

      if (statusSnapshot.exists()) {
        const statusData = statusSnapshot.val();
        const statusString = typeof statusData === "string" ? statusData : statusData?.status;
        const isCompleted = typeof statusString === "string" && statusString.toLowerCase() === "completed";
        const progressData = typeof statusData === "object" && statusData !== null ? statusData : {};
        const userStartTime = progressData.startTime || examProperties?.startTime;

        if (!isCompleted && userStartTime) {
          const startTimeDate = new Date(userStartTime);
          const elapsedMinutes = (Date.now() - startTimeDate.getTime()) / 60000;

          if (elapsedMinutes >= durationMinutes) {
              const examRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}/status`);
            await set(examRef, "completed");
            await markExamCompleted();
            return true;
          }
        }

        // If exam is completed
        if (isCompleted || progressData.completed === true) {
          setStage("completed");
          return true;
        }

        // If exam is blocked
        if (typeof statusString === "string" && statusString.toLowerCase() === "blocked") {
          setStage("blocked");
          return true;
        }



        console.log(statusData);

        // If exam was started but not completed
        if (progressData.startTime) {
          // Only trigger resume screen if allowed and not already in exam view
          if (allowResume && stage !== "exam") {
            setStage("resume");
          }
          setStartTime(progressData.startTime);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking exam status:", error);
      return false;
    }
  };

  const showToastNotification = useCallback((message) => {
    setToastMsg(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  }, []);

  // --- Log violation to Firebase ---
  const logViolation = useCallback(async (reason, details = {}) => {
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
  }, [testid, user]);

  const runDetection = useCallback(async () => {
    if (!videoRef.current || stage !== "exam" || !proctorStreamRef.current) return;
    const results = await detectPersons(videoRef.current);
    setDetections(results);
    const personCount = results.length;
    const now = Date.now();

    if (personCount === 0) {
      if (!noPersonStartTime.current) {
        noPersonStartTime.current = now;
        violationTriggered.current.noPerson = false;
      } else {
        const duration = (now - noPersonStartTime.current) / 1000;
        if (duration >= 5 && !violationTriggered.current.noPerson) {
          showToastNotification("⚠️ No person detected for 5 seconds - Violation recorded");
          setviolation(prev => (prev || 0) + 1);
          logViolation("No Person Detected", {
            duration: `${duration.toFixed(1)} seconds`,
            personCount: 0,
            detectionTime: new Date().toISOString()
          });
          violationTriggered.current.noPerson = true;
        }
      }
      multiPersonStartTime.current = null;
      violationTriggered.current.multiPerson = false;
    } else if (personCount > 1) {
      if (!multiPersonStartTime.current) {
        multiPersonStartTime.current = now;
        violationTriggered.current.multiPerson = false;
      } else {
        const duration = (now - multiPersonStartTime.current) / 1000;
        if (duration >= 5 && !violationTriggered.current.multiPerson) {
          showToastNotification(`⚠️ Multiple persons detected for 5 seconds - Violation recorded`);
          setviolation(prev => (prev || 0) + 1);
          logViolation("Multiple Persons Detected", {
            duration: `${duration.toFixed(1)} seconds`,
            personCount: personCount,
            detectionTime: new Date().toISOString()
          });
          violationTriggered.current.multiPerson = true;
        }
      }
      noPersonStartTime.current = null;
      violationTriggered.current.noPerson = false;
    } else {
      noPersonStartTime.current = null;
      multiPersonStartTime.current = null;
      violationTriggered.current.noPerson = false;
      violationTriggered.current.multiPerson = false;
    }
  }, [detectPersons, stage, showToastNotification, setviolation]);

  useEffect(() => {
    // Only run video proctoring if enabled
    if (stage === "exam" && proctorStreamRef.current && proctorSettings.enableVideoProctoring) {
      if (videoRef.current && proctorStreamRef.current) {
        videoRef.current.srcObject = proctorStreamRef.current;
      }
      // Ensure state is updated for WebRTC streaming
      if (proctorStreamRef.current && !proctorStream) {
        setProctorStream(proctorStreamRef.current);
      }
      if (modelReady) {
        detectionIntervalRef.current = setInterval(runDetection, 1000);
      }
    } else {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      noPersonStartTime.current = null;
      multiPersonStartTime.current = null;
      violationTriggered.current = { noPerson: false, multiPerson: false };
    }
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [stage, modelReady, runDetection, proctorSettings.enableVideoProctoring, proctorStream]);

  const cleanupMedia = () => {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (analyserRef.current && analyserRef.current.disconnect) analyserRef.current.disconnect();
      analyserRef.current = null;
      if (audioCtxRef.current && audioCtxRef.current.close) audioCtxRef.current.close();
      audioCtxRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      streamRef.current = null;
      if (videoRef.current) {
        try { videoRef.current.srcObject = null; } catch (_) {}
      }
      // Cleanup screen share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
    } catch (_) {}
  };

  const startScreenShare = async () => {
    try {
      console.log('[ScreenShare] Requesting FULLSCREEN capture (entire monitor required)...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor', // Prefer entire monitor
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false,
        preferCurrentTab: false // Don't allow just current tab
      });
      
      console.log('[ScreenShare] Got screen stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`));
      
      // Validate that user shared entire screen/monitor, not just a window or tab
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getSettings) {
        const settings = videoTrack.getSettings();
        console.log('[ScreenShare] Track settings:', settings);
        
        const displaySurface = settings.displaySurface;
        console.log('[ScreenShare] Display surface:', displaySurface);
        
        // Check if it's a monitor (entire screen) share
        if (displaySurface === 'window' || displaySurface === 'browser') {
          console.error('[ScreenShare] User shared window/tab instead of full screen. Rejecting...');
          stream.getTracks().forEach(track => track.stop());
          setPermError('❌ You must share your ENTIRE SCREEN (not just a window or tab). Please try again and select "Entire Screen" or "Screen".');
          return false;
        }
        
        if (displaySurface !== 'monitor') {
          console.warn('[ScreenShare] Display surface is not "monitor", but continuing:', displaySurface);
          // Some browsers might not report 'monitor' exactly, so we'll allow if not window/browser
        }
      }
      
      screenStreamRef.current = stream;
      setScreenStream(stream);
      
      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('[ScreenShare] User stopped screen sharing');
        screenStreamRef.current = null;
        setScreenStream(null);
        
        // If screen sharing stops during exam, show warning and potentially block
        if (stage === 'exam') {
          setToastMsg('⚠️ Screen sharing stopped! You must share your screen to continue the exam.');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 5000);
          
          // Optionally force user back to permission screen
          setStage('warning');
        }
      });
      
      console.log('[ScreenShare] ✅ Fullscreen sharing validated and started');
      return true;
    } catch (error) {
      console.error('[ScreenShare] Error:', error);
      // User cancelled or error occurred
      if (error.name === 'NotAllowedError') {
        console.log('[ScreenShare] User denied screen share permission');
        setPermError('❌ Screen sharing is REQUIRED for this exam. Please grant permission to share your entire screen.');
      } else if (error.name === 'NotSupportedError') {
        setPermError('❌ Screen sharing is not supported in your browser. Please use Chrome, Edge, or Firefox.');
      } else {
        console.error('[ScreenShare] Screen share error:', error);
        setPermError('❌ Failed to start screen sharing. Please try again.');
      }
      return false;
    }
  };

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setVideoDevices(videoInputs);
      setAudioDevices(audioInputs);
      if (videoInputs.length > 0 && !selectedVideoDevice) setSelectedVideoDevice(videoInputs[0].deviceId);
      if (audioInputs.length > 0 && !selectedAudioDevice) setSelectedAudioDevice(audioInputs[0].deviceId);
    } catch (e) {
      console.error("Error enumerating devices:", e);
    }
  };

  const startPermissionCheck = async () => {
    setIsChecking(true);
    setPermError("");
    setCamOK(null);
    setMicOK(null);
    setAudioLevel(0);
    cleanupMedia();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media devices not supported");
      }
      
      // Enhanced video constraints for better quality
      const videoConstraints = selectedVideoDevice 
        ? {
            deviceId: { exact: selectedVideoDevice },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          }
        : {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          };
      
      const audioConstraints = selectedAudioDevice
        ? {
            deviceId: { exact: selectedAudioDevice },
            echoCancellation: true,
            noiseSuppression: true
          }
        : {
            echoCancellation: true,
            noiseSuppression: true
          };
      
      const constraints = {
        video: videoConstraints,
        audio: audioConstraints
      };
      
      console.log('[Camera] Requesting media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[Camera] Got stream with tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`));
      
      streamRef.current = stream;
      if (videoRef.current) {
        try { videoRef.current.srcObject = stream; } catch (_) {}
      }
      const vTrack = stream.getVideoTracks()[0];
      const aTrack = stream.getAudioTracks()[0];
      
      console.log('[Camera] Video track:', vTrack?.label, 'State:', vTrack?.readyState);
      console.log('[Camera] Audio track:', aTrack?.label, 'State:', aTrack?.readyState);
      
      setCamOK(Boolean(vTrack && vTrack.readyState === "live"));
      setMicOK(Boolean(aTrack && aTrack.readyState === "live"));

      await enumerateDevices();

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(100, Math.max(0, Math.round(rms * 180)));
        setAudioLevel(level);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error('[Camera] Error:', e);
      setPermError(e?.message || "Failed to access camera/microphone");
      setCamOK(false);
      setMicOK(false);
    } finally {
      setIsChecking(false);
    }
  };

  const openPermissionModal = async () => {
    setShowPermModal(true);
    setPermVerified(false);
    await enumerateDevices();
    startPermissionCheck();
  };

  const closePermissionModal = () => {
    setShowPermModal(false);
    cleanupMedia();
  };

  const continueAfterPermissions = async () => {
    // Only require camera/mic/AI if video proctoring is enabled
    if (proctorSettings.enableVideoProctoring) {
      if (!camOK || !micOK) {
        setPermError("Please allow both camera and microphone to continue");
        return;
      }
      if (!modelReady) {
        setPermError("AI model is still loading. Please wait...");
        return;
      }
    }
    // Save stream for proctoring but DON'T stop tracks
    proctorStreamRef.current = streamRef.current;
    setProctorStream(streamRef.current); // Update state to trigger WebRTC hook
    
    // Request screen sharing (REQUIRED for video proctoring - must share full screen)
    if (proctorSettings.enableVideoProctoring) {
      const screenShareSuccess = await startScreenShare();
      if (!screenShareSuccess) {
        // Screen share failed or user didn't share full screen - don't allow exam entry
        setPermError('❌ You must share your ENTIRE SCREEN to proceed with this exam. Click "Start Permission Check" to try again.');
        return; // Block exam entry
      }
    }
    
    // All permissions verified
    setPermVerified(true);
    
    // Keep video reference but don't cleanup
    setShowPermModal(false);
    
    const enterFullscreen = async () => {
      const element = containerRef.current || document.documentElement;
      try {
        if (element.requestFullscreen) return await element.requestFullscreen();
        // @ts-ignore - vendor prefixes for Safari/IE11
        if (element.webkitRequestFullscreen) return await element.webkitRequestFullscreen();
        // @ts-ignore
        if (element.msRequestFullscreen) return await element.msRequestFullscreen();
      } catch (err) {
        console.error("Fullscreen request failed:", err);
      }
    };

    const previousStage = stage;

    try {
      // Enter fullscreen first, then immediately show exam UI
      await enterFullscreen();

      // Ensure startTime is present locally before rendering Exam2 to avoid UI glitches
      if (!startTime) {
        const provisionalStart = new Date().toISOString();
        setStartTime(provisionalStart);
      }
      setStage("exam");

      // Perform status checks/writes in background without delaying UI
      (async () => {
        if (previousStage === "resume" || previousStage === "warning") {
          const isCompleted = await checkExamStatus(false);
          if (isCompleted) return; // checkExamStatus will set stage accordingly
          // already showing exam
        } else {
          const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}`);
          const statusSnapshot = await get(statusRef);
          if (statusSnapshot.exists()) {
            const data = statusSnapshot.val();
            if (data?.status === "completed" || data?.completed === true) {
              // If already completed, reflect that
              setStage("completed");
              return;
            }
          }
          if (!statusSnapshot.exists() || !statusSnapshot.val()?.startTime) {
            const timeToPersist = startTime || new Date().toISOString();
            await set(ref(database, `Exam/${testid}/Properties/Progress/${user.uid}`), {
              startTime: timeToPersist,
              status: "started"
            });
            if (!startTime) setStartTime(timeToPersist);
          }
        }
      })();
    } catch (error) {
      console.error("Failed to enter fullscreen:", error);
    }
  };

  const fetchDuration = async () => {
    try {
      const statusRef = ref(database, `Exam/${testid}/duration`);
      const statusSnapshot = await get(statusRef);

      if (statusSnapshot.exists()) {
        const statusData = statusSnapshot.val();

        setDuration(statusData);

        console.log(statusData);
      }
    } catch (error) {
      console.error("Error checking exam status:", error);
    }
  };








  const checkviolation = async () => {
    try {
      const violationRef = ref(database, `Exam/${testid}/Properties2/Progress/${user.uid}`);
      const violationSnapshot = await get(violationRef);

      if (violationSnapshot.exists()) {
        const violationData = violationSnapshot.val();
        setviolation(violationData);
      } else {
        setviolation(0);
      }
      setIsViolationReady(true); // Mark as ready
    } catch (error) {
      console.error("Error checking exam status:", error);
    }
  };

  useEffect(() => {
    const saveAndCheckViolations = async () => {
      // Only run if the initial violation count has been loaded.
      if (!isViolationReady) return;

      // Save the updated violation count to Firebase
      if (testid && user && violation !== null) {
        const violationRef = ref(database, `Exam/${testid}/Properties2/Progress/${user.uid}`);
        await set(violationRef, violation);
      }

      const currstage = ref(database, `Exam/${testid}/Properties2/Progress/${user.uid}/stage`);
      const currstageSnapshot = await get(currstage);

      // Check if the exam should be blocked (only if blockOnViolations is enabled)
      if (proctorSettings.blockOnViolations && violation >= 2 && currstageSnapshot.val() != "completed") {
        console.log(currstageSnapshot.val());
        markExamBlocked();
      }
    };

    saveAndCheckViolations();
  }, [violation, isViolationReady, testid, user, proctorSettings.blockOnViolations]);

  // Function to check exam duration
  const checkExamDuration = async () => {
    try {
      const examRef = ref(database, `Exam/${testid}/Properties`);
      const snapshot = await get(examRef);

      if (snapshot.exists()) {
        const examData = snapshot.val();
        const startTime = new Date(examData.startTime);
        const durationMinutes = examData.duration || 60; // Default 60 minutes if not set
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

        // Compare with current time
        if (new Date() > endTime) {
          await markExamCompleted();
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking exam duration:", error);
      return false;
    }
  };

  // Fetch question data and exam status from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check exam status first
        const isCompleted = await checkExamStatus();
        // if (isCompleted) return;

        fetchResults();

        const examname = await get(ref(database, `Exam/${testid}/name`));

        setExamName(examname.val());

        // Fetch proctoring settings
        const proctorSettingsRef = ref(database, `Exam/${testid}/proctorSettings`);
        const proctorSettingsSnapshot = await get(proctorSettingsRef);
        if (proctorSettingsSnapshot.exists()) {
          const settings = proctorSettingsSnapshot.val();
          setProctorSettings({
            enableVideoProctoring: settings.enableVideoProctoring === undefined ? true : settings.enableVideoProctoring,
            enableFullscreen: settings.enableFullscreen === undefined ? true : settings.enableFullscreen,
            blockOnViolations: settings.blockOnViolations === true
          });
        }

        const configdata = await get(ref(database, `Exam/${testid}/configure/questionsPerType`));
        setConfigdata(configdata.val());
        console.log(configdata.val());


        const myquestions = await get(ref(database, `Exam/${testid}/myquestions/${user.uid}`));

        if (myquestions.exists()) {
          setQuestions(myquestions.val());
        }
        else {

          // Load questions
          const questionRef = ref(database, `Exam/${testid}/questions`);
          const questionSnapshot = await get(questionRef);

          if (!questionSnapshot.exists()) {
            console.error('No questions found for this test');
            return;
          }

          const allQuestions = questionSnapshot.val();
          const questionConfig = await get(ref(database, `Exam/${testid}/configure/questionsPerType`));

          if (!questionConfig.exists()) {
            console.error('No question configuration found');
            return;
          }

          const config = questionConfig.val();
          let selectedQuestions = [];
          const questionList = Object.entries(allQuestions);

          // Create a map to track used question IDs
          const usedQuestionIds = new Set();
          let hasInsufficientQuestions = false;

          // First, validate we have enough questions for each type
          for (const [type, count] of Object.entries(config)) {
            const availableQuestions = questionList
              .filter(([_, qType]) => qType.toLowerCase() === type.toLowerCase())
              .filter(([id]) => !usedQuestionIds.has(id));

            if (availableQuestions.length < count) {
              console.warn(`Warning: Not enough questions of type ${type}. Requested: ${count}, Available: ${availableQuestions.length}`);
              hasInsufficientQuestions = true;
            }
          }

          // If we don't have enough questions, adjust the config to use what's available
          const effectiveConfig = hasInsufficientQuestions
            ? Object.fromEntries(
              Object.entries(config).map(([type, count]) => {
                const availableQuestions = questionList
                  .filter(([_, qType]) => qType.toLowerCase() === type.toLowerCase())
                  .filter(([id]) => !usedQuestionIds.has(id));
                return [type, Math.min(count, availableQuestions.length)];
              })
            )
            : config;

          // Now select questions based on the effective config
          for (const [type, count] of Object.entries(effectiveConfig)) {
            if (count <= 0) continue;

            // Get available questions of this type that haven't been selected yet
            const availableQuestions = questionList
              .filter(([_, qType]) => qType.toLowerCase() === type.toLowerCase())
              .filter(([id]) => !usedQuestionIds.has(id));

            if (availableQuestions.length === 0) {
              console.warn(`No available questions of type ${type} after filtering`);
              continue;
            }

            // Shuffle and select the required number of questions
            const shuffled = [...availableQuestions]
              .sort(() => Math.random() - 0.5);

            const selected = shuffled.slice(0, count);

            // Add selected questions to our results
            selectedQuestions = [
              ...selectedQuestions,
              ...selected.map(([id]) => id)
            ];

            // Mark these questions as used
            selected.forEach(([id]) => usedQuestionIds.add(id));

            console.log(`Selected ${selected.length} questions of type ${type}`);
          }

          // Save selected questions to user's test
          if (selectedQuestions.length > 0) {
            await set(ref(database, `Exam/${testid}/myquestions/${user.uid}`), selectedQuestions);
            setQuestions(selectedQuestions);
          } else {
            console.error('No questions selected based on configuration');
          }

        }




        await checkviolation();

        // Only move to next stage after all data is loaded
        setStage(prev => prev === "loading" ? "instructions" : prev);
      } catch (error) {
        console.error("Error fetching data:", error);
        setStage("instructions"); // Fallback
      }
    };

    if (testid) fetchData();

    fetchDuration();

  }, [testid]);

  useEffect(() => {
    const handleFullScreenChange = async () => {
      const isFullScreen = document.fullscreenElement !== null;

      // Always enforce fullscreen during exam
      if (!isFullScreen && stage === "exam") {
        // Exit from full screen during exam - check exam status first
        console.log("Exited full screen, checking exam status...");

        const isCompleted = await checkExamStatus();
        if (!isCompleted) {
          // Always show warning when exiting fullscreen
          setStage("warning");
        }
        // If exam is completed, checkExamStatus will have already set stage to "completed"
      }
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, [stage, testid]);

  useEffect(() => {
    const checkDuration = async () => {
      const isExpired = await checkExamDuration();
      if (isExpired) {
        const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}`);
        await set(statusRef, "completed");
        setStage("completed");
        fetchResults();
      }
    };

    if (stage === "exam") {
      checkDuration();
    }

  }, [stage]);

  const startExam = async () => {
    try {
      // Only require permission modal if video proctoring is enabled
      if (proctorSettings.enableVideoProctoring && !permVerified) {
        openPermissionModal();
        return;
      }
      // Check exam status first
      const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}`);
      const statusSnapshot = await get(statusRef);

      // If exam was already started but not completed, show resume screen
      if (statusSnapshot.exists() && statusSnapshot.val().startTime && !statusSnapshot.val().completed) {
        console.log("meow")
        setStage("resume");
        return;
      }

      // Check if exam is already completed
      if (statusSnapshot.exists() && (statusSnapshot.val().status === "completed" || statusSnapshot.val().completed === true)) {
        return;
      }

      // Store exam start time in Firebase and local state
      const currentTime = new Date().toISOString();
      await set(ref(database, `Exam/${testid}/Properties/Progress/${user.uid}`), {
        startTime: currentTime,
        status: "started"
      });
      setStartTime(currentTime);

      // Always request fullscreen, but violations only tracked if enabled
      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
      setStage("exam");
    } catch (error) {
      console.error("Failed to enter fullscreen:", error);
    }
  };

  const returnToFullScreen = async () => {
    try {
      // Only require permission modal if video proctoring is enabled
      if (proctorSettings.enableVideoProctoring && !permVerified) {
        openPermissionModal();
        return;
      }
      // Check exam status before returning to full screen
      const isCompleted = await checkExamStatus();
      if (isCompleted) {
        return; // Don't return to exam if it's already completed
      }

      // Always request fullscreen, but violations only tracked if enabled
      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
      setStage("exam");
    } catch (error) {
      console.error("Failed to re-enter fullscreen:", error);
    }
  };

  // Function to fetch exam results
  const fetchResults = async () => {
    if (!user?.uid) return;

    setLoadingResults(true);
    try {
      // Get student's assigned questions
      const studentQuestionsRef = ref(database, `Exam/${testid}/myquestions/${user.uid}`);
      const studentQuestionsSnapshot = await get(studentQuestionsRef);
      // const studentQuestions = studentQuestionsSnapshot.val() || {};
      const questionIds = studentQuestionsSnapshot.val() || [];

      // Get student's answers
      const answersRef = ref(database, `ExamSubmissions/${testid}/${user.uid}`);
      const answersSnapshot = await get(answersRef);
      const answers = answersSnapshot.val() || {};

      const marksRef = ref(database, `Marks/${testid}/${user.uid}`);
      const marksSnapshot = await get(marksRef);
      const marks = marksSnapshot.val() || {};


      console.log(questionIds);
      console.log(answers);
      console.log(marks);

      // Calculate score
      let correctCount = 0;
      const questionDetails = [];
      let totalMarks = 0;

      for (const questionId of questionIds) {
        const isCorrect = answers[questionId] === "true";
        if (isCorrect) correctCount++;

        // Get question type
        const questionTypeRef = ref(database, `questions/${questionId}/type`);
        const questionTypeSnapshot = await get(questionTypeRef);
        const questionType = questionTypeSnapshot.val() || 'mcq';

        console.log( marks[questionId]||0 );

        questionDetails.push({
          id: questionId,
          correct: isCorrect,
          type: questionType,
          mark: marks[questionId] || 0
        });
          totalMarks += marks[questionId] || 0;
        }

      

      // Calculate score percentage
      const score = questionIds.length > 0
        ? Math.round(( totalMarks / questionIds.length) )
        : 0;
      
      

      setResults({
        score,
        correctCount,
        totalQuestions: questionIds.length,
        questions: questionDetails,
        totalMarks
      });
    } catch (error) {
      console.error("Error fetching results:", error);
    } finally {
      setLoadingResults(false);
    }
  };

  // Function to mark exam as completed (call this from Exam2 component when exam is finished)
  const markExamCompleted = async () => {
    try {
      const statusRef = ref(database, `ExamSubmissions/${testid}/status`);
      await set(statusRef, "completed");
      setExamStatus("completed");
      setStage("completed");
      fetchResults();
    } catch (error) {
      console.error("Error marking exam as completed:", error);
    }
  };

  // Function to mark exam as blocked due to violations
  const markExamBlocked = async () => {
    try {
      const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}/status`);
      const statusRefSnapshot = await get(statusRef);
      console.log( statusRefSnapshot.val());
      const examstatus = ref(database, `Exam/${testid}/Properties/status`);
      const examstatusSnapshot = await get(examstatus);
      if (examstatusSnapshot.val().toLowerCase() === "completed" || (statusRefSnapshot.exists() && statusRefSnapshot.val() === "completed")) {

        const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}/status`);
        await set(statusRef, "completed");

        setStage("completed");
        fetchResults();
        return;
      }
      console.log("2 my block")
      setStage("blocked");
      await set(statusRef, "blocked");


    } catch (error) {
      console.error("Error marking exam as blocked:", error);
    }
  };

  return (
    <div ref={containerRef} className="h-screen bg-gray-100 dark:bg-gray-900">
      {stage === "loading" && (
        <LoadingPage message="Loading exam, please wait..." />
      )}

      {stage === "instructions" && (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4">
              <h1 className="text-2xl font-bold text-white">Exam Instructions</h1>
              <p className="text-blue-100">Please read the instructions carefully before starting</p>
            </div>

            <div className="p-6 md:p-8">
              {/* Exam Overview */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{examName || 'Loading Exam...'}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Duration:</span> {duration ? `${Math.floor(duration)} minutes` : 'Loading...'}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-medium">Questions:</span> {Questions?.length || 0} total
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Question Types:</h4>
                    {configdata && (
                      <div className="space-y-1">
                        {Object.entries(configdata).map(([type, count]) => (
                          count > 0 && (
                            <div key={type} className="flex justify-between items-center">
                              <span className="text-gray-700 dark:text-gray-300">{type}</span>
                              <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full">
                                {count} {count === 1 ? 'question' : 'questions'}
                              </span>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Important Instructions</h3>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>This exam must be taken in full-screen mode. The test will automatically start in full-screen.</span>
                  </li>
                  {proctorSettings.enableFullscreen && (
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Exiting full screen will be tracked as a violation. Multiple violations may result in exam termination.</span>
                    </li>
                  )}
                  {proctorSettings.enableVideoProctoring && (
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Video proctoring is enabled. Your camera will monitor for multiple persons or no person during the exam.</span>
                    </li>
                  )}
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                    <span>Do not refresh the page or switch tabs during the exam, as this may be flagged as suspicious activity.</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Your progress is automatically saved. You can resume the exam if you get disconnected.</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <button
                  onClick={proctorSettings.enableVideoProctoring ? openPermissionModal : startExam}
                  className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Exam Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "exam" && (
        <>
          <FullscreenTracker violation={violation} setviolation={setviolation} setIsViolationReady={setIsViolationReady} isViolationReady={isViolationReady} testid={testid} enableViolationTracking={proctorSettings.enableFullscreen} />
          <Exam2
            setviolation={setviolation}
            setIsViolationReady={setIsViolationReady}
            Questions={Questions}
            onExamComplete={markExamCompleted}
            startTime={startTime}
            duration={duration}
            examName={examName}
            videoRef={videoRef}
            detections={detections}
            isProctoringActive={proctorSettings.enableVideoProctoring && !!proctorStreamRef.current}
          />
          {/* Admin Audio Indicator - shows when admin is speaking */}
          {isReceivingAudio && (
            <div className="fixed top-4 right-4 z-50">
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg bg-blue-600 text-white animate-pulse">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">Admin is speaking</span>
              </div>
            </div>
          )}
        </>
      )}

      {stage === "warning" && (
            <>
              <FullscreenTracker violation={violation} setviolation={setviolation} testid={testid} isViolationReady={isViolationReady} enableViolationTracking={proctorSettings.enableFullscreen} />
              <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-900">
                <div className="w-full max-w-3xl mx-auto p-8 rounded-xl shadow-lg bg-white dark:bg-gray-800 text-center space-y-6">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{examName}</h1>
                  {/* <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300">{Questions.length} {Questions[0].type} questions, {violation} violations</p> */}
                  <p className="text-sm text-gray-500">You exited fullscreen mode. Please return to fullscreen to continue your test.</p>
                  <button
                    onClick={proctorSettings.enableVideoProctoring ? openPermissionModal : returnToFullScreen}
                    className="px-6 py-3 rounded-md font-semibold text-white transition-colors bg-red-600 hover:bg-red-700"
                  >
                    Return to Fullscreen
                  </button>
                </div>
              </div>
            </>
          )}

      {stage === "resume" && (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="w-full max-w-lg mx-auto">
            {/* Main Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              
              {/* Header with Icon */}
              <div className="bg-yellow-50 dark:bg-yellow-900/10 px-6 py-8 border-b border-yellow-100 dark:border-yellow-900/20">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Exam Paused</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{examName}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* User Info */}
                <div>
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">{user?.name || 'User'}</span>
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Your exam has been paused. Click below to resume and continue from where you left off.
                  </p>
                </div>

                {/* Exam Details */}
                {configdata && Object.entries(configdata).some(([_, count]) => count > 0) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-3">Exam Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(configdata).map(([type, count]) => (
                        count > 0 && (
                          <div key={type} className="bg-gray-50 dark:bg-gray-900/50 rounded-md px-3 py-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{type.toLowerCase()}</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{count} {count === 1 ? 'Q' : 'Qs'}</p>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Resume Button */}
                <div className="pt-4">
                  <button
                    onClick={proctorSettings.enableVideoProctoring ? openPermissionModal : returnToFullScreen}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Resume Exam</span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Your progress has been saved
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "blocked" && (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="w-full max-w-lg mx-auto">
            {/* Main Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              
              {/* Header with Icon */}
              <div className="bg-red-50 dark:bg-red-900/10 px-6 py-8 border-b border-red-100 dark:border-red-900/20">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{examName}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-4">
                {/* User Message */}
                <div>
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">{user?.name || 'User'}</span>,
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Your access to this exam has been restricted due to violation of exam policies.
                  </p>
                </div>

                {/* Reason Box */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border-l-4 border-red-500">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Reason:</span> Maximum allowed violations exceeded
                  </p>
                </div>

                {/* Exam Details (if available) */}
                {configdata && Object.entries(configdata).some(([_, count]) => count > 0) && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-3">Exam Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(configdata).map(([type, count]) => (
                        count > 0 && (
                          <div key={type} className="bg-gray-50 dark:bg-gray-900/50 rounded-md px-3 py-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{type.toLowerCase()}</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{count} {count === 1 ? 'Q' : 'Qs'}</p>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Steps */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-2">Next Steps</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please contact your administrator or exam coordinator for assistance.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Need help?</span>
                  <a href="mailto:support@algocore.com" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    support@algocore.com
                  </a>
                </div>
              </div>
            </div>

            {/* Back to Dashboard Link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => window.location.href = '/'}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "completed" && (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
          <div className="w-full max-w-2xl mx-auto">
            {/* Main Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              
              {/* Header */}
              <div className="bg-green-50 dark:bg-green-900/10 px-6 py-8 border-b border-green-100 dark:border-green-900/20">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Exam Completed</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{examName}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-6">
                {/* User Greeting */}
                <div>
                  <p className="text-gray-700 dark:text-gray-300">
                    Congratulations <span className="font-medium text-gray-900 dark:text-white">{user?.name || 'User'}</span>!
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    You have successfully completed the exam. Your results are shown below.
                  </p>
                </div>

            {loadingResults ? (
              <div className="py-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Calculating your results...</p>
              </div>
            ) : results ? (
              <>
                {/* Results Summary */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-4">Your Results</p>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {results.score}%
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Correct</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {results.correctCount}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {results.totalQuestions}
                      </p>
                    </div>
                  </div>

                  {results.questions && results.questions.length > 0 && (
                    <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-3">Question Breakdown</p>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {results.questions.map((q, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Q{index + 1}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {q.type} • {q.mark || 0} pts
                              </p>
                            </div>
                            <span 
                              className={`ml-2 px-3 py-1 text-xs font-medium rounded-full ${
                                q.correct
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : q.mark > 0 
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' 
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              }`}
                            >
                              {q.correct ? '✓' : q.mark > 0 ? '~' : '✗'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Exam Info */}
                {configdata && Object.entries(configdata).some(([_, count]) => count > 0) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-3">Exam Summary</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(configdata).map(([type, count]) => (
                        count > 0 && (
                          <div key={type} className="bg-gray-50 dark:bg-gray-900/50 rounded-md px-3 py-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{type.toLowerCase()}</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{count} {count === 1 ? 'Q' : 'Qs'}</p>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">Unable to load results. Please check your dashboard later.</p>
              </div>
            )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  View detailed results anytime in your dashboard
                </p>
              </div>
            </div>

            {/* Back to Dashboard Link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => window.location.href = '/'}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl animate-bounce">
          {toastMsg}
        </div>
      )}

      {showPermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden my-4 sm:my-8 max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-blue-600 dark:bg-blue-700 border-b border-blue-700 dark:border-blue-800 flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-semibold text-white">Device Verification & Screen Sharing</h2>
              <p className="text-blue-100 text-xs sm:text-sm mt-1">Verify your camera, microphone, AI model, and enable full screen sharing</p>
            </div>

            {/* Important Notice */}
            <div className="px-4 sm:px-6 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 flex-shrink-0">
              <div className="flex items-start gap-2 sm:gap-3">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-orange-800 dark:text-orange-300">
                    ⚠️ IMPORTANT: Share ENTIRE SCREEN
                  </p>
                  <p className="text-[10px] sm:text-xs text-orange-700 dark:text-orange-400 mt-1">
                    Select "Entire Screen" or "Screen". Window/tab sharing will be rejected.
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-x-auto">
              <div className="flex items-center justify-center gap-2 sm:gap-4 min-w-max mx-auto">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold ${camOK ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    {camOK ? '✓' : '1'}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">Camera</span>
                </div>
                <div className={`h-0.5 w-4 sm:w-8 ${camOK ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold ${micOK ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    {micOK ? '✓' : '2'}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">Mic</span>
                </div>
                <div className={`h-0.5 w-4 sm:w-8 ${modelReady ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold ${modelReady ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    {modelReady ? '✓' : '3'}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">AI</span>
                </div>
                <div className={`h-0.5 w-4 sm:w-8 ${screenStream ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold ${screenStream ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    {screenStream ? '✓' : '4'}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">Screen</span>
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Camera Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">Camera</label>
                      <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${camOK ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : camOK === false ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {camOK ? '✓ Connected' : camOK === false ? '✗ Blocked' : 'Checking...'}
                      </span>
                    </div>
                  
                  {videoDevices.length > 0 && (
                    <select 
                      value={selectedVideoDevice} 
                      onChange={(e) => { setSelectedVideoDevice(e.target.value); setTimeout(startPermissionCheck, 100); }}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {videoDevices.map((device, idx) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="relative aspect-video w-full bg-gray-900 rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {isChecking && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="text-white text-center">
                          <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-sm">Initializing...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                  {/* Microphone Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">Microphone</label>
                      <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium ${micOK ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : micOK === false ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {micOK ? '✓ Connected' : micOK === false ? '✗ Blocked' : 'Checking...'}
                      </span>
                    </div>

                  {audioDevices.length > 0 && (
                    <select 
                      value={selectedAudioDevice} 
                      onChange={(e) => { setSelectedAudioDevice(e.target.value); setTimeout(startPermissionCheck, 100); }}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {audioDevices.map((device, idx) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="space-y-3">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Audio Level</p>
                      <div className="h-8 sm:h-10 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden relative">
                        <div className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-150" style={{ width: `${audioLevel}%` }}></div>
                      </div>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2">Speak to test microphone</p>
                    </div>

                    {/* AI Model Status */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">AI Proctoring Model</p>
                      <div className="flex items-center gap-2">
                        {aiLoading && (
                          <>
                            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Loading model...</span>
                          </>
                        )}
                        {aiError && (
                          <>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs sm:text-sm text-red-600">Error: {aiError}</span>
                          </>
                        )}
                        {modelReady && (
                          <>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs sm:text-sm text-green-600 font-medium">Model Ready</span>
                          </>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {permError && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-300">
                    <p className="text-xs sm:text-sm">{permError}</p>
                  </div>
                )}

                {/* Success Message */}
                {camOK && micOK && modelReady && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <p className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-200">✓ All devices ready</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 flex-shrink-0">
              <button 
                onClick={startPermissionCheck} 
                disabled={isChecking} 
                className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isChecking ? "Testing..." : "Retest"}
              </button>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                <button 
                  onClick={closePermissionModal} 
                  className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={continueAfterPermissions} 
                  disabled={proctorSettings.enableVideoProctoring && (!camOK || !micOK || !modelReady)} 
                  className="w-full sm:w-auto px-5 py-2 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Start Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicExam;