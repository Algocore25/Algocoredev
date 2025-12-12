import React from 'react';
import { FiBarChart2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import LoadingPage from '../LoadingPage';

export default function TestResults({ tests, loading, searchTerm, setSearchTerm }) {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Results</h1>
      </div>

      {loading ? (
        <LoadingPage message="Loading tests, please wait..."/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tests.map((test) => (
            <div key={test.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 relative border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-900">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white pr-6">{test.name}</h3>
                <FiBarChart2 className="text-gray-400" size={20} />
              </div>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Completed: {new Date(test.completedAt || test.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-4">
                <button
                  onClick={() => navigate(`/test-results/${test.id}`)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  View Results
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
