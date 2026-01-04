'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useParams } from "react-router-dom";
import { database } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import { useAuth } from '../context/AuthContext';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import case1 from '../assets/case1.pdf';
import case2 from '../assets/case2.pdf';

const Icons = {
    FileText: ({ className }) => (
        <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    GripVertical: () => (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h8M8 15h8" />
        </svg>
    ),
    Bold: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
    ),
    Italic: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m-4 0h4m-6 16h4" />
        </svg>
    ),
    List: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    ),
    Heading: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12h10M4 6v12M13 6v12M20 6v12" />
        </svg>
    ),
    ListOrdered: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 9l3 3-3 3m5-6h6m-6 6h6m-6 6h6" />
        </svg>
    ),
    Palette: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4 5 5 0 013-9s1.434-3.4 3.58-3.4a4.6 4.6 0 014.28 3.01c.21.52.56 1.1.97 1.41a6.6 6.6 0 011.66 2.3A4.4 4.4 0 0116 10a4 4 0 014 4h-2a2 2 0 00-2 2h-2a2 2 0 00-2 2z" />
        </svg>
    ),
    Type: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
    ),
    Indent: () => (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h11M4 12h7m-7 4h11m-3-4l3 3m0 0l-3 3" />
        </svg>
    ),
    Outdent: ({ className }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h11M4 12h11m-11 4h11m-11-4l-3-3m0 0l3 3" />
        </svg>
    ),
    History: ({ className }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    Undo: ({ className }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
    ),
    Redo: ({ className }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-12l-6 6m6-6l-6-6" />
        </svg>
    ),
    Save: ({ className }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
    ),
    X: ({ className }) => (
        <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    )
};

