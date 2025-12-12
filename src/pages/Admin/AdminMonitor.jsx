import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { database } from '../../firebase';
import {
  FiUser,
  FiCode,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiFilter,
  FiSearch,
  FiUsers,
  FiBookOpen,
  FiActivity,
  FiTrendingUp,
  FiClock,
  FiRefreshCw
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

function formatCustomTimestamp(ts) {
  const fixed = ts.replace(/_/g, ':').replace(/:(\d{3})Z$/, '.$1Z');
  const date = new Date(fixed);

  const day = date.getDate();
  const daySuffix = getOrdinalSuffix(day);
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour12: true });

  return `${day}${daySuffix} ${month}, ${year} ${time}`;
}

function getOrdinalSuffix(n) {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

const AdminMonitor = () => {
  const [submissions, setSubmissions] = useState({});
  const [userProgress, setUserProgress] = useState({});
  const [users, setUsers] = useState({});
  const [courses, setCourses] = useState({});
  const [activityTime, setActivityTime] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const [Students, setStudents] = useState([]);
  
  const [loadingStates, setLoadingStates] = useState({
    submissions: true,
    userProgress: true,
    users: true,
    courses: true,
    activityTime: true,
    students: true
  });


  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'name',
    sortOrder: 'asc' // 'asc' or 'desc'
  });

  // Extract fetch logic into reusable function
  const fetchAllData = useCallback(async () => {
    try {
      const [
        submissionsSnap,
        progressSnap,
        usersSnap,
        coursesSnap,
        studentsSnap,
        activityTimeSnap
      ] = await Promise.all([
        get(ref(database, 'Submissions')),
        get(ref(database, 'userprogress')),
        get(ref(database, 'users')),
        get(ref(database, 'AlgoCore')),
        get(ref(database, 'Students')),
        get(ref(database, 'Activitytime'))
      ]);

      // Set all data at once
      setSubmissions(submissionsSnap.val() || {});
      setUserProgress(progressSnap.val() || {});
      setUsers(usersSnap.val() || {});
      setCourses(coursesSnap.val() || {});
      setStudents(studentsSnap.val() || []);
      setActivityTime(activityTimeSnap.val() || {});
      
      // Batch loading state updates
      setLoadingStates({
        submissions: false,
        userProgress: false,
        users: false,
        courses: false,
        students: false,
        activityTime: false
      });

      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
  };

  useEffect(() => {
    fetchAllData();

    // Disabled real-time listeners for better performance
    // Uncomment if you need real-time updates
    /*
    const submissionsRef = ref(database, 'Submissions');
    const progressRef = ref(database, 'userprogress');
    const activityTimeRef = ref(database, 'Activitytime');

    const unsubscribeSubmissions = onValue(submissionsRef, (snapshot) => {
      setSubmissions(snapshot.val() || {});
    });

    const unsubscribeProgress = onValue(progressRef, (snapshot) => {
      setUserProgress(snapshot.val() || {});
    });

    const unsubscribeActivityTime = onValue(activityTimeRef, (snapshot) => {
      setActivityTime(snapshot.val() || {});
    });

    return () => {
      unsubscribeSubmissions();
      unsubscribeProgress();
      unsubscribeActivityTime();
    };
    */
  }, []);

  // Check if all data is loaded
  useEffect(() => {
    const allLoaded = Object.values(loadingStates).every(state => state === false);
    if (allLoaded) {
      setLoading(false);
    }
  }, [loadingStates]);

  // Removed console logs for better performance
  // console.log('submissions:', submissions);
  // console.log('user progress:', userProgress);

  // Add this function to calculate total questions
  const calculateTotalQuestions = (courseName) => {
    if (!courses || !courses[courseName] || !courses[courseName].lessons) return 0;

    let total = 0;
    const lessons = courses[courseName].lessons;

    if (lessons && typeof lessons === 'object') {
      Object.values(lessons).forEach(lesson => {
        if (lesson && lesson.questions && Array.isArray(lesson.questions)) {
          total += lesson.questions.length;
        }
      });
    }

    return total;
  };


  const processedData = React.useMemo(() => {
    // Early return if no users data
    if (!users || Object.keys(users).length === 0) {
      return { users: [], courses: [] };
    }

    const processedUsers = {};
    const availableCourses = new Set();
    const studentEmailSet = new Set(Students); // Convert to Set for O(1) lookup

    // First, process all available courses
    if (courses) {
      Object.keys(courses).forEach(course => {
        if (courses[course]?.lessons) {
          availableCourses.add(course);
        }
      });
    }

    // Pre-calculate total questions for each course (cache)
    const courseTotals = {};
    availableCourses.forEach(course => {
      courseTotals[course] = calculateTotalQuestions(course);
    });

    // FIRST: Process ALL users from the users object
    Object.entries(users).forEach(([userId, userDetails]) => {
      
      if (!studentEmailSet.has(userDetails.email)) return; // O(1) instead of O(n)
      
      processedUsers[userId] = {
        id: userId,
        name: userDetails.name || 'Anonymous',
        email: userDetails.email || 'No email',
        photo: userDetails.profilePhoto || '',
        submissions: {},
        stats: { attempted: 0 },
        courseProgress: {},
        overallProgress: { completed: 0, total: 0, percentage: '0.0' },
        lastActivity: null,
        activeTime: activityTime[userId] || 0
      };

      // Initialize progress for all available courses
      availableCourses.forEach(course => {
        processedUsers[userId].courseProgress[course] = {
          completed: 0,
          total: courseTotals[course], // Use cached value
          percentage: '0.0'
        };
      });

    });


    // SECOND: Process submissions for users who have them
    Object.entries(submissions).forEach(([userId, userSubmissions]) => {
      if (processedUsers[userId]) {
        Object.entries(userSubmissions).forEach(([course, courseData]) => {
          availableCourses.add(course);
          if (!processedUsers[userId].submissions[course]) {
            processedUsers[userId].submissions[course] = {};
            if (!processedUsers[userId].courseProgress[course]) {
              processedUsers[userId].courseProgress[course] = {
                completed: 0,
                total: courseTotals[course] || calculateTotalQuestions(course),
                percentage: '0.0'
              };
            }
          }

          Object.entries(courseData).forEach(([subcourse, subcourseData]) => {
            if (!processedUsers[userId].submissions[course][subcourse]) {
              processedUsers[userId].submissions[course][subcourse] = {};
            }

            Object.entries(subcourseData).forEach(([question, questionData]) => {
              const submissions = Object.entries(questionData).map(([timestamp, submission]) => ({
                timestamp,
                ...submission,
                question,
                type: 'code' // Mark as code submission
              }));

              processedUsers[userId].submissions[course][subcourse][question] = submissions;

              // Update stats for code submissions
              const latestSubmission = submissions[submissions.length - 1];
              processedUsers[userId].stats.attempted++;
              // Track last activity time
              const submissionTime = new Date(latestSubmission.timestamp.replace(/_/g, ':').replace(/:(\d{3})Z$/, '.$1Z'));
              if (!processedUsers[userId].lastActivity || submissionTime > processedUsers[userId].lastActivity) {
                processedUsers[userId].lastActivity = submissionTime;
              }
            });
          });
        });
      }
    });

    // SECOND-B: Process MCQ progress and add to stats
    Object.entries(userProgress).forEach(([userId, progress]) => {
      if (processedUsers[userId]) {
        Object.entries(progress).forEach(([course, courseData]) => {
          if (courseData && typeof courseData === 'object') {
            Object.entries(courseData).forEach(([subcourse, subcourseData]) => {
              if (subcourseData && typeof subcourseData === 'object') {
                Object.entries(subcourseData).forEach(([question, status]) => {
                  // Add MCQ entries to submissions for display
                  if (!processedUsers[userId].submissions[course]) {
                    processedUsers[userId].submissions[course] = {};
                  }
                  if (!processedUsers[userId].submissions[course][subcourse]) {
                    processedUsers[userId].submissions[course][subcourse] = {};
                  }

                  // Only add if it's not already a code submission
                  if (!processedUsers[userId].submissions[course][subcourse][question]) {
                    processedUsers[userId].submissions[course][subcourse][question] = [{
                      timestamp: 'mcq-entry', // Special timestamp for MCQs
                      status: status === true ? 'correct' : (status === false ? 'wrong' : 'not-started'),
                      question,
                      type: 'mcq', // Mark as MCQ
                      code: null // No code for MCQs
                    }];

                    // Update stats for MCQs
                    if (status === true || status === false) {
                      processedUsers[userId].stats.attempted++;
                    }
                  }
                });
              }
            });
          }
        });
      }
    });


    // THIRD: Calculate course progress (match course page logic exactly)
    Object.entries(userProgress).forEach(([userId, progress]) => {
      if (processedUsers[userId]) {
        Object.entries(progress).forEach(([course, courseData]) => {
          const totalQuestions = calculateTotalQuestions(course);
          let completed = 0;

          if (courseData && typeof courseData === 'object') {
            Object.values(courseData).forEach(subcourse => {
              if (subcourse && typeof subcourse === 'object') {
                // EXACT SAME LOGIC AS COURSE PAGE: only count items that are exactly true
                Object.values(subcourse).forEach(problemStatus => {
                  if (problemStatus === true) {
                    completed++;
                  }
                });
              }
            });
          }

          if (totalQuestions > 0) {
            processedUsers[userId].courseProgress[course] = {
              completed,
              total: totalQuestions,
              percentage: ((completed / totalQuestions) * 100).toFixed(1)
            };
          } else {
            processedUsers[userId].courseProgress[course] = {
              completed: 0,
              total: 0,
              percentage: '0.0'
            };
          }
        });

        // Calculate overall progress
        let totalCompleted = 0;
        let totalQuestions = 0;

        Object.values(processedUsers[userId].courseProgress).forEach(progress => {
          if (progress && typeof progress === 'object') {
            totalCompleted += progress.completed || 0;
            totalQuestions += progress.total || 0;
          }
        });

        if (totalQuestions > 0) {
          processedUsers[userId].overallProgress = {
            completed: totalCompleted,
            total: totalQuestions,
            percentage: ((totalCompleted / totalQuestions) * 100).toFixed(1)
          };
        } else {
          processedUsers[userId].overallProgress = {
            completed: 0,
            total: 0,
            percentage: '0.0'
          };
        }

      }
    });


    return {
      users: Object.values(processedUsers),
      courses: Array.from(availableCourses)
    };
  }, [submissions, userProgress, users, courses, activityTime]);

  // Add new function to format percentage
  const formatPercentage = (value) => {
    const numValue = Number(value);
    if (isNaN(numValue) || !isFinite(numValue)) {
      return '0.0%';
    }
    return numValue.toFixed(1) + '%';
  };


  // Add sorting function - memoized for performance
  const sortUsers = useCallback((users) => {
    return [...users].sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'attempted':
          comparison = a.stats.attempted - b.stats.attempted;
          break;
        case 'overall':
          comparison = parseFloat(a.overallProgress.percentage) - parseFloat(b.overallProgress.percentage);
          break;
        case 'activity':
          const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'activeTime':
          comparison = (a.activeTime || 0) - (b.activeTime || 0);
          break;
        default:
          if (filters.sortBy.startsWith('course_')) {
            const courseName = filters.sortBy.replace('course_', '');
            const aProgress = a.courseProgress[courseName]?.percentage || '0.0';
            const bProgress = b.courseProgress[courseName]?.percentage || '0.0';
            comparison = parseFloat(aProgress) - parseFloat(bProgress);
          }
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filters.sortBy, filters.sortOrder]);

  // Update filteredUsers to include sorting (optimized)
  const filteredUsers = React.useMemo(() => {
    if (!processedData.users || processedData.users.length === 0) return [];
    
    const searchLower = filters.search.toLowerCase();
    const filtered = searchLower
      ? processedData.users.filter(user => 
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        )
      : processedData.users;
    
    return sortUsers(filtered);
  }, [processedData.users, filters.search, sortUsers]);

  // Add this function to get sorted course names
  const sortedCourseNames = React.useMemo(() => {
    return [...processedData.courses].sort();
  }, [processedData.courses]);

  // Get all submissions for a user (including MCQs)
  const getUserSubmissions = (user) => {
    const allSubmissions = [];

    Object.entries(user.submissions).forEach(([course, courseData]) => {
      Object.entries(courseData).forEach(([subcourse, subcourseData]) => {
        Object.entries(subcourseData).forEach(([question, submissions]) => {
          submissions.forEach(submission => {
            allSubmissions.push({
              ...submission,
              course,
              subcourse,
              question: submission.question || question
            });
          });
        });
      });
    });

    // Sort by timestamp, but handle MCQ entries specially
    return allSubmissions.sort((a, b) => {
      if (a.timestamp === 'mcq-entry' && b.timestamp === 'mcq-entry') return 0;
      if (a.timestamp === 'mcq-entry') return 1; // MCQs go to bottom
      if (b.timestamp === 'mcq-entry') return -1; // MCQs go to bottom
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  };


  // Calculate completion percentage
  const getCompletionPercentage = (user, course, subcourse) => {
    if (!user.progress || !user.progress[course] || !user.progress[course][subcourse]) {
      return 0;
    }

    const progress = user.progress[course][subcourse];
    const completed = Object.values(progress).filter(Boolean).length;
    const total = Object.keys(progress).length;

    return total > 0 ? (completed / total * 100).toFixed(1) : 0;
  };

  // Calculate loading progress
  const loadedCount = Object.values(loadingStates).filter(state => !state).length;
  const totalCount = Object.keys(loadingStates).length;
  const loadingPercentage = Math.round((loadedCount / totalCount) * 100);
  
  // Get currently loading item
  const currentlyLoading = Object.entries(loadingStates)
    .find(([key, isLoading]) => isLoading)?.[0] || 'Complete';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Loading Progress Bar - Thin Line */}
      {(loading || refreshing) && (
        <div className="fixed top-0 left-0 right-0 z-50 group">
          <div className="h-1 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out relative"
              style={{ width: `${loadingPercentage}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
            </div>
            {/* Percentage indicator on bar */}
            <div 
              className="absolute top-0 h-full flex items-center text-[10px] font-bold text-white transition-all duration-300 px-1"
              style={{ left: `${Math.max(2, Math.min(95, loadingPercentage))}%` }}
            >
              {loadingPercentage}%
            </div>
          </div>
          {/* Tooltip showing current loading item - appears on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 text-white text-xs px-3 py-1 text-center">
            {loadingPercentage < 100 ? `Loading ${currentlyLoading.replace(/([A-Z])/g, ' $1').trim()}...` : 'Complete'}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-300">Admin Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">Track student submissions and progress</p>
            </div>
            {/* Header students count box */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                <FiRefreshCw className={`${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg">
                <div className="flex items-center">
                  <FiUsers className="mr-2 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    {filteredUsers.length} Students
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <FiFilter className="mr-2 text-gray-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-300">Filters & Sort</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-zinc-300">Search</label>
              {/* Search box */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-zinc-300">Sort By</label>
                {/* Sort dropdown */}
                <select
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                >
                  <option value="name">Name</option>
                  <option value="attempted">Total Attempted</option>
                  <option value="overall">Overall Progress</option>
                  <option value="activity">Last Activity</option>
                  <option value="activeTime">Time Spent</option>
                  {processedData.courses.map(course => (
                    <option key={course} value={`course_${course}`}>{course} Progress</option>
                  ))}
                </select>
              </div>

              <div className="flex-none">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-zinc-300">Order</label>
                {/* Order button */}
                <button
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  onClick={() => setFilters(prev => ({
                    ...prev,
                    sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                  }))}
                >
                  {filters.sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Students Grid */}
        <motion.div
          layout
          className={`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <AnimatePresence>
            {loading && filteredUsers.length === 0 ? (
              // Skeleton loaders while loading
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={`skeleton-${idx}`} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                      <div className="ml-3">
                        <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                        <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="text-center">
                        <div className="h-8 w-12 bg-gray-300 dark:bg-gray-600 rounded mx-auto mb-2"></div>
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                      </div>
                    ))}
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              ))
            ) : (
              filteredUsers.map(user => (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* User header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                        {user?.photo ? (
                          <img
                            src={user.photo}
                            alt={user.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FiUser className="text-blue-600" />
                        )}
                      </div>

                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-300">{user.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <FiEye size={20} />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{user.stats.attempted}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">Attempted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
                        {user.lastActivity ? (
                          <div className="flex flex-col items-center">
                            <FiActivity className="text-blue-600 dark:text-blue-400 mb-1" size={18} />
                            <span className="text-[10px]">{new Date(user.lastActivity).toLocaleDateString()}</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              {new Date(user.lastActivity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No activity</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Last Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-base font-semibold text-green-600 dark:text-green-400">
                        {user.activeTime > 0 ? (
                          <div className="flex flex-col items-center">
                            <FiClock className="text-green-600 dark:text-green-400 mb-1" size={18} />
                            <span className="text-xs font-bold">
                              {Math.floor(user.activeTime / (1000 * 60 * 60))}h {Math.floor((user.activeTime % (1000 * 60 * 60)) / (1000 * 60))}m
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">0h 0m</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">Time Spent</div>
                    </div>
                  </div>

                  {/* Overall Progress */}
                  <div className="mt-4 mb-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {user.overallProgress ? formatPercentage(user.overallProgress.percentage) : '0.0%'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-300"
                        style={{
                          width: `${user.overallProgress ?
                            Math.min(100, Math.max(0, parseFloat(user.overallProgress.percentage) || 0)) : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>


                  {/* Course Progress */}
                  <div className="space-y-2">
                    {sortedCourseNames.map(course => {
                      const progress = user.courseProgress && user.courseProgress[course] ?
                        user.courseProgress[course] : { percentage: '0.0', completed: 0, total: 0 };

                      return (
                        <div key={course} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">{course}</span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            {formatPercentage(progress.percentage)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedUser.name} - Submissions
                </h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiXCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {getUserSubmissions(selectedUser).length > 0 ? (
                  getUserSubmissions(selectedUser).map((submission, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${submission.status === 'correct' ? 'bg-green-500' :
                            submission.status === 'wrong' ? 'bg-red-500' :
                              'bg-gray-400'
                            }`}></div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {submission.course} - {submission.subcourse} - {submission.question}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${submission.type === 'mcq'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                            {submission.type === 'mcq' ? 'MCQ' : submission.language || 'CODE'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {submission.timestamp !== 'mcq-entry' && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCustomTimestamp(submission.timestamp)}
                            </span>
                          )}
                          {submission.type !== 'mcq' && submission.code && (
                            <button
                              onClick={() => setSelectedSubmission(submission)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <FiCode />
                            </button>
                          )}
                          {submission.type === 'mcq' && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              MCQ Answer
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No submissions or progress found for this user.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Code Viewer Modal */}
      {selectedSubmission && selectedSubmission.type !== 'mcq' && selectedSubmission.code && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedSubmission.question}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedSubmission.language} - {selectedSubmission.status}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiXCircle size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                  {selectedSubmission.code}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMonitor;