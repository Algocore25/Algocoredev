import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, onValue, push, set, update } from 'firebase/database';
import { FiPlus } from 'react-icons/fi';
import TestsSidebar from './TestsSidebar';
import { database } from '../../firebase';
import toast from 'react-hot-toast'; // Assuming you have react-hot-toast installed

// Import card components
import EditTestCard from './EditTestCard';
import AvailableTestCard from './AvailableTestCard';
import ResultTestCard from './ResultTestCard';
import LoadingPage from '../LoadingPage';
import AddQuestions from './AddQuestions';

const TestsList = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    // Load the saved tab from localStorage, default to 'available-tests'
    return localStorage.getItem('adminActiveTab') || 'available-tests';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingTest, setCreatingTest] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const db = getDatabase();
    const testsRef = ref(db, 'Exam');

    const unsubscribe = onValue(testsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const testsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setTests(testsArray);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const createNewTest = async () => {
    if (creatingTest) return;

    setCreatingTest(true);
    try {
      const examsRef = ref(database, 'Exam');
      const newExamRef = push(examsRef);

      await set(newExamRef, {
        id: newExamRef.key,
        name: `Exam-${newExamRef.key.slice(0, 5)}`,
        createdAt: new Date().toISOString(),
        questions: [],
        Eligible: {},
        duration: 60,
        Properties: {
          status: 'NotStarted'
        }
      });

      // Navigate to the test edit page
      navigate(`/testedit/${newExamRef.key}`);
    } catch (error) {
      console.error('Error creating test:', error);
    } finally {
      setCreatingTest(false);
    }
  };

  const startTest = async (testId) => {
    try {
      await update(ref(database, `Exam/${testId}/Properties`), {
        status: 'Started',
      });
      toast.success('Test started successfully');
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    }
  };
  const endTest = async (testId) => {
    try {
      await update(ref(database, `Exam/${testId}/Properties`), {
        status: 'Completed',
      });
      toast.success('Test ended successfully');
    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Failed to start test');
    }
  };

  const filteredTests = useMemo(() => {
    if (!Array.isArray(tests)) {
      return [];
    }

    return tests.filter(test => {
      const testStatus = test.Properties?.status || 'NotStarted';
      const matchesSearch = test?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      if (activeTab === 'available-tests') return matchesSearch && testStatus === 'Started';
      if (activeTab === 'results') return matchesSearch && testStatus === 'Completed';
      if (activeTab === 'edit-tests') return matchesSearch && testStatus === 'NotStarted';

      return matchesSearch;
    });
  }, [tests, searchTerm, activeTab]);

  const sortedTests = useMemo(() => {
    const testsToSort = [...filteredTests];

    return testsToSort.sort((a, b) => {
      if (sortField === 'name') {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const comparison = nameA.localeCompare(nameB);
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      const dateA = new Date(a.completedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.completedAt || b.createdAt || 0).getTime();
      const comparison = dateA - dateB;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredTests, sortField, sortOrder]);

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <TestsSidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tests</h1>
          <div className="flex flex-wrap items-center gap-4 justify-end">
            <input
              type="text"
              placeholder="Search tests..."
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label htmlFor="sortField" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort
              </label>
              <select
                id="sortField"
                value={sortField}
                onChange={(event) => setSortField(event.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sortOrder" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Order
              </label>
              <select
                id="sortOrder"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            {activeTab === 'edit-tests' && <button
              onClick={createNewTest}
              disabled={creatingTest}
              className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
            >
              <FiPlus className="mr-2" />
              {creatingTest ? 'Creating...' : 'Create Test'}
            </button>}
          </div>
        </div>

        {loading ? (
          <LoadingPage message="Loading tests, please wait..." />
        ) : activeTab === 'add-questions' ? (
          <AddQuestions />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedTests.map((test) => (
              <div key={test.id}>
                {activeTab === 'edit-tests' && <EditTestCard test={test} startTest={startTest} />}
                {activeTab === 'available-tests' && <AvailableTestCard test={test} endTest={endTest} />}
                {activeTab === 'results' && <ResultTestCard test={test} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestsList;
