import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function AnimatedTestResults({ testResults = [], runsubmit }) {
  const [showResults, setShowResults] = useState(false);
  const [testStatus, setTestStatus] = useState('not-started');
  const [selectedTestIndex, setSelectedTestIndex] = useState(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (testResults.some(t => t.status === 'running')) {
      setTestStatus('running');
      setShowResults(false);
      return;
    }

    if (testResults.length > 0) {
      const allPassed = testResults.every(t => t.passed);
      setTestStatus(allPassed ? 'passed' : 'failed');

      const firstFailedIndex = testResults.findIndex(t => !t.passed);
      setSelectedTestIndex(firstFailedIndex !== -1 ? firstFailedIndex : 0);

      const timer = setTimeout(() => setShowResults(true), 300);
      return () => clearTimeout(timer);
    }
  }, [testResults]);

  const formatText = (text) => {
    if (!text && text !== 0) return 'No output';
    if (typeof text === 'string') {
      return text.split('\n').map((line, i) => (
        <div key={i} className={line ? '' : 'h-5'}>{line || ' '}</div>
      ));
    }
    return String(text);
  };

  if (runsubmit === 'none') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-gray-600 dark:text-gray-400">No tests run yet</p>
      </div>
    );
  }

  // Loader
  if (testStatus === 'running' || !showResults) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="relative w-20 h-20 mb-6">
          <div className={`absolute inset-0 rounded-full border-4 ${theme === 'dark' ? 'border-blue-400' : 'border-blue-600'} border-t-transparent animate-spin`}></div>
        </div>
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">
          Running Tests...
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please wait while we execute your test cases
        </p>
      </div>
    );
  }

  if (testResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-gray-600 dark:text-gray-400">No tests run yet</p>
      </div>
    );
  }

  const currentTest = testResults[selectedTestIndex];
  const isHiddenCase = !(runsubmit === 'run' || selectedTestIndex === 0 || selectedTestIndex === 1);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 text-gray-800 dark:text-gray-100">
      {/* Header */}
      <div className="text-center mb-2">
        {testStatus === 'passed' ? (
          <h3 className="text-green-600 dark:text-green-400 text-lg font-semibold">
            ✅ All Tests Passed
          </h3>
        ) : (
          <h3 className="text-red-600 dark:text-red-400 text-lg font-semibold">
            {testResults.filter(t => !t.passed).length} of {testResults.length} Tests Failed
          </h3>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-center gap-2 flex-wrap px-2 py-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm">
        {testResults.map((test, index) => {
          const isActive = index === selectedTestIndex;
          const color = test.status === 'running'
            ? 'bg-blue-500 text-white'
            : test.passed
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

          const isHidden = !(runsubmit === 'run' || index === 0 || index === 1);

          return (
            <button
              key={index}
              onClick={() => setSelectedTestIndex(index)}
              className={`relative w-9 h-9 rounded-md flex items-center justify-center text-sm font-semibold transition-all
                ${color}
                ${isActive ? 'scale-110 ring-2 ring-offset-2 ring-blue-400 dark:ring-blue-300' : 'opacity-90 hover:opacity-100 hover:scale-105'}
              `}
              title={isHidden ? `Hidden Test Case #${index + 1}` : `Test Case #${index + 1}`}
            >
              <span>{index + 1}</span>
              {isHidden && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 text-gray-700 dark:text-gray-300"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Test Details */}
      {currentTest && (
        <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow ${isHiddenCase ? 'opacity-95' : ''}`}>
          <div className={`px-4 py-3 flex items-center justify-between ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h4 className="font-medium text-gray-800 dark:text-white">
              Test Case #{selectedTestIndex + 1} {currentTest.passed ? '✅ Passed' : '❌ Failed'}
            </h4>
            {isHiddenCase && (
              <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span>Hidden Case</span>
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Input */}
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Input
              </div>
              <div className="p-3 rounded border font-mono text-sm max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                {formatText(currentTest.input)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Expected Output */}
              <div>
                <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                  Expected Output
                </div>
                <div className="p-3 rounded border font-mono text-sm bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-gray-800 dark:text-gray-100">
                  {isHiddenCase ? (
                    <span className="italic text-gray-400">Hidden</span>
                  ) : (
                    formatText(currentTest.expected)
                  )}
                </div>
              </div>

              {/* Your Output */}
              <div>
                <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                  Your Output
                </div>
                <div className="p-3 rounded border font-mono text-sm bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-gray-800 dark:text-gray-100">
                  {formatText(currentTest.output)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
