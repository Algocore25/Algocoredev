import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiUsers, FiSettings, FiTrash2, FiEdit2, FiX, FiCheck, FiUserPlus, FiMail, FiEye } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { ref, onValue, set, push, update, remove, get } from 'firebase/database';
import { database } from '../../firebase';
import Questions from './Questions';
import Students from './Students';
import LoadingPage from '../LoadingPage';
import ExamPreview from './ExamPreview';

const TestManage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  // State management
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    // Load the saved tab from localStorage, default to 'questions'
    return localStorage.getItem('testManageActiveTab') || 'questions';
  }); // 'students', 'questions' or 'settings'
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [isSaving, setIsSaving] = useState(false);
  const [enableVideoProctoring, setEnableVideoProctoring] = useState(true);
  const [blockOnViolations, setBlockOnViolations] = useState(false);
  // Initialize state with default values
  const [questionsPerType, setQuestionsPerType] = useState({
    mcq: 0,
    programming: 0,
    sql: 0,
    other: 0
  });

  // Categorize questions
  const getQuestionCategories = useCallback((questions = []) => {
    const categories = {
      mcq: { name: 'MCQ', count: 0, selected: 0 },
      programming: { name: 'programming', count: 0, selected: 0 },
      sql: { name: 'SQL', count: 0, selected: 0 },
      other: { name: 'Other', count: 0, selected: 0 }
    };

    if (!questions || typeof questions !== 'object') return categories;

    // Get all question types
    const questionTypes = Object.values(questions);

    // Count total questions by type
    questionTypes.forEach(type => {
      const typeStr = String(type || '').toLowerCase();

      if (typeStr === 'mcq') {
        categories.mcq.count++;
      } else if (typeStr === 'programming' || typeStr === 'programming') {
        categories.programming.count++;
      } else if (typeStr === 'sql') {
        categories.sql.count++;
      } else if (typeStr) {
        categories.other.count++;
      }
    });

    // Count selected questions (assuming selected questions are stored in test.selectedQuestions)
    if (test?.selectedQuestions) {
      const selectedTypes = Object.values(test.selectedQuestions).map(q =>
        String(q.type || '').toLowerCase()
      );

      selectedTypes.forEach(type => {
        if (type === 'mcq') categories.mcq.selected++;
        else if (type === 'programming' || type === 'programming') categories.programming.selected++;
        else if (type === 'sql') categories.sql.selected++;
        else if (type) categories.other.selected++;
      });
    }

    return categories;
  }, []);

  // Calculate question statistics
  const questionStats = useMemo(() => {
    if (!test?.questions) return { total: 0, categories: {} };

    const categories = getQuestionCategories(test.questions);
    const total = Object.values(categories).reduce((sum, cat) => sum + cat.count, 0);

    return { total, categories };
  }, [test?.questions, getQuestionCategories]);

  // Initialize questionsPerType only once when test data is first loaded
  useEffect(() => {
    if (test?.configure?.questionsPerType) {
      // Use the configuration from the test object
      const config = test.configure.questionsPerType;
      setQuestionsPerType({
        mcq: Number(config.mcq) || 0,
        programming: Number(config.programming) || 0,
        sql: Number(config.sql) || 0,
        other: Number(config.other) || 0
      });
    } else if (test?.questions) {
      // Initialize with default values if no config exists
      const defaultValues = {
        mcq: 0,
        programming: 0,
        sql: 0,
        other: 0
      };
      setQuestionsPerType(defaultValues);
      
      // Save default config to Firebase if it doesn't exist
      const saveDefaultConfig = async () => {
        try {
          await set(ref(database, `Exam/${testId}/configure`), {
            questionsPerType: defaultValues,
            updatedAt: Date.now()
          });
        } catch (error) {
          console.error('Error saving default config:', error);
        }
      };
      saveDefaultConfig();
    }
  }, [test?.questions, test?.configure?.questionsPerType, testId]);

  // Fetch test data and configuration
  useEffect(() => {
    const fetchTestData = async () => {
      try {
        const testRef = ref(database, `Exam/${testId}`);
        const testSnapshot = await get(testRef);

        if (testSnapshot.exists()) {
          const testData = testSnapshot.val();
          setTest(testData);
          
          // Set test title from database
          if (testData.name) {
            setTestTitle(testData.name);
          }
          
          // Calculate question statistics
          const stats = getQuestionCategories(testData.questions);
          setQuestionStats(stats);

          // Set duration if available
          if (testData.duration) {
            setDuration(testData.duration);
          }

          // Set proctoring settings if available
          if (testData.proctorSettings) {
            setEnableVideoProctoring(
              testData.proctorSettings.enableVideoProctoring === undefined 
                ? true 
                : testData.proctorSettings.enableVideoProctoring
            );
            setBlockOnViolations(
              testData.proctorSettings.blockOnViolations === true
            );
          }

          // Load saved configuration if exists
          const configRef = ref(database, `Exam/${testId}/configure`);
          const configSnapshot = await get(configRef);
          
          if (configSnapshot.exists() && configSnapshot.val().questionsPerType) {
            const savedConfig = configSnapshot.val().questionsPerType;
            // Update questionsPerType state with saved values
            const updatedQuestionsPerType = {
              mcq: Number(savedConfig.mcq) || 0,
              programming: Number(savedConfig.programming) || 0,
              sql: Number(savedConfig.sql) || 0,
              other: Number(savedConfig.other) || 0
            };
            
            setQuestionsPerType(updatedQuestionsPerType);
            
            // Update test data with the loaded config
            setTest(prev => ({
              ...prev,
              configure: {
                questionsPerType: updatedQuestionsPerType,
                updatedAt: configSnapshot.val().updatedAt || Date.now()
              }
            }));
          }
        } else {
          console.error('Test not found');
          setTest(null);
        }
      } catch (error) {
        console.error('Error fetching test data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (testId) {
      fetchTestData();
    }
  }, [testId, getQuestionCategories]);

  // Real-time listener for proctorSettings changes
  useEffect(() => {
    if (!testId) return;

    const proctorSettingsRef = ref(database, `Exam/${testId}/proctorSettings`);
    const unsubscribe = onValue(proctorSettingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.val();
        console.log('[TestManage] ProctorSettings from Firebase:', settings);
        
        setEnableVideoProctoring(
          settings.enableVideoProctoring === undefined 
            ? true 
            : settings.enableVideoProctoring
        );
        setBlockOnViolations(
          settings.blockOnViolations === true
        );
        
        // Update test state
        setTest(prev => ({
          ...prev,
          proctorSettings: settings
        }));
      } else {
        console.log('[TestManage] No proctorSettings found in Firebase, using defaults');
        // Set defaults if no settings exist
        setEnableVideoProctoring(true);
        setBlockOnViolations(false);
      }
    });

    return () => unsubscribe();
  }, [testId]);

  // Real-time listener for duration changes
  useEffect(() => {
    if (!testId) return;

    const durationRef = ref(database, `Exam/${testId}/duration`);
    const unsubscribe = onValue(durationRef, (snapshot) => {
      if (snapshot.exists()) {
        const durationValue = snapshot.val();
        console.log('[TestManage] Duration from Firebase:', durationValue);
        setDuration(durationValue);
        
        // Update test state
        setTest(prev => ({
          ...prev,
          duration: durationValue
        }));
      } else {
        console.log('[TestManage] No duration found in Firebase, using default');
        setDuration(60); // Default 60 minutes
      }
    });

    return () => unsubscribe();
  }, [testId]);

  // Real-time listener for test name changes
  useEffect(() => {
    if (!testId) return;

    const nameRef = ref(database, `Exam/${testId}/name`);
    const unsubscribe = onValue(nameRef, (snapshot) => {
      if (snapshot.exists()) {
        const nameValue = snapshot.val();
        console.log('[TestManage] Test name from Firebase:', nameValue);
        setTestTitle(nameValue);
        
        // Update test state
        setTest(prev => ({
          ...prev,
          name: nameValue
        }));
      }
    });

    return () => unsubscribe();
  }, [testId]);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('testManageActiveTab', activeTab);
  }, [activeTab]);

  // Fetch students
  const fetchStudents = async (testId) => {
    try {
      const eligibleRef = ref(database, `Exam/${testId}/Eligible`);
      const snapshot = await get(eligibleRef);

      if (!snapshot.exists()) {
        console.log('No student data found in Firebase');
        return { eligibleStudents: {}, enrolledStudents: [] };
      }

      const eligibleData = snapshot.val();
      console.log('Raw student data from Firebase:', eligibleData);

      // The data is already in the desired { name: email } format or similar.
      // We will ensure it's a clean object.
      const eligibleStudents = (typeof eligibleData === 'object' && eligibleData !== null) ? eligibleData : {};

      console.log('Processed students:', eligibleStudents);
      return {
        eligibleStudents,
        // enrolledStudents can be derived from the keys of the eligible object
        enrolledStudents: Object.keys(eligibleStudents)
      };
    } catch (error) {
      console.error('Error fetching students:', error);
      return { eligibleStudents: {}, enrolledStudents: [] };
    }
  };

  // Test management methods
  const updateTest = async (updates) => {
    try {
      await update(ref(database, `Exam/${testId}`), updates);
      toast.success('Test updated successfully');
    } catch (err) {
      toast.error('Failed to update test');
      throw err;
    }
  };

  const handleSaveTest = useCallback(async (updatedData) => {
    if (!test) return;

    try {
      setIsSaving(true);
      await updateTest(updatedData);
      toast.success('Test updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating test:', error);
      toast.error('Failed to update test');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [test, updateTest]);

  const handleUpdateTitle = useCallback(async () => {
    if (!testTitle.trim()) {
      toast.error('Test title cannot be empty');
      return;
    }

    const success = await handleSaveTest({ ...test, name: testTitle });
    if (success) {
      setIsEditingTitle(false);
    }
  }, [test, testTitle, handleSaveTest]);

  // Auto-save test title on blur
  const handleTitleBlur = useCallback(async () => {
    if (!testTitle.trim()) {
      toast.error('Test title cannot be empty');
      setTestTitle(test?.name || '');
      return;
    }
    if (testTitle !== test?.name) {
      await handleSaveTest({ name: testTitle });
      setTest(prev => ({ ...prev, name: testTitle }));
    }
  }, [testTitle, test, handleSaveTest]);

  // Function to handle question type changes
  const handleQuestionTypeChange = useCallback(async (key, value, max) => {
    const numValue = Math.min(parseInt(value) || 0, max);
    
    // Optimistically update local state
    setQuestionsPerType(prev => {
      const newState = {
        ...prev,
        [key]: numValue
      };
      
      // Update Firebase in the background
      const updateFirebase = async () => {
        try {
          await set(ref(database, `Exam/${testId}/configure`), {
            questionsPerType: newState,
            updatedAt: Date.now()
          });
          
          // Update the test state with the new configuration
          setTest(prevTest => ({
            ...prevTest,
            configure: {
              ...prevTest?.configure,
              questionsPerType: newState,
              updatedAt: Date.now()
            }
          }));
        } catch (error) {
          console.error('Error updating question configuration:', error);
          toast.error('Failed to update configuration');
          
          // Revert local state on error
          setQuestionsPerType(prev => ({
            ...prev,
            [key]: prev[key]
          }));
        }
      };
      
      updateFirebase();
      
      return newState;
    });
  }, [testId]);

  if (loading) {
    return (
      <LoadingPage message="Loading test, please wait..." />
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Test not found</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">The requested test could not be found.</p>
          <button
            onClick={() => navigate('/tests')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
          >
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Back to tests"
              >
                <FiChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex items-center">
                {isEditingTitle ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      className="text-xl font-semibold bg-transparent border-b border-blue-500 focus:outline-none focus:ring-0 px-1 py-0.5"
                      autoFocus
                    />
                    <div className="flex space-x-1">
                      <button
                        onClick={handleUpdateTitle}
                        className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        disabled={isSaving}
                      >
                        <FiCheck className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingTitle(false);
                          setTestTitle(test.name || '');
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        disabled={isSaving}
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {test.name}
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Edit title"
                    >
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                  </h1>
                )}
              </div>

              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                  {Object.keys(test?.questions || {}).length} Questions
                </span>
              </div>
            </div>

          </div>

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">

              <button
                onClick={() => setActiveTab('questions')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                  }`}
              >
                Questions
              </button>

              <button
                onClick={() => setActiveTab('students')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'students'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                  }`}
              >
                Manage Students
              </button>

              <button
                onClick={() => setActiveTab('preview')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                  }`}
              >
                <FiEye className="inline mr-1.5 h-4 w-4" />
                Preview
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                  }`}
              >
                <FiSettings className="inline mr-1.5 h-4 w-4" />
                Settings
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'questions' && (
          <Questions test={test} setTest={setTest} testId={testId} />
        )}
        {activeTab === 'students' && (
          <Students test={test} testId={testId} />
        )}
        {activeTab === 'preview' && (
          <ExamPreview test={test} testId={testId} duration={duration} />
        )}
        {activeTab === 'settings' && (
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Test Settings</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Configure the test settings and rules.

                <br></br>

                Future Updates
              </p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
              {/* Question Summary */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Question Summary
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Questions</p>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {Object.keys(test?.questions || {}).length}
                      </p>
                    </div>
                    {Object.entries(questionStats.categories).map(([key, category]) => (
                      category.count > 0 && (
                        <div key={key} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {category.name} Questions
                            {category.selected > 0 && (
                              <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                {category.selected} selected
                              </span>
                            )}
                          </p>
                          <div className="mt-1">
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                              {category.count}
                              <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                                ({(() => {
                                  const totalQuestions = Object.keys(test?.questions || {}).length || 1;
                                  const percentage = (category.count / totalQuestions) * 100;
                                  return Math.round(percentage) + '%';
                                })()})
                              </span>
                            </p>
                            {category.selected > 0 && (
                              <div className="mt-1">
                                <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-600">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${(category.selected / category.count) * 100}%` }}
                                  ></div>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {category.selected} of {category.count} selected ({Math.round((category.selected / category.count) * 100)}%)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>

              {/* Question Configuration */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Question Configuration
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="space-y-4">
                    {Object.entries(questionStats.categories).map(([key, category]) => (
                      category.count > 0 && (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {category.name} Questions
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                (Max: {category.count} available)
                              </span>
                            </p>
                            {category.selected > 0 && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {category.selected} currently selected
                              </p>
                            )}
                          </div>
                          <select
                            value={questionsPerType[key] || 0}
                            onChange={(e) => handleQuestionTypeChange(key, e.target.value, category.count)}
                            className="mt-1 block w-24 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                          >
                            {Array.from({ length: category.count + 1 }, (_, i) => i).map(num => (
                              <option key={num} value={num}>
                                {num}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      {isSaving ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </span>
                      ) : (
                        <span className="text-green-500">
                          <svg className="h-4 w-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Changes saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="test-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Test Name
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      id="test-name"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      onBlur={handleTitleBlur}
                      className="flex-1 min-w-0 block w-full sm:text-sm border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white rounded-md p-2"
                      placeholder="Enter test name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duration (minutes)
                  </label>
                  <div className="mt-1">
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="number"
                        id="duration"
                        min="1"
                        value={duration}
                        onChange={(e) => {
                          const newDuration = Math.max(1, parseInt(e.target.value) || 0);
                          setDuration(newDuration);
                        }}
                        onBlur={() => handleSaveTest({ duration })}
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white pr-16 p-2"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">minutes</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proctoring Settings */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Proctoring Settings
                  </label>
                  <div className="space-y-4">
                    {/* Video Proctoring Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          Video Proctoring
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Enable AI-powered video monitoring to detect multiple persons or no person during the exam
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newValue = !enableVideoProctoring;
                          setEnableVideoProctoring(newValue);
                          await handleSaveTest({
                            proctorSettings: {
                              enableVideoProctoring: newValue,
                              enableFullscreen: true,
                              blockOnViolations: blockOnViolations
                            }
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          enableVideoProctoring ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            enableVideoProctoring ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Block on Violations Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          Block on Excessive Violations
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Automatically block students from continuing the exam when they exceed the violation threshold.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const newValue = !blockOnViolations;
                          setBlockOnViolations(newValue);
                          await handleSaveTest({
                            proctorSettings: {
                              enableVideoProctoring: enableVideoProctoring,
                              enableFullscreen: true,
                              blockOnViolations: newValue
                            }
                          });
                        }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          blockOnViolations ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            blockOnViolations ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Save status indicator */}
              <div className="mt-4 flex justify-end">
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                  {isSaving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="text-green-500">
                      <svg className="h-4 w-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Changes saved
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestManage;
