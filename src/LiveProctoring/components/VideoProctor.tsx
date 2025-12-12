import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, CameraOff, Play, Pause, RotateCcw } from 'lucide-react';
import { usePersonDetection } from '../hooks/usePersonDetection';
import { VideoCanvas } from './VideoCanvas';
import { AlertPanel } from './AlertPanel';
import { StatsPanel } from './StatsPanel';
import { DetectionResult, ProctoringStatus, AlertMessage } from '../types/proctoring';

export const VideoProctor: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { detectPersons, isLoading, error, modelReady } = usePersonDetection();

  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isProctoringActive, setIsProctoringActive] = useState(false);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);
  const [status, setStatus] = useState<ProctoringStatus>({
    personCount: 0,
    violations: { multiplePerson: 0, noPerson: 0, total: 0 },
    sessionStartTime: new Date(),
    isActive: false
  });

  const addAlert = useCallback((type: AlertMessage['type'], message: string) => {
    const newAlert: AlertMessage = {
      type,
      message,
      timestamp: new Date()
    };
    setAlerts(prev => [...prev, newAlert]);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreamActive(true);
        addAlert('success', 'Camera started successfully');
      }
    } catch (err) {
      console.error('Camera access error:', err);
      addAlert('error', 'Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
    setIsProctoringActive(false);
    addAlert('warning', 'Camera stopped');
  };

  const startProctoring = () => {
    if (!isStreamActive || !modelReady) return;
    
    setIsProctoringActive(true);
    setStatus(prev => ({
      ...prev,
      isActive: true,
      sessionStartTime: new Date()
    }));
    addAlert('success', 'Proctoring session started');
  };

  const stopProctoring = () => {
    setIsProctoringActive(false);
    setStatus(prev => ({ ...prev, isActive: false }));
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    addAlert('warning', 'Proctoring session stopped');
  };

  const resetSession = () => {
    setAlerts([]);
    setDetections([]);
    setStatus({
      personCount: 0,
      violations: { multiplePerson: 0, noPerson: 0, total: 0 },
      sessionStartTime: new Date(),
      isActive: isProctoringActive
    });
    addAlert('success', 'Session data reset');
  };

  const runDetection = useCallback(async () => {
    if (!videoRef.current || !isProctoringActive) return;

    const results = await detectPersons(videoRef.current);
    setDetections(results);
    
    const personCount = results.length;
    
    setStatus(prev => {
      const newViolations = { ...prev.violations };
      let alertAdded = false;

      if (personCount === 0 && prev.personCount !== 0) {
        newViolations.noPerson++;
        newViolations.total++;
        addAlert('error', 'No person detected in frame');
        alertAdded = true;
      } else if (personCount > 1 && prev.personCount <= 1) {
        newViolations.multiplePerson++;
        newViolations.total++;
        addAlert('warning', `Multiple persons detected (${personCount})`);
        alertAdded = true;
      } else if (personCount === 1 && prev.personCount !== 1 && !alertAdded) {
        addAlert('success', 'Single person detected - compliant');
      }

      return {
        ...prev,
        personCount,
        violations: newViolations
      };
    });
  }, [detectPersons, isProctoringActive, addAlert]);

  useEffect(() => {
    if (isProctoringActive) {
      intervalRef.current = setInterval(runDetection, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isProctoringActive, runDetection]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Video Proctoring System
          </h1>
          <p className="text-slate-600">
            Advanced person detection for secure online examinations
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800">Live Feed</h2>
                <div className="flex gap-2">
                  {!isStreamActive ? (
                    <button
                      onClick={startCamera}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      Start Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <CameraOff className="w-4 h-4" />
                      Stop Camera
                    </button>
                  )}
                  
                  {isStreamActive && (
                    <>
                      {!isProctoringActive ? (
                        <button
                          onClick={startProctoring}
                          disabled={!modelReady}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Play className="w-4 h-4" />
                          Start Proctoring
                        </button>
                      ) : (
                        <button
                          onClick={stopProctoring}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                          Stop Proctoring
                        </button>
                      )}
                      
                      <button
                        onClick={resetSession}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Video Container */}
              <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <VideoCanvas 
                  videoRef={videoRef}
                  detections={detections}
                  isActive={isProctoringActive}
                />
                
                {/* Loading/Status Overlay */}
                {(isLoading || !isStreamActive) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-75">
                    <div className="text-center text-white">
                      {isLoading ? (
                        <div>
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                          <p>Loading AI model...</p>
                        </div>
                      ) : !isStreamActive ? (
                        <p>Camera not active</p>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Status Indicator */}
                {isProctoringActive && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    MONITORING
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <StatsPanel status={status} />
            <AlertPanel alerts={alerts} personCount={status.personCount} />
          </div>
        </div>
      </div>
    </div>
  );
};