import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { ref, get, child } from "firebase/database";
import { database } from "../firebase";
import SignInRequiredPage from "./SignInRequiredPage";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import LoadingPage from "./LoadingPage";
import useUserActivityTime from '../hooks/useUserActivityTime';
import ActivityCalendar from './ActivityCalendar';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// SVG Icons
const Icons = {
  Edit: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  ),
  Trophy: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  ),
  Star: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  ),
  Calendar: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  Mail: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  Settings: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  Moon: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  ),
  Sun: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  Bell: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  ),
  Shield: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  Eye: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  ),
};
// Helper functions for timestamp conversion
const parseFirebaseTimestamp = (timestampKey) => {
  if (!timestampKey) return new Date(NaN);

  // Replace the last underscore before milliseconds with a dot
  const fixed = timestampKey.replace(
    /T(\d{2})_(\d{2})_(\d{2})_(\d{3})Z/,
    'T$1:$2:$3.$4Z'
  );

  const date = new Date(fixed);

  return isNaN(date.getTime()) ? new Date(NaN) : date;
};

const getStatusColor = (status) => {
  switch (status) {
    case "Accepted":
      return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
    case "Wrong Answer":
      return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
    case "Runtime Error":
      return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30";
    default:
      return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30";
  }
};


const formatFirebaseTimestamp = (timestampKey) => {
  const date = parseFirebaseTimestamp(timestampKey);

  if (isNaN(date.getTime())) {
    console.warn('Invalid date for timestamp:', timestampKey);
    return 'N/A';
  }

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Format join date from timestamp
const formatJoinDate = (timestamp) => {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};


function ProfilePage() {
  const { theme } = useTheme();
  const { user, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [isDarkMode, setIsDarkMode] = useState(theme === "dark");
  const [profileData, setProfileData] = useState(null);
  const [timeFilter, setTimeFilter] = useState('hourly');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  });
  // Add useState for submissionStats
  const [submissionStats, setSubmissionStats] = useState({
    labels: [],
    data: []
  });
  const { totalTime, formatTime } = useUserActivityTime();

  // Helper to get all dates from start of month to today
  const getMonthDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const dates = [];
    for (let d = 1; d <= today; d++) {
      const dateObj = new Date(year, month, d);
      dates.push(dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
    return dates;
  };

  // Helper for yearly labels
  const getYearlyLabels = () => {
    const now = new Date();
    const labels = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(now.getMonth() - i);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    }
    return labels;
  };

  const processSubmissionsData = (submissions, filter) => {
    const stats = new Map();
    const now = new Date();

    if (filter === 'hourly') {
      // 0-23 hours for selectedDate
      for (let h = 0; h < 24; h++) {
        stats.set(h.toString().padStart(2, '0'), 0);
      }
      const [selMonth, selDay, selYear] = selectedDate.match(/([A-Za-z]+) (\d+), (\d+)/).slice(1);
      for (const course in submissions) {
        for (const category in submissions[course]) {
          for (const question in submissions[course][category]) {
            for (const timestamp in submissions[course][category][question]) {
              const submission = submissions[course][category][question][timestamp];
              if (submission.status === 'correct') {
                const date = new Date(parseFirebaseTimestamp(timestamp));
                if (
                  date.getFullYear() === Number(selYear) &&
                  date.toLocaleString('en-US', { month: 'short' }) === selMonth &&
                  date.getDate() === Number(selDay)
                ) {
                  const hour = date.getHours().toString().padStart(2, '0');
                  if (stats.has(hour)) {
                    stats.set(hour, stats.get(hour) + 1);
                  }
                }
              }
            }
          }
        }
      }
    } else if (filter === 'weekly') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        stats.set(date.toLocaleDateString(), 0);
      }
      for (const course in submissions) {
        for (const category in submissions[course]) {
          for (const question in submissions[course][category]) {
            for (const timestamp in submissions[course][category][question]) {
              const submission = submissions[course][category][question][timestamp];
              if (submission.status === 'correct') {
                const date = new Date(parseFirebaseTimestamp(timestamp));
                const key = date.toLocaleDateString();
                if (stats.has(key)) {
                  stats.set(key, stats.get(key) + 1);
                }
              }
            }
          }
        }
      }
    } else if (filter === 'monthly') {
      // Last 12 months, label as "Aug 2024", "Sep 2024", etc.
      const labels = getYearlyLabels();
      labels.forEach(label => stats.set(label, 0));
      for (const course in submissions) {
        for (const category in submissions[course]) {
          for (const question in submissions[course][category]) {
            for (const timestamp in submissions[course][category][question]) {
              const submission = submissions[course][category][question][timestamp];
              if (submission.status === 'correct') {
                const date = new Date(parseFirebaseTimestamp(timestamp));
                const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (stats.has(key)) {
                  stats.set(key, stats.get(key) + 1);
                }
              }
            }
          }
        }
      }
    }

    return {
      labels: Array.from(stats.keys()),
      data: Array.from(stats.values())
    };
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;

      const dbRef = ref(database);
      const progressPath = `userprogress/${user.uid}`;
      const submissionsPath = `Submissions/${user.uid}`;

      try {
        const [progressSnapshot, submissionsSnapshot] = await Promise.all([
          get(child(dbRef, progressPath)),
          get(child(dbRef, submissionsPath)),
        ]);

        let acceptedCount = 0;
        let totalSubmissions = 0;
        let submissionsList = [];

        // Process progress data (for accepted submissions)
        if (progressSnapshot.exists()) {
          const progressData = progressSnapshot.val();

          for (const courseKey in progressData) {
            for (const subKey in progressData[courseKey]) {
              for (const questionId in progressData[courseKey][subKey]) {
                const progress = progressData[courseKey][subKey][questionId];
                const accepted =
                  typeof progress === "object" ? progress.accepted : progress;

                if (accepted === true) {
                  acceptedCount++;
                }
              }
            }
          }
        }

        // Process submissions data
        if (submissionsSnapshot.exists()) {
          const submissionsData = submissionsSnapshot.val();
          totalSubmissions = 0;

          // Flatten the submissions data into an array
          for (const courseKey in submissionsData) {
            for (const subKey in submissionsData[courseKey]) {
              for (const questionId in submissionsData[courseKey][subKey]) {
                for (const timestampKey in submissionsData[courseKey][subKey][
                  questionId
                ]) {
                  const submission =
                    submissionsData[courseKey][subKey][questionId][
                    timestampKey
                    ];
                  totalSubmissions++;

                  submissionsList.push({
                    problem: questionId,
                    course: courseKey,
                    subcourse: subKey,
                    language: submission.language || "N/A",
                    status:
                      submission.status === "correct"
                        ? "Accepted"
                        : "Wrong Answer",
                    runtime: "-", // Placeholder
                    date: formatFirebaseTimestamp(timestampKey),
                    timestamp: parseFirebaseTimestamp(timestampKey).getTime(),
                    code: submission.code,
                  });
                }
              }
            }
          }

          // Sort submissions by timestamp in descending order
          submissionsList.sort((a, b) => b.timestamp - a.timestamp);

          const stats = processSubmissionsData(submissionsData, timeFilter);
          setSubmissionStats(stats);
        }

        setProfileData((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            acceptedSubmissions: acceptedCount,
            totalSubmissions: totalSubmissions,
          },
          allSubmissions: submissionsList,
          recentSubmissions: submissionsList.slice(0, 10), // Show only recent 10 by default
        }));
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    if (user) {
      setProfileData({
        username: user.name || "Anonymous",
        email: user.email || "No email provided",
        joinDate: formatJoinDate(Date.now()),
        photoURL: user.photoURL || "https://via.placeholder.com/150",
        allSubmissions: [],
        recentSubmissions: [],
        stats: {
          totalSubmissions: 0,
          acceptedSubmissions: 0,
          streak: 0,
          rank: "Beginner",
        },
      });

      fetchUserData();
    }
  }, [user, timeFilter, selectedDate]);

  if (loading) {
    return (
      <LoadingPage />
    );
  }

  if (!user) {
    return <SignInRequiredPage />;
  }

  if (!profileData) {
    return (
      <LoadingPage />
    );
  }

  console.log("Profile Data:", profileData);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Profile Header */}
          <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 p-8 mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
              {/* Profile Picture */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1">
                  <img
                    src={profileData.photoURL}
                    alt="Profile"
                    className="w-full h-full rounded-full border-4 border-white dark:border-gray-800"
                  />
                </div>

              </div>

              {/* User Info */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {profileData.username}
                  </h1>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Icons.Calendar />
                    <span>Joined {profileData.joinDate}</span>
                  </div>

                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Icons.Mail />
                    <span>{profileData.email}</span>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  {profileData.bio}
                </p>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl">
                    <div className="text-2xl font-bold">
                      {profileData.stats.totalSubmissions}
                    </div>
                    <div className="text-sm opacity-90">Total Submissions</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl">
                    <div className="text-2xl font-bold">
                      {profileData.stats.acceptedSubmissions}
                    </div>
                    <div className="text-sm opacity-90">Accepted</div>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl">
                    <div className="text-2xl font-bold">
                      {profileData.stats.rank}
                    </div>
                    <div className="text-sm opacity-90">Rank</div>
                  </div>
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl">
                    <div className="text-2xl font-bold">
                      {formatTime(totalTime)}
                    </div>
                    <div className="text-sm opacity-90">Time Spent</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Tabs */}
          <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 mb-8">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                className={`px-6 py-4 text-sm font-medium transition-all duration-200 ${activeTab === "overview"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                className={`px-6 py-4 text-sm font-medium transition-all duration-200 ${activeTab === "submissions"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                onClick={() => setActiveTab("submissions")}
              >
                Submissions
              </button>

            </div>

            <div className="p-8">
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {/* Activity Graph */}
                  {/* <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Activity
                      </h3>
                      <div className="flex gap-2">
                        {timeFilter === "hourly" && (
                          <select
                            className="bg-white/70 dark:bg-gray-700/70 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                          >
                            {getMonthDates().map(date => (
                              <option key={date} value={date}>
                                {date.replace(/, \d{4}$/, '')}
                              </option>
                            ))}
                          </select>
                        )}
                        <select
                          className="bg-white/70 dark:bg-gray-700/70 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm"
                          value={timeFilter}
                          onChange={(e) => setTimeFilter(e.target.value)}
                        >
                          <option value="hourly">Hourly</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-6 h-[300px] flex items-center justify-center">
                      {submissionStats.data.length === 0 ||
                        submissionStats.data.every((v) => v === 0) ? (
                        <div className="text-center w-full">
                          <div className="w-16 h-16 mx-auto mb-4 bg-white/50 dark:bg-gray-800/50 rounded-full flex items-center justify-center">
                            <Icons.Trophy />
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-lg">
                            No submissions
                          </p>
                        </div>
                      ) : (
                        <Line
                          data={{
                            labels: submissionStats.labels,
                            datasets: [
                              {
                                data: submissionStats.data,
                                borderColor: 'rgb(59, 130, 246)',
                                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                                tension: 0.4,
                                pointRadius: 4,
                                pointHoverRadius: 6,
                              }
                            ]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              x: {
                                title: {
                                  display: true,
                                  text:
                                    timeFilter === "hourly"
                                      ? "Hours"
                                      : timeFilter === "weekly"
                                        ? "Date"
                                        : timeFilter === "monthly"
                                          ? "Month & Year"
                                          : "Month & Year",
                                  font: { size: 14 }
                                }
                              },
                              y: {
                                beginAtZero: true,
                                ticks: { stepSize: 1 },
                                title: {
                                  display: true,
                                  text: "No. of questions",
                                  font: { size: 14 },
                                  color: "#374151"
                                }
                              }
                            },
                            plugins: {
                              legend: { display: false },
                              title: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: function (context) {
                                    return `Correct submissions: ${context.parsed.y}`;
                                  }
                                }
                              }
                            }
                          }}
                        />
                      )}
                    </div>
                  </div> */}

                  {/* Activity Calendar */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Activity Calendar (Last 6 Months)
                    </h3>
                    <ActivityCalendar submissions={profileData.allSubmissions} />
                  </div>
                </div>
              )}

              {activeTab === "submissions" && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      All Submissions ({profileData.allSubmissions?.length || 0}
                      )
                    </h3>
                    <div className="flex gap-3">
                      <select
                        className="bg-white/70 dark:bg-gray-700/70 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm backdrop-blur-sm"
                        onChange={(e) => {
                          const filtered = profileData.allSubmissions.filter(
                            (sub) =>
                              e.target.value === "All Languages" ||
                              sub.language === e.target.value
                          );
                          setProfileData((prev) => ({
                            ...prev,
                            recentSubmissions: filtered.slice(0, 10),
                          }));
                        }}
                      >
                        <option>All Languages</option>
                        <option>python</option>
                        <option>javascript</option>
                        <option>java</option>
                        <option>cpp</option>
                      </select>
                      <select
                        className="bg-white/70 dark:bg-gray-700/70 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm backdrop-blur-sm"
                        onChange={(e) => {
                          const filtered = profileData.allSubmissions.filter(
                            (sub) =>
                              e.target.value === "All Status" ||
                              sub.status === e.target.value
                          );
                          setProfileData((prev) => ({
                            ...prev,
                            recentSubmissions: filtered.slice(0, 10),
                          }));
                        }}
                      >
                        <option>All Status</option>
                        <option>Accepted</option>
                        <option>Wrong Answer</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto mb-6">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50/50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Problem
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Course
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Language
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          {/*
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Runtime
                          </th>
                          */}
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/30 dark:bg-gray-800/30 divide-y divide-gray-200 dark:divide-gray-700">
                        {profileData.recentSubmissions.map(
                          (submission, index) => (
                            <tr
                              key={index}
                              className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {submission.problem}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {submission.course} / {submission.subcourse}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {submission.language}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                    submission.status
                                  )}`}
                                >
                                  {submission.status}
                                </span>
                              </td>
                              {/*
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {submission.runtime}
                                </div>
                              </td>
                              */}

                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {submission.date || "N/A"}
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex justify-between items-center">
                    <button
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50"
                      disabled={profileData.recentSubmissions.length <= 10}
                      onClick={() => {
                        const currentIndex =
                          profileData.allSubmissions.findIndex(
                            (sub) =>
                              sub.timestamp ===
                              profileData.recentSubmissions[0].timestamp
                          );
                        const newIndex = Math.max(0, currentIndex - 10);
                        setProfileData((prev) => ({
                          ...prev,
                          recentSubmissions: prev.allSubmissions.slice(
                            newIndex,
                            newIndex + 10
                          ),
                        }));
                      }}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      (
                      {profileData.allSubmissions?.length || 0})
                    </span>
                    <button
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50"
                      disabled={
                        profileData.recentSubmissions.length === 0 ||
                        profileData.allSubmissions.length <=
                        profileData.recentSubmissions.length ||
                        profileData.recentSubmissions[
                          profileData.recentSubmissions.length - 1
                        ].timestamp ===
                        profileData.allSubmissions[
                          profileData.allSubmissions.length - 1
                        ].timestamp
                      }
                      onClick={() => {
                        const currentIndex =
                          profileData.allSubmissions.findIndex(
                            (sub) =>
                              sub.timestamp ===
                              profileData.recentSubmissions[
                                profileData.recentSubmissions.length - 1
                              ].timestamp
                          );
                        const newIndex = currentIndex + 1;
                        setProfileData((prev) => ({
                          ...prev,
                          recentSubmissions: prev.allSubmissions.slice(
                            newIndex,
                            newIndex + 10
                          ),
                        }));
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;