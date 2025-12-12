'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../firebase';
import { ref, set, get } from 'firebase/database';

const Icons = {
  FileText: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  CheckCircle2: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  GripVertical: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h8M8 15h8" />
    </svg>
  )
};

function MCQPage({ data }) {
  const { testid } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('description');
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [initialOption, setInitialOption] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(45);
  const { theme } = useTheme();

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!user || !data?.questionname) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const submissionRef = ref(database, `ExamCode/${testid}/${user.uid}/${data.questionname}`);
        const snapshot = await get(submissionRef);
        if (snapshot.exists()) {
          const savedOption = snapshot.val();
          setSelectedOption(savedOption);
          setInitialOption(savedOption);
          setIsSubmitted(true);
        } else {
          setSelectedOption(null);
          setInitialOption(null);
          setIsSubmitted(false);
        }
      } catch (error) {
        console.error("Failed to fetch submission:", error);
        setSelectedOption(null);
        setInitialOption(null);
        setIsSubmitted(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmission();
  }, [data, user, testid]);

  const handleOptionSelect = (index) => {
    if (isLoading) return;
    setSelectedOption(index);
    // If user selects a different option, it's no longer considered 'submitted'
    // until they hit submit again.
    if (index !== initialOption) {
      setIsSubmitted(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedOption === null || !user) return;

    setIsSubmitted(true);
    try {
      const answerRef = ref(database, `ExamCode/${testid}/${user.uid}/${data.questionname}/`);
      const answerRef2 = ref(database, `ExamSubmissions/${testid}/${user.uid}/${data.questionname}/`);
      const answerRef3 = ref(database, `Marks/${testid}/${user.uid}/${data.questionname}/`);
      await set(answerRef, selectedOption);
      await set(answerRef2, selectedOption + 1 === data.correctAnswer ? 'true' : 'false');
      await set(answerRef3, selectedOption + 1 === data.correctAnswer ? 100 : 0);
      setInitialOption(selectedOption); // Update initial option to the new submission
    } catch (error) {
      console.error("Error saving answer: ", error);
      setIsSubmitted(false); // Allow user to try again if save fails
    }
  };

  const showSubmitButton = selectedOption !== null && selectedOption !== initialOption;

  return (
    <div className="flex flex-col h-screen w-full bg-white dark:bg-gray-900">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              className={`px-6 py-4 text-sm font-medium ${activeTab === 'description'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              onClick={() => setActiveTab('description')}
            >
              <div className="flex items-center gap-2">
                <Icons.FileText />
                Description
              </div>
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'description' && (
              <div className="text-gray-700 dark:text-gray-300">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{data?.questionname}</h1>
                  <div className="flex flex-wrap items-center gap-4 mt-4">
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
                      {data?.difficulty}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Statement</h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{data?.question}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize flex items-center justify-center">
          <Icons.GripVertical />
        </div>

        {/* Right Panel (MCQ Options) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Select the correct answer</h2>

            <div className="space-y-4 mb-8">
              {data?.options.map((option, index) => {
                let optionClasses = "p-4 border rounded-lg cursor-pointer transition-colors duration-150 ";

                if (isSubmitted) {
                  // Keep the selected option highlighted but don't show correct/incorrect
                  optionClasses += selectedOption === index
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300";
                } else {
                  optionClasses += selectedOption === index
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-600";
                }

                return (
                  <div
                    key={index}
                    className={optionClasses}
                    onClick={() => handleOptionSelect(index)}
                  >
                    <div className="flex items-center">
                      <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
                      <span>{option}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto pt-6">
              {showSubmitButton ? (
                <button
                  onClick={handleSubmit}
                  className="w-full px-6 py-3 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-150"
                >
                  Submit Answer
                </button>
              ) : isSubmitted && selectedOption !== null ? (
                <p className="text-center text-green-600 dark:text-green-400 font-medium">Answer Submitted</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MCQPage;
