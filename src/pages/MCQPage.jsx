'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ref, get, child, set } from "firebase/database";
import { database } from "../firebase";

// SVG Icons
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
  const [activeTab, setActiveTab] = useState('description');
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(45);
  const { theme } = useTheme();

  const { user } = useAuth();

  const { course, subcourse, questionId } = useParams();

  const convertDriveUrl = (url) => {
    if (!url) return url;

    // Check if it's a Google Drive URL
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      // Convert to direct image URL format
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    // Return original URL if it's not a Drive URL
    return url;
  };

  useEffect(() => {
    // Reset state when question changes
    setSelectedOption(null);
    setIsSubmitted(false);

    const loadUserAnswer = async () => {
      if (user && course && subcourse && questionId) {
        const answerRef = ref(database, `userprogress/${user.uid}/${course}/${subcourse}/${questionId}`);
        try {
          const snapshot = await get(answerRef);
          if (snapshot.exists()) {
            const userAnswer = snapshot.val();
            // Set the actual user's selected option, not the correct answer
            setSelectedOption(data.correctAnswer - 1);
            // console.log(userAnswer.selectedOption);
            setIsSubmitted(true);
          }
        } catch (error) {
          console.error("Error loading user answer:", error);
        }
      }
    };

    loadUserAnswer();

    // Cleanup function to reset state when component unmounts or question changes
    return () => {
      setSelectedOption(null);
      setIsSubmitted(false);
    };
  }, [user, course, subcourse, questionId, data]);

  const handleSubmit2 = async () => {
    if (selectedOption === null || !user || !course || !subcourse || !questionId || !data) return;

    const answerRef = ref(database, `userprogress/${user.uid}/${course}/${subcourse}/${questionId}`);
    try {
      // Store both the selected option and submission status
      await set(answerRef, true);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Failed to save answer:", error);
    }
  };

  const handleOptionSelect = (index) => {
    if (!isSubmitted) {
      setSelectedOption(index);
    }
  };

  const handleSubmit = async () => {
    await handleSubmit2();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full shadow-sm"
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

          <div className="p-6 flex-1 overflow-auto">
            {activeTab === 'description' && (
              <div className="text-gray-700 dark:text-gray-300">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words">{data.questionname}</h1>
                  <div className="flex flex-wrap items-center gap-4 mt-4">
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
                      {data.difficulty}
                    </span>

                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {/* <span className="text-sm">{data.stats.time}</span> */}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Statement</h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {data.question}
                    </p>
                    {data?.darkimageurl&& (
                      <div className="mb-4">
                        <img
                          src={  theme === 'dark' ? data.darkimageurl : data.lightimageurl}
                          alt="Question diagram"
                          className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                          onError={(e) => {
                            console.error('Failed to load image. Original URL:', data.imageurl);
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {isSubmitted && (
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                      <h2 className="text-lg font-semibold mb-2 text-blue-800 dark:text-blue-200">Explanation</h2>
                      <p className="text-blue-700 dark:text-blue-300">
                        {data.explanation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          className={`w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize flex items-center justify-center transition-colors duration-150`}
          style={{ zIndex: 10 }}
        >
          <Icons.GripVertical />
        </div>

        {/* Right Panel (MCQ Options) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          <div className="p-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Select the correct answer</h2>

            <div className="space-y-4 mb-8">
              {data.options.map((option, index) => {
                let optionClasses = "p-4 border rounded-lg cursor-pointer transition-colors duration-150 ";

                if (isSubmitted) {
                  if (index === data.correctAnswer - 1) {
                    optionClasses += "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200";
                  } else if (index === selectedOption && index !== data.correctAnswer - 1) {
                    optionClasses += "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200";
                  } else {
                    optionClasses += "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300";
                  }
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

            <div className="mt-auto">
              <button
                onClick={handleSubmit}
                disabled={selectedOption === null || isSubmitted}
                className={`px-6 py-3 rounded-lg font-medium text-sm ${selectedOption === null || isSubmitted
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } transition-colors duration-150`}
              >
                {isSubmitted ? 'Submitted' : 'Submit Answer'}
              </button>

              {isSubmitted && (
                <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center">
                    <Icons.CheckCircle2 className="text-blue-500 dark:text-blue-400 mr-3 flex-shrink-0" />
                    <span className="text-blue-800 dark:text-blue-200">
                      {selectedOption === data.correctAnswer - 1
                        ? "Correct! Well done!"
                        : `Incorrect. The correct answer is ${String.fromCharCode(65 + data.correctAnswer - 1)}.`}
                    </span>
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

export default MCQPage;
