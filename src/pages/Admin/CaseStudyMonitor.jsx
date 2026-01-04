import React, { useState, useEffect, useMemo } from 'react';
import { database } from "../../firebase";
import { ref, get } from "firebase/database";
import {
    FiUser,
    FiSearch,
    FiRefreshCw,
    FiFilter,
    FiEye,
    FiBookOpen,
    FiClock,
    FiFileText
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const CaseStudyMonitor = () => {
    const [students, setStudents] = useState([]);
    const [users, setUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [filter, setFilter] = useState('');

    const fetchData = async () => {
        try {
            const [caseStudiesSnap, usersSnap] = await Promise.all([
                get(ref(database, 'Casestudies')),
                get(ref(database, 'users'))
            ]);

            const caseStudiesData = caseStudiesSnap.exists() ? caseStudiesSnap.val() : {};
            const usersData = usersSnap.exists() ? usersSnap.val() : {};

            setUsers(usersData);

            // Process students
            const processedStudents = Object.entries(caseStudiesData).map(([uid, courses]) => {
                const userProfile = usersData[uid] || {};

                // Calculate stats
                let totalVersions = 0;
                let activeDrafts = 0;
                let lastActivity = 0;

                Object.values(courses).forEach(questions => {
                    Object.values(questions).forEach(qData => {
                        if (qData.current) activeDrafts++;
                        const versions = Object.keys(qData).filter(k => k !== 'current');
                        totalVersions += versions.length;

                        // Find latest timestamp
                        versions.forEach(vKey => {
                            // Assuming vKey or qData[vKey].timestamp holds time
                            // If vKey is push key, we look at payload. But let's look at qData[vKey]
                            const version = qData[vKey];
                            if (version && version.timestamp > lastActivity) {
                                lastActivity = version.timestamp;
                            }
                        });
                    });
                });

                return {
                    uid,
                    name: userProfile.name || 'Anonymous',
                    email: userProfile.email || 'No Email',
                    photo: userProfile.profilePhoto || null,
                    courses,
                    stats: {
                        totalVersions,
                        activeDrafts,
                        lastActivity
                    }
                };
            });

            setStudents(processedStudents);
            setLoading(false);
            setRefreshing(false);
        } catch (error) {
            console.error("Error fetching monitor data:", error);
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const filteredStudents = useMemo(() => {
        if (!filter) return students;
        const lowerFilter = filter.toLowerCase();
        return students.filter(student =>
            student.name.toLowerCase().includes(lowerFilter) ||
            student.email.toLowerCase().includes(lowerFilter) ||
            student.uid.includes(lowerFilter)
        );
    }, [students, filter]);

    if (loading && !refreshing) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-300">Case Study Monitor</h1>
                            <p className="text-gray-600 dark:text-gray-400">Track student case study progress and versions</p>
                        </div>
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
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                                    {filteredStudents.length} Students Active
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Search */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-3 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or UID..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {filteredStudents.map(student => (
                            <motion.div
                                key={student.uid}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden">
                                                {student.photo ? (
                                                    <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <FiUser className="text-blue-600 dark:text-blue-400 w-6 h-6" />
                                                )}
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="font-bold text-gray-900 dark:text-gray-100">{student.name}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]" title={student.email}>
                                                    {student.email}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedStudent(student)}
                                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-gray-50 dark:bg-gray-700 rounded-full"
                                        >
                                            <FiEye size={20} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <div className="text-xl font-bold text-purple-700 dark:text-purple-400">
                                                {Object.keys(student.courses).length}
                                            </div>
                                            <div className="text-xs text-purple-600 dark:text-purple-300 font-medium">Active Courses</div>
                                        </div>
                                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                            <div className="text-xl font-bold text-green-700 dark:text-green-400">
                                                {student.stats.activeDrafts}
                                            </div>
                                            <div className="text-xs text-green-600 dark:text-green-300 font-medium">Active Drafts</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <FiFileText /> {student.stats.totalVersions} Versions Saved
                                        </span>
                                        {student.stats.lastActivity > 0 && (
                                            <span className="flex items-center gap-1">
                                                <FiClock /> {new Date(student.stats.lastActivity).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Modal */}
            {selectedStudent && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden">
                                    {selectedStudent.photo ? (
                                        <img src={selectedStudent.photo} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <FiUser className="text-blue-600 dark:text-blue-400 w-6 h-6" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {selectedStudent.name}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStudent.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                            {Object.entries(selectedStudent.courses).map(([courseId, questions]) => (
                                <div key={courseId} className="mb-8 last:mb-0">
                                    <div className="flex items-center gap-2 mb-4">
                                        <FiBookOpen className="text-blue-600 dark:text-blue-400" />
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                                            {courseId.replace(/_/g, ' ')}
                                        </h3>
                                    </div>

                                    <div className="grid gap-4">
                                        {Object.entries(questions).map(([questionId, data]) => {
                                            const versions = Object.entries(data)
                                                .filter(([key]) => key !== 'current')
                                                .map(([key, val]) => ({ id: key, ...val }))
                                                .sort((a, b) => b.timestamp - a.timestamp);

                                            return (
                                                <div key={questionId} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/50">
                                                    <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                                            {questionId.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${data.current ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>
                                                            {data.current ? 'Active Draft' : 'No Draft'}
                                                        </span>
                                                    </div>

                                                    <div className="p-4 grid md:grid-cols-2 gap-4">
                                                        {/* Current Draft */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Current Draft Preview</h4>
                                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 h-32 overflow-hidden relative">
                                                                <p className="text-sm text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap">
                                                                    {data.current ? data.current.replace(/<[^>]*>/g, '').substring(0, 200) : <span className="text-gray-400 italic">Empty draft...</span>}
                                                                </p>
                                                                {data.current && <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-gray-800 to-transparent"></div>}
                                                            </div>
                                                        </div>

                                                        {/* Version History */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Saved Versions ({versions.length})</h4>
                                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 h-32 overflow-y-auto scrollbar-thin">
                                                                {versions.length > 0 ? (
                                                                    <div className="space-y-2">
                                                                        {versions.map(v => (
                                                                            <div key={v.id} className="flex justify-between items-center text-xs p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors group">
                                                                                <span className="text-gray-600 dark:text-gray-300">
                                                                                    {new Date(v.timestamp).toLocaleString()}
                                                                                </span>
                                                                                <span className="text-gray-400 group-hover:text-blue-500">
                                                                                    {v.text.length} chars
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-gray-400 italic">No saved versions yet.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default CaseStudyMonitor;