const CaseStudyPage = ({ data, navigation }) => {
    const [activePdf, setActivePdf] = useState(0); // 0 or 1
    const [text, setText] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [leftPanelWidth, setLeftPanelWidth] = useState(50);
    const [isPdfLoading, setIsPdfLoading] = useState(true);
    const [selectedColor, setSelectedColor] = useState("#000000");
    const [isSaving, setIsSaving] = useState(false);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState("pdf"); // "pdf" or "history"
    const editorRef = useRef(null);
    const hasInitializedRef = useRef(false);
    const { theme } = useTheme();
    const { user } = useAuth();
    const params = useParams();
    // Default values for testing when route params are missing
    const course = params.course || 'test_course';
    const questionId = params.questionId || 'case_study_1';
    const saveTimeoutRef = useRef(null);
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        element: 'p',
        ul: false,
        ol: false,
        color: '#000000'
    });

    // Helper to convert RGB to Hex
    const rgbToHex = (rgb) => {
        if (!rgb) return '#000000';
        // Check if already hex
        if (rgb.startsWith('#')) return rgb;
        // Parse rgb(r, g, b)
        const sep = rgb.indexOf(",") > -1 ? "," : " ";
        const rgbValues = rgb.substr(4).split(")")[0].split(sep);

        if (rgbValues.length < 3) return '#000000';

        let r = (+rgbValues[0]).toString(16),
            g = (+rgbValues[1]).toString(16),
            b = (+rgbValues[2]).toString(16);

        if (r.length < 2) r = "0" + r;
        if (g.length < 2) g = "0" + g;
        if (b.length < 2) b = "0" + b;

        return "#" + r + g + b;
    };

    // Use PDF URLs from props or fallback to placeholders
    const pdfUrls = [
        data?.pdfUrl1 || case1,
        data?.pdfUrl2 || case2
    ];

    // Reset loading state when active PDF changes
    useEffect(() => {
        setIsPdfLoading(true);
    }, [activePdf]);

    // Load saved text from Firebase
    useEffect(() => {
        const loadText = async () => {
            if (user && course && questionId) {
                // Sanitize path for Firebase
                const safeCourse = course.replace(/[.#$/\[\]]/g, '_');
                const safeQuestionId = questionId.replace(/[.#$/\[\]]/g, '_');
                // Use a 'current' node under the same structure for the active draft
                const textKey = `Casestudies/${user.uid}/${safeCourse}/${safeQuestionId}/current`;

                try {
                    const snapshot = await get(ref(database, textKey));
                    if (snapshot.exists() && !hasInitializedRef.current) {
                        const content = snapshot.val();
                        setText(content);
                        if (editorRef.current) {
                            editorRef.current.innerHTML = content;
                        }
                        hasInitializedRef.current = true;
                    } else if (!snapshot.exists()) {
                        hasInitializedRef.current = true;
                    }
                } catch (error) {
                    console.error("Error loading text:", error);
                }
            }
        };
        loadText();
    }, [user, course, questionId]);

    // Auto-save text to Firebase
    const handleTextChange = () => {
        if (!editorRef.current) return;

        const newText = editorRef.current.innerHTML;
        setText(newText);
        setIsSaving(true);

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            if (user && course && questionId) {
                const safeCourse = course.replace(/[.#$/\[\]]/g, '_');
                const safeQuestionId = questionId.replace(/[.#$/\[\]]/g, '_');
                const textKey = `Casestudies/${user.uid}/${safeCourse}/${safeQuestionId}/current`;

                try {
                    await set(ref(database, textKey), newText);
                    console.log("Text auto-saved");
                    setIsSaving(false);
                } catch (error) {
                    console.error("Error saving text:", error);
                    setIsSaving(false);
                }
            }
        }, 1000);

    };

    // Load history from Firebase
    useEffect(() => {
        const loadHistory = async () => {
            if (user && course && questionId) {
                const safeCourse = course.replace(/[.#$/\[\]]/g, '_');
                const safeQuestionId = questionId.replace(/[.#$/\[\]]/g, '_');
                const historyKey = `Casestudies/${user.uid}/${safeCourse}/${safeQuestionId}`;

                try {
                    const snapshot = await get(ref(database, historyKey));
                    if (snapshot.exists()) {
                        const historyData = snapshot.val();
                        // Convert object to array and sort by timestamp desc
                        const historyArray = Object.entries(historyData)
                            .map(([key, value]) => ({ id: key, ...value }))
                            .sort((a, b) => b.timestamp - a.timestamp);
                        setHistory(historyArray);
                    }
                } catch (error) {
                    console.error("Error loading history:", error);
                }
            }
        };
        loadHistory();
    }, [user, course, questionId]);

    const saveVersion = async () => {
        if (!user || !course || !questionId || !text) return;

        const safeCourse = course.replace(/[.#$/\[\]]/g, '_');
        const safeQuestionId = questionId.replace(/[.#$/\[\]]/g, '_');
        const historyKey = `Casestudies/${user.uid}/${safeCourse}/${safeQuestionId}`;
        const timestamp = Date.now();

        try {
            const newVersionRef = push(ref(database, historyKey));
            const newVersionKey = newVersionRef.key;

            await set(newVersionRef, {
                text: text,
                timestamp: timestamp
            });

            const newEntry = { id: newVersionKey, text: text, timestamp: timestamp };
            setHistory(prev => [newEntry, ...prev]);
            toast.success("Version snapshot saved!");
        } catch (error) {
            console.error("Error saving version:", error);
            toast.error("Failed to save version");
        }
    };

    const deleteVersion = async (e, versionId) => {
        e.stopPropagation(); // Prevent restoring the version when clicking delete

        if (!window.confirm("Are you sure you want to delete this version?")) return;

        const safeCourse = course.replace(/[.#$/\[\]]/g, '_');
        const safeQuestionId = questionId.replace(/[.#$/\[\]]/g, '_');
        const versionPath = `Casestudies/${user.uid}/${safeCourse}/${safeQuestionId}/${versionId}`;

        try {
            await remove(ref(database, versionPath));
            setHistory(prev => prev.filter(item => item.id !== versionId));
            toast.success("Version deleted");
        } catch (error) {
            console.error("Error deleting version:", error);
            toast.error("Failed to delete version");
        }
    };

    const restoreVersion = (versionText) => {
        setText(versionText);
        if (editorRef.current) {
            editorRef.current.innerHTML = versionText;
        }
        handleTextChange(); // Trigger save to main ref
        toast.info("Version restored!");
    };

    const checkFormats = () => {
        if (!document) return;

        try {
            const bold = document.queryCommandState('bold');
            const italic = document.queryCommandState('italic');
            const ul = document.queryCommandState('insertUnorderedList');
            const ol = document.queryCommandState('insertOrderedList');
            const blockType = document.queryCommandValue('formatBlock');
            const foreColor = document.queryCommandValue('foreColor');

            // Normalized block type (browsers can return 'p', 'h2', 'div', etc.)
            let element = 'p';
            if (blockType) {
                const lower = blockType.toLowerCase();
                if (lower === 'h2') element = 'h2';
                // Add more mappings if needed
            }

            setActiveFormats({
                bold,
                italic,
                element: blockType ? blockType.toLowerCase() : 'p',
                ul,
                ol,
                color: rgbToHex(foreColor)
            });
        } catch (e) {
            console.warn("Format check failed:", e);
        }
    };

    const execCommand = (command, value = null) => {
        if (editorRef.current) {
            editorRef.current.focus();
        }
        try {
            document.execCommand(command, false, value);
        } catch (e) {
            console.error("Command failed:", e);
        }
        handleTextChange();
        checkFormats();
    };

    const applyColor = (color, isToggleable = false) => {
        if (editorRef.current) {
            editorRef.current.focus();
        }

        let targetColor = color;
        // Check if we should toggle off the color (revert to default)
        // We compare case-insensitive just to be safe, though our activeFormats are usually hex
        if (isToggleable && activeFormats.color.toLowerCase() === color.toLowerCase()) {
            targetColor = theme === 'dark' ? '#FFFFFF' : '#000000';
        }

        // Enable modern CSS-based styling
        document.execCommand('styleWithCSS', false, true);

        // Try execCommand first as it handles complex selections better
        const success = document.execCommand('foreColor', false, targetColor);

        // Fallback for more robust application
        if (!success) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.style.color = targetColor;
                try {
                    range.surroundContents(span);
                } catch (e) {
                    console.warn("Manual color application failed:", e);
                }
            }
        }

        handleTextChange();
        checkFormats();
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth > 20 && newWidth < 80) {
            setLeftPanelWidth(newWidth);
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div className="h-[calc(100vh-4rem)] w-full flex bg-white dark:bg-gray-900 overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: PDF Viewer */}
                <div
                    className="flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 h-full"
                    style={{ width: `${leftPanelWidth}%` }}
                >
                    <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <button
                            onClick={() => { setActiveTab("pdf"); setActivePdf(0); }}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "pdf" && activePdf === 0
                                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/30'
                                : 'text-gray-500 hover:text-blue-500'
                                }`}
                        >
                            Case 1
                        </button>
                        <button
                            onClick={() => { setActiveTab("pdf"); setActivePdf(1); }}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === "pdf" && activePdf === 1
                                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/30'
                                : 'text-gray-500 hover:text-blue-500'
                                }`}
                        >
                            Case 2
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === "history"
                                ? 'text-purple-600 border-b-2 border-purple-500 bg-purple-50/30'
                                : 'text-gray-500 hover:text-purple-500'
                                }`}
                        >
                            <Icons.History />
                            History
                        </button>
                    </div>

                    <div className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-900">
                        {activeTab === "pdf" ? (
                            <>
                                {isPdfLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                                <iframe
                                    src={`${pdfUrls[activePdf]}#toolbar=0&navpanes=0&scrollbar=0`}
                                    className="w-full h-full border-none"
                                    title={`Case Study ${activePdf + 1}`}
                                    onLoad={() => setIsPdfLoading(false)}
                                />
                            </>
                        ) : (
                            <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-y-auto p-4 custom-scrollbar">
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                                    <Icons.History /> Version History
                                </h3>
                                {history.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                        <Icons.History />
                                        <p className="text-xs mt-2">No versions saved yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {history.map((version) => (
                                            <div
                                                key={version.id}
                                                className="p-3 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-purple-500 transition-all cursor-pointer group relative"
                                                onClick={() => restoreVersion(version.text)}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-tighter">Snapshot</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-400">
                                                            {new Date(version.timestamp).toLocaleString()}
                                                        </span>
                                                        <button
                                                            onClick={(e) => deleteVersion(e, version.id)}
                                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                            title="Delete Version"
                                                        >
                                                            <Icons.X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 italic pr-4">
                                                    {version.text.replace(/<[^>]*>/g, '').substring(0, 100)}...
                                                </p>
                                                <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Restore</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Draggable Divider */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize flex items-center justify-center transition-colors duration-150 ${isDragging ? 'bg-blue-500' : ''}`}
                    style={{ zIndex: 10 }}
                >
                    <Icons.GripVertical />
                </div>

                <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 h-full min-w-0">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 bg-white dark:bg-gray-800 shadow-sm z-20">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <Icons.FileText className="text-blue-600 dark:text-blue-400" />
                                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wider">Analysis Notes</h2>
                                </div>
                                {navigation?.showNavigation && (
                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                                        <button
                                            onClick={navigation.onPrevious}
                                            className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded transition-all active:scale-95 shadow-sm"
                                        >
                                            <navigation.NavigationIcons.ChevronLeft />
                                        </button>
                                        <span className="text-xs font-mono text-gray-500 min-w-[40px] text-center">
                                            {navigation.currentQuestionIndex + 1} / {navigation.totalQuestions}
                                        </span>
                                        <button
                                            onClick={navigation.onNext}
                                            className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded transition-all active:scale-95 shadow-sm"
                                        >
                                            <navigation.NavigationIcons.ChevronRight />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase transition-all duration-300 px-2 py-1 rounded-full flex items-center gap-1.5 ${isSaving
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                    {isSaving ? 'Syncing...' : 'Saved to Cloud'}
                                </span>
                                <button
                                    onClick={saveVersion}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all active:scale-95 shadow-sm shadow-purple-200 dark:shadow-none"
                                >
                                    <Icons.Save className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold uppercase">Save</span>
                                </button>
                            </div>
                        </div>

                        {/* Formatting Toolbar */}
                        <div className="flex flex-wrap items-center gap-2 py-1">
                            <div className="flex items-center gap-0.5 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner">
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('undo')}
                                    className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-all hover:shadow-sm active:scale-95"
                                    title="Undo (Ctrl+Z)"
                                >
                                    <Icons.Undo />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('redo')}
                                    className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-all hover:shadow-sm active:scale-95"
                                    title="Redo (Ctrl+Y)"
                                >
                                    <Icons.Redo />
                                </button>

                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1.5" />

                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('bold')}
                                    className={`p-2 rounded-lg transition-all hover:shadow-sm active:scale-95 ${activeFormats.bold
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    title="Bold"
                                >
                                    <Icons.Bold />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('italic')}
                                    className={`p-2 rounded-lg transition-all hover:shadow-sm active:scale-95 ${activeFormats.italic
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    title="Italic"
                                >
                                    <Icons.Italic />
                                </button>

                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1.5" />

                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('formatBlock', 'h2')}
                                    className={`p-2 rounded-lg transition-all hover:shadow-sm active:scale-95 flex items-center justify-center font-bold ${activeFormats.element === 'h2'
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    title="Heading"
                                >
                                    H
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('formatBlock', 'p')}
                                    className={`p-2 rounded-lg transition-all hover:shadow-sm active:scale-95 font-bold text-xs ${activeFormats.element === 'p' || activeFormats.element === 'div' // 'div' can sometimes be default depending on browser
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    title="Paragraph"
                                >
                                    P
                                </button>

                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1.5" />

                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('insertUnorderedList')}
                                    className={`p-2 rounded-lg transition-all hover:shadow-sm active:scale-95 ${activeFormats.ul
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    title="Bullet List"
                                >
                                    <Icons.List />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('insertOrderedList')}
                                    className={`p-2 rounded-lg transition-all hover:shadow-sm active:scale-95 ${activeFormats.ol
                                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                                        : 'hover:bg-white dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                                        }`}
                                    title="Numbered List"
                                >
                                    <Icons.ListOrdered />
                                </button>

                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1.5" />

                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('indent')}
                                    className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-all hover:shadow-sm active:scale-95"
                                    title="Increase Indent"
                                >
                                    <Icons.Indent />
                                </button>
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => execCommand('outdent')}
                                    className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-all hover:shadow-sm active:scale-95"
                                    title="Decrease Indent"
                                >
                                    <Icons.Outdent />
                                </button>

                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1.5" />

                                <div className="flex items-center gap-1.5 px-2 ml-1 border-l border-gray-300 dark:border-gray-700">
                                    {['#ef4444', '#22c55e', '#3b82f6', '#000000'].map(color => (
                                        <button
                                            key={color}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => applyColor(color, true)}
                                            className={`w-5 h-5 rounded-full border shadow-sm transition-transform hover:scale-125 ${activeFormats.color === color
                                                ? 'ring-2 ring-offset-2 ring-blue-500 border-transparent'
                                                : 'border-gray-200 dark:border-gray-600'
                                                }`}
                                            style={{ backgroundColor: color }}
                                            title={`Color ${color}`}
                                        />
                                    ))}

                                    <div className="relative flex items-center">
                                        <label
                                            className="cursor-pointer p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-all hover:shadow-sm active:scale-95 flex items-center justify-center"
                                            title="Custom Color"
                                        >
                                            <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                                                <Icons.Palette />
                                                <div className="w-3 h-0.5 rounded-full transition-colors duration-200" style={{ backgroundColor: activeFormats.color }}></div>
                                            </div>
                                            <input
                                                type="color"
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                value={activeFormats.color}
                                                onInput={(e) => {
                                                    const color = e.target.value;
                                                    setSelectedColor(color);
                                                    applyColor(color);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-white dark:bg-gray-900 p-8 custom-scrollbar">
                        <div
                            ref={editorRef}
                            contentEditable
                            onInput={handleTextChange}
                            className="min-h-full w-full max-w-4xl mx-auto text-lg leading-relaxed bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-0 rich-text-editor max-w-none"
                            style={{
                                fontFamily: 'Inter, system-ui, sans-serif',
                                caretColor: '#3B82F6'
                            }}
                            onKeyUp={checkFormats}
                            onMouseUp={checkFormats}
                            onClick={checkFormats}
                            onKeyDown={(e) => {
                                if (e.key === 'Tab') {
                                    e.preventDefault();
                                    document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
            <style jsx="true">{`
                .rich-text-editor ul {
                    list-style-type: disc;
                    margin-left: 1.5rem;
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                .rich-text-editor ol {
                    list-style-type: decimal;
                    margin-left: 1.5rem;
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                .rich-text-editor li {
                    margin-bottom: 0.25rem;
                    padding-left: 0.25rem;
                }
                .rich-text-editor h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    line-height: 1.25;
                }
                .rich-text-editor p {
                    margin-bottom: 1rem;
                }
            `}</style>
        </div>
    );
};

export default CaseStudyPage;
