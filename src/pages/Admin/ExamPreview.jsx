import React, { useState, useEffect } from 'react';
import { FiEye, FiCheck, FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import LoadingPage from '../LoadingPage';
import DynamicComponent from '../Exam/DynamicComponent';

const ExamPreview = ({ test, testId, duration }) => {
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [questionIds, setQuestionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = React.useRef(null);

  useEffect(() => {
    const fetchPreviewQuestions = async () => {
      if (!test?.questions) {
        setLoading(false);
        return;
      }

      try {
        const qIds = Object.keys(test.questions);
        const allQuestionsData = [];

        // Fetch all questions
        for (const qId of qIds) {
          const questionRef = ref(database, `questions/${qId}`);
          const snapshot = await get(questionRef);
          if (snapshot.exists()) {
            allQuestionsData.push({ id: qId, ...snapshot.val() });
          }
        }

        // Get configuration for questions per type
        const config = test?.configure?.questionsPerType || {};
        const mcqCount = parseInt(config.mcq) || 0;
        const programmingCount = parseInt(config.programming) || 0;
        const sqlCount = parseInt(config.sql) || 0;
        const otherCount = parseInt(config.other) || 0;

        // Group questions by type
        const questionsByType = {
          mcq: [],
          programming: [],
          sql: [],
          other: []
        };

        allQuestionsData.forEach(q => {
          const type = q.type?.toLowerCase() || 'other';
          if (type === 'mcq') {
            questionsByType.mcq.push(q);
          } else if (type === 'programming') {
            questionsByType.programming.push(q);
          } else if (type === 'sql') {
            questionsByType.sql.push(q);
          } else {
            questionsByType.other.push(q);
          }
        });

        // Select configured number of questions per type (randomly)
        const selectedQuestions = [];
        const selectedIds = [];

        // Helper to shuffle array
        const shuffle = (array) => {
          const shuffled = [...array];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          return shuffled;
        };

        // Select MCQ questions
        if (mcqCount > 0) {
          const shuffled = shuffle(questionsByType.mcq);
          const selected = shuffled.slice(0, mcqCount);
          selectedQuestions.push(...selected);
          selectedIds.push(...selected.map(q => q.id));
        }

        // Select Programming questions
        if (programmingCount > 0) {
          const shuffled = shuffle(questionsByType.programming);
          const selected = shuffled.slice(0, programmingCount);
          selectedQuestions.push(...selected);
          selectedIds.push(...selected.map(q => q.id));
        }

        // Select SQL questions
        if (sqlCount > 0) {
          const shuffled = shuffle(questionsByType.sql);
          const selected = shuffled.slice(0, sqlCount);
          selectedQuestions.push(...selected);
          selectedIds.push(...selected.map(q => q.id));
        }

        // Select Other questions
        if (otherCount > 0) {
          const shuffled = shuffle(questionsByType.other);
          const selected = shuffled.slice(0, otherCount);
          selectedQuestions.push(...selected);
          selectedIds.push(...selected.map(q => q.id));
        }

        // If no configuration, show all questions
        if (selectedQuestions.length === 0) {
          setQuestionIds(qIds);
          setPreviewQuestions(allQuestionsData);
        } else {
          setQuestionIds(selectedIds);
          setPreviewQuestions(selectedQuestions);
        }
      } catch (error) {
        console.error('Error fetching preview questions:', error);
        toast.error('Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewQuestions();
  }, [test?.questions, test?.configure?.questionsPerType]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return <LoadingPage message="Loading exam preview..." />;
  }

  if (previewQuestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
        <FiEye className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No Questions Added</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add questions to this exam to see the preview.
        </p>
      </div>
    );
  }

  const goToQuestion = (index) => {
    setActiveQuestion(index);
  };

  const goToPreviousQuestion = () => {
    if (activeQuestion > 0) {
      setActiveQuestion(activeQuestion - 1);
    }
  };

  const goToNextQuestion = () => {
    if (activeQuestion < previewQuestions.length - 1) {
      setActiveQuestion(activeQuestion + 1);
    }
  };

  const startFullscreenPreview = async () => {
    try {
      if (containerRef.current) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      toast.error('Failed to enter fullscreen mode');
    }
  };

  const exitFullscreenPreview = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  };

  return (
    <div ref={containerRef} className="h-screen bg-gray-50 dark:bg-gray-900">
      {!isFullscreen ? (
        <div className="flex items-center justify-center h-full">
          <div className="max-w-2xl mx-auto p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl text-center">
            <div className="mb-6">
              <FiEye className="mx-auto h-16 w-16 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Exam Preview Mode
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Experience the exam exactly as students will see it. The preview will open in fullscreen mode to simulate the real exam environment.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Preview Details:</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-left">
                    <p className="text-blue-700 dark:text-blue-300"><span className="font-medium">Exam:</span> {test?.name || 'Loading...'}</p>
                    <p className="text-blue-700 dark:text-blue-300"><span className="font-medium">Total Questions:</span> {previewQuestions.length}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-blue-700 dark:text-blue-300"><span className="font-medium">Duration:</span> {duration} minutes</p>
                    <p className="text-blue-700 dark:text-blue-300"><span className="font-medium">Mode:</span> Read-only preview</p>
                  </div>
                </div>
                {test?.configure?.questionsPerType && (
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Question Distribution:</p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {parseInt(test.configure.questionsPerType.mcq) > 0 && (
                        <div className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                          <span className="font-medium text-green-700 dark:text-green-300">MCQ: {test.configure.questionsPerType.mcq}</span>
                        </div>
                      )}
                      {parseInt(test.configure.questionsPerType.programming) > 0 && (
                        <div className="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                          <span className="font-medium text-purple-700 dark:text-purple-300">Programming: {test.configure.questionsPerType.programming}</span>
                        </div>
                      )}
                      {parseInt(test.configure.questionsPerType.sql) > 0 && (
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                          <span className="font-medium text-yellow-700 dark:text-yellow-300">SQL: {test.configure.questionsPerType.sql}</span>
                        </div>
                      )}
                      {parseInt(test.configure.questionsPerType.other) > 0 && (
                        <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          <span className="font-medium text-gray-700 dark:text-gray-300">Other: {test.configure.questionsPerType.other}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={startFullscreenPreview}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                Start Fullscreen Preview
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Press ESC to exit fullscreen at any time
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{test?.name || 'Exam Preview'}</h1>
          <span className="px-3 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
            PREVIEW MODE
          </span>
        </div>

        <div className="flex items-center space-x-4">
          {/* Duration */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{duration} min</span>
          </div>

          {/* Progress */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {activeQuestion + 1} / {previewQuestions.length}
            </span>
            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                style={{ width: `${((activeQuestion + 1) / previewQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousQuestion}
              disabled={activeQuestion === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={goToNextQuestion}
              disabled={activeQuestion === previewQuestions.length - 1}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Question Navigation Sidebar */}
        {isMenuOpen && (
          <div className="w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white">Questions</h3>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-500"
              >
                <FiX size={20} />
              </button>
            </div>
            <div>
              {previewQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => {
                    goToQuestion(index);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    activeQuestion === index
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full mr-2 text-sm font-medium ${
                      activeQuestion === index
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex flex-col flex-1">
                      <span className="truncate text-sm font-medium">
                        {question.title || `Question ${index + 1}`}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide font-semibold text-purple-600 dark:text-purple-300">
                        {question.type}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <DynamicComponent question={questionIds[activeQuestion]} />
        </div>
      </div>
        </div>
      )}
    </div>
  );
};

export default ExamPreview;
