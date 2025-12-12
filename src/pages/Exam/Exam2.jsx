import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';

import { languageTemplates } from '../constants';

import { motion, AnimatePresence } from 'framer-motion';
import { VideoCanvas } from '../../LiveProctoring/components/VideoCanvas';

import { database } from "../../firebase";
import { ref, get, set, child, onValue, off } from "firebase/database";
import { Wifi, WifiOff  } from "lucide-react";



import {
    FiCheck,
    FiX,
    FiAlertTriangle,
    FiPlay,
    FiFileText,
    FiCode,
    FiTerminal,
    FiChevronLeft,
    FiChevronRight,
    FiCheckCircle,
    FiXCircle,
    FiMaximize,
    FiMinimize,
    FiRadio,
    FiSun,
    FiMoon
} from 'react-icons/fi';
import DynamicComponent from './DynamicComponent';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';


const Exam2 = ({ Questions, startTime, onExamComplete, duration, examName, setviolation, setIsViolationReady, videoRef, detections, isProctoringActive }) => {

    const { testid } = useParams();
    const { theme, toggleTheme } = useTheme();
    const [answeredQuestions, setAnsweredQuestions] = useState({});
    const [activeTab, setActiveTab] = useState('description');










    const [timeLeft, setTimeLeft] = useState(() => {

        console.log(startTime);


        if (!startTime) return null;



        const examDuration = 60 * duration;



        const start = new Date(startTime);
        const now = new Date();
        console.log('Start Time:', start);
        console.log('Current Time:', now);
        const elapsedSeconds = Math.floor((now - start) / 1000);
        console.log('Elapsed Seconds:', elapsedSeconds);
        const remaining = Math.max(0, examDuration - elapsedSeconds);
        console.log('Remaining Time:', remaining);
        return remaining;
    });

    const { user } = useAuth();




    useEffect(() => {
        if (!user || !testid) return;

        const answersRef = ref(database, `ExamSubmissions/${testid}/${user.uid}/`);

        // Set up the real-time listener
        const unsubscribe = onValue(answersRef, (snapshot) => {
            if (snapshot.exists()) {
                const answers = snapshot.val();
                setAnsweredQuestions(answers || {});
            }
        }, (error) => {
            console.error("Error in real-time listener:", error);
        });

        // Clean up the listener when the component unmounts or dependencies change
        return () => {
            off(answersRef, 'value');
        };
    }, [testid, user]);





    // Handle question change
    const handleQuestionChange = useCallback((index) => {

        console.log(index);

        console.log(Questions.length);


        if (!Questions || index < 0 || index >= Questions.length) {
            console.error('Invalid question index or test data not loaded');
            return;
        }

        setActiveQuestion(index);

        // Get the current question
        const question = Questions[index];


        // Scroll to top when changing questions
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const goToQuestion = useCallback((index) => {
        handleQuestionChange(index);
        setActiveTab('description');
        setIsMenuOpen(false);
    }, [handleQuestionChange]);


    const handleSubmitExam = async () => {
        setIsSubmitting(true);
        try {
            // First, mark the exam as completed in Firebase
            const examRef = ref(database, `Exam/${testid}/Properties/Progress/${user.uid}/status`);
            await set(examRef, "completed");

            // Then update the local violation state
            setviolation(0);
            setIsViolationReady(false);

            // Also update the stage to prevent blocking
            const stageRef = ref(database, `Exam/${testid}/Properties2/Progress/${user.uid}/`);
            await set(stageRef, 0);

            setShowSubmitModal(false);
            onExamComplete && onExamComplete();
        } catch (error) {
            console.error("Error submitting exam:", error);
            alert("There was an error submitting the exam. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitExam = () => {
        setShowSubmitModal(true);
    };

    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [networkSpeed, setNetworkSpeed] = useState(null);
    const [connectionType, setConnectionType] = useState('4g');

    // Measure actual network speed with a small test
    const measureActualSpeed = useCallback(async () => {
        if (!navigator.onLine) return null;
        
        try {
            // Use a small image for speed test
            const imageSize = 100000; // 100KB
            const testUrl = `https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png?t=${Date.now()}`;
            
            const startTime = performance.now();
            const response = await fetch(testUrl, { 
                cache: 'no-store'
            });
            await response.blob(); // Actually download the content
            const endTime = performance.now();
            
            const durationSeconds = (endTime - startTime) / 1000;
            if (durationSeconds > 0) {
                const speedBps = (imageSize * 8) / durationSeconds;
                const speedMbps = speedBps / (1024 * 1024);
                console.log('Measured speed:', speedMbps.toFixed(2), 'Mbps');
                return Math.max(0.1, Math.min(speedMbps, 100)); // Clamp between 0.1 and 100
            }
            return null;
        } catch (error) {
            console.log('Speed test failed:', error.message);
            return null;
        }
    }, []);

    // Get network speed from browser API or measure
    const getNetworkSpeed = useCallback(async () => {
        if (!navigator.onLine) {
            setNetworkSpeed(null);
            setConnectionType('offline');
            return;
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        // Update connection type for display
        if (connection && connection.effectiveType) {
            setConnectionType(connection.effectiveType);
        }

        // Try actual measurement first
        const measuredSpeed = await measureActualSpeed();
        
        if (measuredSpeed !== null) {
            console.log('Using measured speed:', measuredSpeed);
            setNetworkSpeed(measuredSpeed);
        } else if (connection && connection.downlink) {
            // Add some variance to make it more realistic (±10%)
            const variance = (Math.random() - 0.5) * 0.2;
            const adjustedSpeed = connection.downlink * (1 + variance);
            console.log('Using connection.downlink:', adjustedSpeed);
            setNetworkSpeed(Math.max(0.1, adjustedSpeed));
        } else if (connection && connection.effectiveType) {
            // Estimate based on effective type with variance
            const speedEstimates = {
                'slow-2g': 0.05,
                '2g': 0.25,
                '3g': 1.5,
                '4g': 10
            };
            const baseSpeed = speedEstimates[connection.effectiveType] || 1;
            const variance = (Math.random() - 0.5) * 0.3;
            const estimatedSpeed = Math.max(0.1, baseSpeed * (1 + variance));
            console.log('Using effectiveType estimate:', connection.effectiveType, estimatedSpeed);
            setNetworkSpeed(estimatedSpeed);
        } else {
            // Fallback: set a default speed if no method works
            console.log('No connection API, using default 5 Mbps');
            setNetworkSpeed(5);
        }
    }, [measureActualSpeed]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            getNetworkSpeed();
        };
        const handleOffline = () => {
            setIsOnline(false);
            setNetworkSpeed(null);
        };

        const handleConnectionChange = () => {
            getNetworkSpeed();
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Listen for connection changes
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            connection.addEventListener('change', handleConnectionChange);
        }

        // Initial speed check
        getNetworkSpeed();

        // Update speed every 10 seconds
        const speedInterval = setInterval(() => {
            if (navigator.onLine) {
                getNetworkSpeed();
            }
        }, 10000);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            if (connection) {
                connection.removeEventListener('change', handleConnectionChange);
            }
            clearInterval(speedInterval);
        };
    }, [getNetworkSpeed]);



    useEffect(() => {
        if (!startTime) return;

        // Calculate remaining time based on startTime and exam duration
        const calculateRemainingTime = () => {
            const examDuration = 60 * duration; // 30 minutes in seconds (adjust if you store duration elsewhere)
            const start = new Date(startTime);
            const now = new Date();
            const elapsedSeconds = Math.floor((now - start) / 1000);
            const remaining = Math.max(0, examDuration - elapsedSeconds);
            setTimeLeft(remaining);

            if (remaining <= 0) {
                onExamComplete();
            }
        };

        // Initial calculation
        calculateRemainingTime();

        // Update every second
        const timer = setInterval(calculateRemainingTime, 1000);

        return () => clearInterval(timer);
    }, [startTime, onExamComplete]);

    // Format time for display
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const menuRef = useRef(null);

    const [activeQuestion, setActiveQuestion] = useState(0);
    const [currentQuestionType, setCurrentQuestionType] = useState('');
    const [questionTypes, setQuestionTypes] = useState({});
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);


    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };



    }, []);


    useEffect(() => {

        console.log(Questions[0]);

    }, []);

    useEffect(() => {
        if (!Questions || Questions.length === 0) {
            if (Object.keys(questionTypes).length > 0) {
                setQuestionTypes({});
            }
            setCurrentQuestionType('');
            return;
        }

        const questionId = Questions[activeQuestion];
        if (!questionId) {
            setCurrentQuestionType('');
            return;
        }

        if (Object.prototype.hasOwnProperty.call(questionTypes, questionId)) {
            setCurrentQuestionType(questionTypes[questionId] || '');
        } else {
            setCurrentQuestionType('');
        }
    }, [Questions, activeQuestion, questionTypes]);

    useEffect(() => {
        if (!Questions || Questions.length === 0) {
            if (Object.keys(questionTypes).length > 0) {
                setQuestionTypes({});
            }
            return;
        }

        const missingIds = Questions.filter(
            (questionId) => questionId && !Object.prototype.hasOwnProperty.call(questionTypes, questionId)
        );

        if (missingIds.length === 0) return;

        let isMounted = true;

        const fetchQuestionTypes = async () => {
            try {
                const results = await Promise.all(
                    missingIds.map(async (questionId) => {
                        try {
                            const questionRef = ref(database, `questions/${questionId}`);
                            const snapshot = await get(questionRef);
                            const data = snapshot.exists() ? snapshot.val() : null;
                            return [questionId, data?.type || ''];
                        } catch (error) {
                            console.error('Error fetching question type:', error);
                            return [questionId, ''];
                        }
                    })
                );

                if (!isMounted) return;

                setQuestionTypes((prev) => {
                    const updated = { ...prev };
                    results.forEach(([id, type]) => {
                        if (id) {
                            updated[id] = type;
                        }
                    });
                    return updated;
                });
            } catch (error) {
                console.error('Error fetching question types:', error);
            }
        };

        fetchQuestionTypes();

        return () => {
            isMounted = false;
        };
    }, [Questions, questionTypes]);






    const goToNextQuestion = useCallback(() => {
        if (Questions && activeQuestion < Questions.length - 1) {
            handleQuestionChange(activeQuestion + 1);
            setActiveTab('description');
        }
    }, [activeQuestion, Questions?.length, handleQuestionChange]);

    const goToPreviousQuestion = useCallback(() => {
        if (activeQuestion > 0) {
            handleQuestionChange(activeQuestion - 1);
            setActiveTab('description');
        }

        // console.log( Questions );

    }, [activeQuestion, handleQuestionChange]);




    return (
        <>
            <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
                {/* Navbar */}
                <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none hamburger-menu"
                            aria-label="Toggle menu"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {examName}
                        </h1>
                        
                        {/* Camera Monitoring */}
                        {isProctoringActive && videoRef && (
                            <div className="relative w-16 h-16 bg-gray-900 rounded-lg overflow-hidden shadow-md border border-red-500">
                                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                <VideoCanvas videoRef={videoRef} detections={detections} isActive={true} />
                                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 bg-red-600/90 text-white px-1 py-0.5 text-[8px]">
                                    <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                                    LIVE
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* User Info */}
                    <div className="flex items-center space-x-3 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full text-white font-bold text-sm shadow-md">
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {user?.name || 'User'}
                        </span>
                    </div>

                    <div className="flex items-center space-x-4">
                        
                        {/* Timer with better styling */}
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                                {timeLeft !== null ? formatTime(timeLeft) : 'Loading...'}
                            </span>
                        </div>

                        {/* Question type */}
                        {/* <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">Type</span>
                            <span className="text-sm font-medium text-purple-800 dark:text-purple-200 capitalize">
                                {currentQuestionType || 'Loading'}
                            </span>
                        </div> */}

                        {/* Progress indicator */}
                        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                {activeQuestion + 1} / {Questions.length}
                            </span>
                            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                                    style={{ width: `${((activeQuestion + 1) / Questions.length) * 100}%` }}
                                />
                            </div>
                        </div>


                        {/* Navigation buttons */}
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={goToPreviousQuestion}
                                disabled={activeQuestion === 0}
                                className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 disabled:hover:text-gray-700 dark:disabled:hover:text-gray-300 shadow-sm"
                                title="Previous Question"
                            >
                                <FiChevronLeft className="w-4 h-4" />
                                <span className="hidden md:inline">Previous</span>
                            </button>
                            <button
                                onClick={goToNextQuestion}
                                disabled={activeQuestion === Questions.length - 1}
                                className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 disabled:hover:text-gray-700 dark:disabled:hover:text-gray-300 shadow-sm"
                                title="Next Question"
                            >
                                <span className="hidden md:inline">Next</span>
                                <FiChevronRight className="w-4 h-4" />
                            </button>
                            {/* Network Status */}
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                            {isOnline ? (
                                <>
                                    <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    <div className="flex flex-col">
                                        {networkSpeed !== null ? (
                                            <>
                                                <span className="text-xs font-semibold">
                                                    {networkSpeed >= 1 ? (
                                                        <span className="text-green-600 dark:text-green-400">
                                                            {networkSpeed.toFixed(1)} Mbps
                                                        </span>
                                                    ) : (
                                                        <span className="text-yellow-600 dark:text-yellow-400">
                                                            {(networkSpeed * 1024).toFixed(0)} Kbps
                                                        </span>
                                                    )}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-xs font-medium text-green-600 dark:text-green-400">Online</span>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    <span className="text-xs font-medium text-red-600 dark:text-red-400">Offline</span>
                                </>
                            )}
                        </div>
                        
                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="group flex items-center justify-center w-9 h-9 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200"
                            title="Toggle theme"
                        >
                            {theme === 'dark' ? (
                                <FiSun className="w-4 h-4" />
                            ) : (
                                <FiMoon className="w-4 h-4" />
                            )}
                        </button>
                        </div>
                    </div>
                </nav>

                <div className="flex flex-1 overflow-hidden">
                    {/* Question Navigation Sidebar */}
                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'tween' }}
                                className="fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700"
                                ref={menuRef}
                            >
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="font-medium text-gray-900 dark:text-white">Questions</h3>
                                    <button
                                        onClick={() => setIsMenuOpen(false)}
                                        className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
                                    >
                                        <FiX size={20} />
                                    </button>
                                </div>
                                <div className="overflow-y-auto h-[calc(100%-9rem)]">
                                    {Questions?.map((question, index) => {
                                        const typeLabel = questionTypes[question];
                                        const normalizedType = typeLabel?.toLowerCase();
                                        const answerValue = answeredQuestions?.[question];
                                        const isCorrect = answerValue === true || answerValue === 'true';
                                        const isIncorrect = answerValue === false || answerValue === 'false';
                                        const hasAnswer = answerValue !== undefined && answerValue !== null && answerValue !== '';

                                        let statusIcon = null;

                                        if (normalizedType === 'mcq') {
                   
                                            if (!hasAnswer) {
                                                statusIcon = <FiRadio className="ml-2 flex-shrink-0 text-gray-400" />
                                            }
                                            else
                                            {
                                                statusIcon = <FiCheckCircle className="ml-2 flex-shrink-0 text-green-500" />;
                                            }
                                        } else if (normalizedType === 'programming') {
                                            if (!hasAnswer) {
                                                statusIcon = <FiRadio className="ml-2 flex-shrink-0 text-gray-400" />
                                            }
                                            else if (isCorrect) {
                                                statusIcon = <FiCheckCircle className="ml-2 flex-shrink-0 text-green-500" />;;
                                            }
                                            else if (isIncorrect) {
                                                statusIcon = <FiXCircle className="ml-2 flex-shrink-0 text-red-500" />;
                                            }
                                        } 

                                        return (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    goToQuestion(index);
                                                    setIsMenuOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${activeQuestion === index
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                                                    : 'text-gray-700 dark:text-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-center">
                                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-2 text-sm font-medium ${activeQuestion === index
                                                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                    }`}>
                                                        {index + 1}
                                                    </span>
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="truncate text-sm font-medium">
                                                            {question}
                                                        </span>
                                                        <span className="text-[11px] uppercase tracking-wide font-semibold text-purple-600 dark:text-purple-300">
                                                            {typeLabel ? typeLabel : 'Loading'}
                                                        </span>
                                                    </div>
                                                    {statusIcon}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                {/* Submit button at bottom of sidebar */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => {
                                            submitExam();
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isSubmitting}
                                        title="Submit Exam"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>Submitting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FiCheck className="w-4 h-4" />
                                                <span>Submit Exam</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <DynamicComponent question={Questions[activeQuestion]} />
                    </div>
                </div>
            </div>

            {/* Submit Confirmation Modal */}
            <AnimatePresence>
                {showSubmitModal && (
                    <motion.div 
                        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div 
                            className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md"
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="flex items-center mb-4">
                                <FiAlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Submission</h3>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 mb-6">
                                Are you sure you want to submit your exam? Once submitted, you won't be able to make any changes.
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowSubmitModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitExam}
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center min-w-[100px]"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Submitting...
                                        </>
                                    ) : 'Submit'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Exam2;