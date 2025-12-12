import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ref, onValue, get, update, set } from 'firebase/database';
import { database } from '../../firebase';
import toast from 'react-hot-toast';
import LoadingPage from '../LoadingPage';
import LiveStreamViewer from '../../LiveProctoring/components/LiveStreamViewerV2';
import { useNavigate } from 'react-router-dom';

const ExamMonitor = () => {
    const [monitoredData, setMonitoredData] = useState([]);
    const [testTitle, setTestTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});
    const [violationDetails, setViolationDetails] = useState({});
    const [loadingViolations, setLoadingViolations] = useState({});
    const [expandedQuestions, setExpandedQuestions] = useState({});
    const [questionDetails, setQuestionDetails] = useState({});
    const [loadingQuestions, setLoadingQuestions] = useState({});
    const [changingQuestion, setChangingQuestion] = useState({});
    const [availableQuestions, setAvailableQuestions] = useState([]);
    const [testInfo, setTestInfo] = useState({});
    const [sortBy, setSortBy] = useState('status'); // status, name, blocked_first, completed_first
    const { testid } = useParams();
    const navigate = useNavigate();

    const fetchViolationDetails = async (userId) => {
        if (violationDetails[userId]) {
            // Already fetched, just toggle
            return;
        }

        setLoadingViolations(prev => ({ ...prev, [userId]: true }));

        try {
            const violationsRef = ref(database, `Exam/${testid}/Violations/${userId}`);
            const snapshot = await get(violationsRef);

            if (snapshot.exists()) {
                const violations = snapshot.val();
                const violationsArray = Object.entries(violations).map(([id, data]) => ({
                    id,
                    ...data
                })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first

                setViolationDetails(prev => ({ ...prev, [userId]: violationsArray }));
            } else {
                setViolationDetails(prev => ({ ...prev, [userId]: [] }));
            }
        } catch (error) {
            console.error('Error fetching violation details:', error);
            toast.error('Failed to load violation details.');
            setViolationDetails(prev => ({ ...prev, [userId]: [] }));
        } finally {
            setLoadingViolations(prev => ({ ...prev, [userId]: false }));
        }
    };

    const toggleRow = async (userId) => {
        const isExpanded = expandedRows[userId];

        if (!isExpanded) {
            await fetchViolationDetails(userId);
        }

        setExpandedRows(prev => ({ ...prev, [userId]: !isExpanded }));
    };

    const fetchQuestionDetails = async (userId) => {
        if (questionDetails[userId]) {
            return;
        }

        setLoadingQuestions(prev => ({ ...prev, [userId]: true }));

        try {
            const myQuestionsRef = ref(database, `Exam/${testid}/myquestions/${userId}`);
            const questionsRef = ref(database, 'questions');

            const [myQuestionsSnap, allQuestionsSnap] = await Promise.all([
                get(myQuestionsRef),
                get(questionsRef)
            ]);

            if (myQuestionsSnap.exists() && allQuestionsSnap.exists()) {
                const myQuestions = myQuestionsSnap.val();
                const allQuestions = allQuestionsSnap.val();

                const questionsList = Object.entries(myQuestions).map(([order, questionId]) => {
                    const questionData = allQuestions[questionId];
                    return {
                        order: parseInt(order),
                        id: questionId,
                        title: questionData?.questionname || 'Unknown Question',
                        type: questionData?.type || 'N/A',
                        difficulty: questionData?.difficulty || 'N/A'
                    };
                }).sort((a, b) => a.order - b.order);

                setQuestionDetails(prev => ({ ...prev, [userId]: questionsList }));
            } else {
                setQuestionDetails(prev => ({ ...prev, [userId]: [] }));
            }
        } catch (error) {
            console.error('Error fetching question details:', error);
            toast.error('Failed to load question details.');
            setQuestionDetails(prev => ({ ...prev, [userId]: [] }));
        } finally {
            setLoadingQuestions(prev => ({ ...prev, [userId]: false }));
        }
    };

    const toggleQuestions = async (userId) => {
        const isExpanded = expandedQuestions[userId];

        if (!isExpanded) {
            await fetchQuestionDetails(userId);
        }

        setExpandedQuestions(prev => ({ ...prev, [userId]: !isExpanded }));
    };

    const handleStartChangeQuestion = (userId, questionOrder) => {
        setChangingQuestion({ userId, questionOrder });
    };

    const handleCancelChangeQuestion = () => {
        setChangingQuestion({});
    };

    const handleChangeQuestion = async (userId, questionOrder, newQuestionId) => {
        try {
            const myQuestionsRef = ref(database, `Exam/${testid}/myquestions/${userId}/${questionOrder}`);
            await set(myQuestionsRef, newQuestionId);

            toast.success('Question changed successfully!');

            // Refresh the question details
            setQuestionDetails(prev => ({ ...prev, [userId]: null }));
            await fetchQuestionDetails(userId);

            setChangingQuestion({});
        } catch (error) {
            console.error('Error changing question:', error);
            toast.error('Failed to change question.');
        }
    };

    const unblockUser = async (userId) => {
        if (!window.confirm('Are you sure you want to unblock this user and reset their violations to 0?')) {
            return;
        }
        try {
            const progressRef = ref(database, `Exam/${testid}/Properties/Progress/${userId}`);
            const violationRef = ref(database, `Exam/${testid}/Properties2/Progress/${userId}`);

            // Update status to 'started' and reset violations to 0
            await update(progressRef, { status: 'started' });
            await set(violationRef, 0);

            toast.success('User has been unblocked.');
        } catch (error) {
            console.error('Error unblocking user:', error);
            toast.error('Failed to unblock user.');
        }
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getReasonLabel = (reason) => {
        const labels = {
            'fullscreen_exit': 'Exited Fullscreen',
            'window_blur': 'Window Lost Focus',
            'tab_switch': 'Tab Switch / Page Hidden',
            'mouse_leave': 'Mouse Left Screen'
        };
        return labels[reason] || reason;
    };

    const getReasonColor = (reason) => {
        const colors = {
            'fullscreen_exit': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
            'window_blur': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
            'tab_switch': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
            'mouse_leave': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        };
        return colors[reason] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    };

    useEffect(() => {
        if (!testid) {
            setError('No Test ID provided in the URL.');
            setIsLoading(false);
            return;
        }

        const examRef = ref(database, `Exam/${testid}`);

        const unsubscribe = onValue(examRef, async (snapshot) => {
            try {
                const exam = snapshot.val();
                if (!exam) {
                    setError('The specified test does not exist.');
                    setMonitoredData([]);
                    setIsLoading(false);
                    return;
                }

                console.log(exam)
                const currentTestTitle = exam.name || 'Untitled Test';
                setTestTitle(currentTestTitle);
                setTestInfo({
                    name: currentTestTitle,
                    duration: exam.duration || 'N/A',
                    totalQuestions: exam.questions ? Object.keys(exam.questions).length : 0
                });

                // Fetch available questions for the exam
                const examQuestionIds = exam.questions ? Object.keys(exam.questions) : [];
                if (examQuestionIds.length > 0) {
                    const questionsRef = ref(database, 'questions');
                    const questionsSnapshot = await get(questionsRef);
                    if (questionsSnapshot.exists()) {
                        const allQuestions = questionsSnapshot.val();
                        const available = examQuestionIds.map(qId => {
                            const qData = allQuestions[qId];
                            return {
                                id: qId,
                                title: qData?.questionname || 'Unknown Question',
                                type: qData?.type || 'N/A',
                                difficulty: qData?.difficulty || 'N/A'
                            };
                        });
                        setAvailableQuestions(available);
                    }
                }

                // Get all eligible students
                const eligibleEmails = Object.values(exam.Eligible || {});

                // Fetch all users
                const usersRef = ref(database, 'users');
                const usersSnapshot = await get(usersRef);
                const users = usersSnapshot.val() || {};

                // Create email to UID mapping
                const emailToUidMap = {};
                Object.entries(users).forEach(([uid, userData]) => {
                    if (userData.email) {
                        emailToUidMap[userData.email] = { uid, ...userData };
                    }
                });

                const monitoredUsers = [];
                const progress = exam.Properties?.Progress || {};
                const violations = exam.Properties2?.Progress || {};
                const myQuestions = exam.myquestions || {};

                // Process all eligible students
                for (const email of eligibleEmails) {
                    const userInfo = emailToUidMap[email];
                    if (!userInfo) continue;

                    const userId = userInfo.uid;
                    const userProgress = progress[userId];
                    const userViolations = violations[userId] ?? 0;
                    const allocatedQuestions = myQuestions[userId] ? Object.keys(myQuestions[userId]).length : 0;

                    if(  userProgress?.status?.toLowerCase() === "started") {
                         const givenTime = new Date(userProgress?.startTime|| '');
                    const currentTime = new Date();

                    // Calculate difference in minutes
                    const diffMinutes = (currentTime - givenTime) / (1000 * 60);

                    if (diffMinutes > exam.duration) {
                        console.log(`More than ${exam.duration} minutes have passed.`);
                        userProgress.status = 'completed';
                        const statusRef = ref(database, `Exam/${testid}/Properties/Progress/${userId}/status`);
                        await set(statusRef, "completed");
                    } else {
                        console.log("Less than or equal to 60 minutes have passed.");
                    }

                    console.log("Difference (minutes):", diffMinutes);

                    }

                   

                    monitoredUsers.push({
                        id: `${testid}-${userId}`,
                        userId: userId,
                        userName: userInfo.name || 'Unknown User',
                        email: email,
                        status: userProgress?.status || 'not_started',
                        startTime: userProgress?.startTime || null,
                        violations: userViolations,
                        allocatedQuestions: allocatedQuestions,
                    });
                }

                // Apply sorting based on selected option
                monitoredUsers.sort((a, b) => {
                    switch (sortBy) {
                        case 'name':
                            return a.userName.localeCompare(b.userName);
                        case 'email':
                            return a.email.localeCompare(b.email);
                        case 'blocked_first':
                            if (a.status === 'blocked' && b.status !== 'blocked') return -1;
                            if (a.status !== 'blocked' && b.status === 'blocked') return 1;
                            return a.userName.localeCompare(b.userName);
                        case 'completed_first':
                            if (a.status === 'completed' && b.status !== 'completed') return -1;
                            if (a.status !== 'completed' && b.status === 'completed') return 1;
                            return a.userName.localeCompare(b.userName);
                        case 'status':
                        default:
                            const statusPriority = {
                                'started': 1,
                                'blocked': 2,
                                'completed': 3,
                                'not_started': 4
                            };
                            const priorityA = statusPriority[a.status] || 5;
                            const priorityB = statusPriority[b.status] || 5;
                            if (priorityA !== priorityB) {
                                return priorityA - priorityB;
                            }
                            return a.userName.localeCompare(b.userName);
                    }
                });

                setMonitoredData(monitoredUsers);
            } catch (err) {
                console.error("Error processing exam data:", err);
                setError('Failed to load and process exam data.');
            } finally {
                setIsLoading(false);
            }
        }, (err) => {
            console.error("Firebase onValue error:", err);
            setError('Failed to connect to the database.');
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [testid, sortBy]);

    if (isLoading) {
        return (
            <LoadingPage message="Loading Exam Data, please wait..." />
        );
    }

    if (error) {
        return <div className="text-center text-red-500 mt-10">Error: {error}</div>;
    }

    const getStatusColor = (status) => {
        const colors = {
            'started': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
            'completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            'blocked': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
            'not_started': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        };
        return colors[status] || colors.not_started;
    };

    const getStatusLabel = (status) => {
        const labels = {
            'started': 'In Progress',
            'completed': 'Completed',
            'blocked': 'Blocked',
            'not_started': 'Not Started'
        };
        return labels[status] || status;
    };

    const formatStartTime = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="container mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            {/* Header Section */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Real-Time Exam Monitor</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{testInfo.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Duration: {testInfo.duration} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Total Questions: {testInfo.totalQuestions}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>Total Students: {monitoredData.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" href='/testedit/' onClick={() => navigate(`/testedit/${testid}`)}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Edit Test</span>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">In Progress</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {monitoredData.filter(u => u.status === 'started').length}
                            </p>
                        </div>
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Completed</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {monitoredData.filter(u => u.status === 'completed').length}
                            </p>
                        </div>
                        <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Blocked</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                {monitoredData.filter(u => u.status === 'blocked').length}
                            </p>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Not Started</p>
                            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                                {monitoredData.filter(u => u.status === 'not_started').length}
                            </p>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full">
                            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sort Controls */}
            <div className="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="status">Status (Priority)</option>
                            <option value="name">Student Name (A-Z)</option>
                            <option value="email">Student Email (A-Z)</option>
                            <option value="blocked_first">Blocked Students First</option>
                            <option value="completed_first">Completed Students First</option>
                        </select>
                    </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {monitoredData.length} students total
                </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto bg-white dark:bg-gray-800 shadow-md rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Questions</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Violations</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {monitoredData.length > 0 ? (
                            monitoredData.map((user, index) => (
                                <React.Fragment key={user.id}>
                                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {index + 1}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.userName}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.status)}`}>
                                                {getStatusLabel(user.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                            {formatStartTime(user.startTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{user.allocatedQuestions}</span> / {testInfo.totalQuestions}
                                                {user.allocatedQuestions > 0 && (
                                                    <button
                                                        onClick={() => toggleQuestions(user.userId)}
                                                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs underline"
                                                    >
                                                        {expandedQuestions[user.userId] ? 'Hide' : 'View'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${user.violations >= 2 ? 'text-red-600 dark:text-red-400' : user.violations > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {user.violations}
                                                </span>
                                                {user.violations > 0 && (
                                                    <button
                                                        onClick={() => toggleRow(user.userId)}
                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                                                    >
                                                        {expandedRows[user.userId] ? 'Hide' : 'View'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {user.status === 'blocked' && (
                                                <button
                                                    onClick={() => unblockUser(user.userId)}
                                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors duration-200 text-xs"
                                                >
                                                    Unblock
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedQuestions[user.userId] && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10">
                                                {loadingQuestions[user.userId] ? (
                                                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading questions...</div>
                                                ) : questionDetails[user.userId]?.length > 0 ? (
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                                            Allocated Questions ({questionDetails[user.userId].length} total)
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {questionDetails[user.userId].map((question, idx) => (
                                                                <div key={question.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Q{idx + 1}</span>
                                                                        <div className="flex gap-1">
                                                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${question.type.toLowerCase() === 'mcq'
                                                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                                                                    : question.type.toLowerCase() === 'programming'
                                                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                                        : question.type.toLowerCase() === 'sql'
                                                                                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                                                }`}>
                                                                                {question.type}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${question.difficulty.toLowerCase() === 'easy'
                                                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                                    : question.difficulty.toLowerCase() === 'medium'
                                                                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                                                        : question.difficulty.toLowerCase() === 'hard'
                                                                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                                                                }`}>
                                                                                {question.difficulty}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                                                        {question.title}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">
                                                                        ID: {question.id}
                                                                    </p>

                                                                    {/* Change Question Section */}
                                                                    {changingQuestion.userId === user.userId && changingQuestion.questionOrder === question.order ? (
                                                                        <div className="mt-3 space-y-2">
                                                                            <select
                                                                                className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                                                                onChange={(e) => handleChangeQuestion(user.userId, question.order, e.target.value)}
                                                                                defaultValue=""
                                                                            >
                                                                                <option value="" disabled>Select new question...</option>
                                                                                {availableQuestions
                                                                                    .filter(q => {
                                                                                        // Filter by same type
                                                                                        const isSameType = q.type.toLowerCase() === question.type.toLowerCase();
                                                                                        // Check if already allocated to this student
                                                                                        const alreadyAllocated = questionDetails[user.userId]?.some(uq => uq.id === q.id);
                                                                                        return isSameType && !alreadyAllocated;
                                                                                    })
                                                                                    .map(q => (
                                                                                        <option key={q.id} value={q.id}>
                                                                                            {q.title} ({q.difficulty})
                                                                                        </option>
                                                                                    ))
                                                                                }
                                                                                {availableQuestions.filter(q => {
                                                                                    const isSameType = q.type.toLowerCase() === question.type.toLowerCase();
                                                                                    const alreadyAllocated = questionDetails[user.userId]?.some(uq => uq.id === q.id);
                                                                                    return isSameType && !alreadyAllocated;
                                                                                }).length === 0 && (
                                                                                        <option value="" disabled>No available questions of same type</option>
                                                                                    )}
                                                                            </select>
                                                                            <button
                                                                                onClick={handleCancelChangeQuestion}
                                                                                className="w-full text-xs px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        (() => {
                                                                            const availableReplacements = availableQuestions.filter(q => {
                                                                                const isSameType = q.type.toLowerCase() === question.type.toLowerCase();
                                                                                const alreadyAllocated = questionDetails[user.userId]?.some(uq => uq.id === q.id);
                                                                                return isSameType && !alreadyAllocated;
                                                                            });
                                                                            const hasReplacements = availableReplacements.length > 0;

                                                                            return (
                                                                                <button
                                                                                    onClick={() => hasReplacements && handleStartChangeQuestion(user.userId, question.order)}
                                                                                    disabled={!hasReplacements}
                                                                                    className={`mt-2 text-[10px] px-2 py-0.5 rounded transition-colors inline-flex items-center gap-1 ${hasReplacements
                                                                                            ? 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
                                                                                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                                                        }`}
                                                                                    title={hasReplacements ? `${availableReplacements.length} replacement(s) available` : 'No available replacements of same type'}
                                                                                >
                                                                                    {hasReplacements ? (
                                                                                        <>
                                                                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                                                            </svg>
                                                                                            Change ({availableReplacements.length})
                                                                                        </>
                                                                                    ) : (
                                                                                        <>
                                                                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                                                            </svg>
                                                                                            None
                                                                                        </>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })()
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">No questions allocated.</div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                    {expandedRows[user.userId] && (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                                                {loadingViolations[user.userId] ? (
                                                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">Loading violations...</div>
                                                ) : violationDetails[user.userId]?.length > 0 ? (
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Violation History ({violationDetails[user.userId].length} total)</h4>
                                                        <div className="max-h-96 overflow-y-auto space-y-2">
                                                            {violationDetails[user.userId].map((violation, idx) => (
                                                                <div key={violation.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-500 dark:text-gray-400 text-xs font-mono">#{idx + 1}</span>
                                                                            <span className={`px-2 py-1 text-xs font-semibold rounded ${getReasonColor(violation.reason)}`}>
                                                                                {getReasonLabel(violation.reason)}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                            {formatTimestamp(violation.timestamp)}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                                                        {violation.details?.duration && (
                                                                            <div>
                                                                                <span className="text-gray-500 dark:text-gray-400">Duration: </span>
                                                                                <span className="font-semibold text-gray-700 dark:text-gray-300">{violation.details.duration}</span>
                                                                            </div>
                                                                        )}
                                                                        {violation.details?.gracePeriod && (
                                                                            <div>
                                                                                <span className="text-gray-500 dark:text-gray-400">Grace Period: </span>
                                                                                <span className="font-semibold text-gray-700 dark:text-gray-300">{violation.details.gracePeriod}</span>
                                                                            </div>
                                                                        )}
                                                                        {violation.windowSize && (
                                                                            <div>
                                                                                <span className="text-gray-500 dark:text-gray-400">Window: </span>
                                                                                <span className="font-mono text-gray-700 dark:text-gray-300">{violation.windowSize}</span>
                                                                            </div>
                                                                        )}
                                                                        {violation.screenSize && (
                                                                            <div>
                                                                                <span className="text-gray-500 dark:text-gray-400">Screen: </span>
                                                                                <span className="font-mono text-gray-700 dark:text-gray-300">{violation.screenSize}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {violation.userAgent && (
                                                                        <div className="mt-2 text-xs">
                                                                            <span className="text-gray-500 dark:text-gray-400">Browser: </span>
                                                                            <span className="text-gray-600 dark:text-gray-400 font-mono text-[10px]">
                                                                                {violation.userAgent.substring(0, 80)}...
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">No violation details found.</div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No students found for this exam.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Live Camera Feeds Section */}
            <div className="mt-8">
                <LiveStreamViewer testid={testid} />
            </div>
        </div>
    );
};

export default ExamMonitor;
