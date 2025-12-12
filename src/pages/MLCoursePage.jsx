import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PythonRunner from '../components/PythonRunner';
import { mlQuestions } from '../data/mlQuestions';
import { useTheme } from '../context/ThemeContext';


const MLCoursePage = () => {
    const { questionId } = useParams();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // LANDING PAGE VIEW: If no questionId is selected, show the course list
    if (!questionId) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-blue-500/30">
                {/* Background Gradients */}
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
                </div>

                {/* Navbar */}
                <nav className="relative z-10 border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                                ML
                            </div>
                            <span className="font-bold text-lg tracking-tight">AlgoCore ML</span>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="text-sm font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <span>Back to Hub</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="relative z-10 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center max-w-4xl mx-auto px-4">
                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-white">
                            Master Machine Learning
                        </span>
                        <br />
                        <span className="text-white">Through Code</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                        Interactive Python notebooks, real-time visualization, and hands-on algorithms.
                        No setup required—run code directly in your browser.
                    </p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => {
                            const firstModule = mlQuestions[0];
                            if (firstModule) navigate(`/ml-course/${firstModule.id}`);
                        }} className="px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-all transform hover:scale-105 shadow-lg shadow-white/10">
                            Start Learning
                        </button>
                    </div>
                </div>

                {/* Course Grid */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-white">Curriculum</h2>
                        <span className="text-sm text-gray-500">{mlQuestions.length} Modules Available</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {mlQuestions.map((module, index) => (
                            <div
                                key={module.id}
                                onClick={() => navigate(`/ml-course/${module.id}`)}
                                className="group relative bg-[#18181b] rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-all duration-300 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
                            >
                                {/* Card Glow Effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="p-6 relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                            <span className="font-mono font-bold text-sm">0{index + 1}</span>
                                        </div>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                            Interactive
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                        {module.title}
                                    </h3>

                                    <p className="text-gray-400 text-sm line-clamp-2 h-10 mb-6">
                                        {module.description.slice(0, 120).replace(/[#*_]/g, '')}...
                                    </p>

                                    <div className="flex items-center justify-between border-t border-gray-700/50 pt-4 mt-auto">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>~15 min</span>
                                        </div>
                                        <div className="flex items-center text-blue-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                            Start Code
                                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // WORKSPACE VIEW: Split Pane Description + Runner
    const activeQuestion = mlQuestions.find(q => q.id === questionId);

    if (!activeQuestion) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Module Not Found</h2>
                    <button onClick={() => navigate('/ml-course')} className="text-blue-400 hover:underline">Return to Course List</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-300 font-sans overflow-hidden transition-colors duration-200">
            {/* Main Workspace */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Top thin progress/nav bar could go here, but keeping it simple as requested */}

                <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
                    {/* LEFT PANE: Description */}
                    <div className="w-full md:w-5/12 lg:w-4/12 h-full flex flex-col border-r border-gray-200 dark:border-[#27272a] bg-gray-50 dark:bg-[#0a0a0a]/50 overflow-hidden">
                        {/* Description Header */}
                        <div className="h-14 px-6 flex justify-between items-center border-b border-gray-200 dark:border-[#27272a] bg-white dark:bg-[#0a0a0a]">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => navigate('/ml-course')}
                                    className="p-1.5 rounded-md text-gray-500 hover:text-black hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-[#27272a] transition-all"
                                    title="Back to Course List"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                                </button>
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide uppercase truncate max-w-[200px]">{activeQuestion.title}</h2>
                            </div>
                            <span className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-500 uppercase bg-blue-100 dark:bg-blue-500/10 px-2 py-1 rounded-sm border border-blue-200 dark:border-blue-500/20">
                                Guide
                            </span>
                        </div>

                        {/* Description Body */}
                        <div className="flex-1 overflow-y-auto p-6 prose prose-slate dark:prose-invert prose-sm max-w-none scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-[#27272a] scrollbar-track-transparent">
                            <div className="whitespace-pre-wrap font-sans text-gray-800 dark:text-gray-300 leading-7 text-[15px]">
                                {activeQuestion.description.trim()}
                            </div>

                            <div className="mt-8 p-5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-[50px] -mr-10 -mt-10 pointer-events-none"></div>
                                <h4 className="text-blue-600 dark:text-blue-400 font-bold mb-2 text-xs uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Tip
                                </h4>
                                <p className="text-blue-800/80 dark:text-blue-200/70 text-sm leading-relaxed">
                                    Remember to run your imports first. Variables defined in one cell are available in all others!
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANE: Python Runner */}
                    <div className="w-full md:w-7/12 lg:w-8/12 h-full bg-white dark:bg-[#1e1e1e] flex flex-col relative border-l border-gray-200 dark:border-[#27272a] -ml-[1px]">
                        {/* We wrap PythonRunner to ensure it takes height properly */}
                        <PythonRunner
                            key={activeQuestion.id}
                            initialCode={activeQuestion.initialCode}
                            storageKey={`ml_course_code_${activeQuestion.id}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MLCoursePage;
