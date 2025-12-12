import React, { useEffect, useState } from "react";
import { ref, onValue, get } from "firebase/database";
import { database } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";
import CodePage from "./CodePage";
import MCQPage from "./MCQPage";
import LoadingPage from "./LoadingPage";
import CpuApp from "./Visual/Cpu/CpuApp";

// Navigation Icons
const NavigationIcons = {
  ChevronLeft: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  ),
  ChevronRight: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
};

const DynamicComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allQuestions, setAllQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const { course, subcourse, questionId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("active");


  // Fetch question data from Firebase
  useEffect(() => {



    const fetchData = async () => {
      try {
        // Single call for both question data and next question URL
        const questionRef = ref(
          database,
          `questions/${questionId}`);

        const statusRef = ref(
          database,
          `AlgoCore/${course}/lessons/${subcourse}/status`);

        // Get both question data and all questions in parallel
        const [questionSnapshot, statusSnapshot] = await Promise.all([
          get(questionRef),
          get(statusRef)
        ]);

        console.log(questionSnapshot.val());
        console.log(statusSnapshot.val());

        if (questionSnapshot.exists()) {
          const question = questionSnapshot.val();

          console.log(question);
          setData(question);
          setStatus(statusSnapshot.val());
        }
      } catch (error) {
        console.error("Error fetching data from Firebase:", error);
      }
    };

    const fetchDataQuestions = async () => {
      try {
        // Single call for both question data and next question URL
        const questionRef = ref(
          database,
          `AlgoCore/${course}/lessons/${subcourse}/questions`);

        // Get both question data and all questions in parallel
        const [questionSnapshot] = await Promise.all([
          get(questionRef),
        ]);

        console.log(questionSnapshot.val());

        if (questionSnapshot.exists()) {
          const questions = questionSnapshot.val();
          console.log('Raw questions data:', questions);

          // Handle different data structures
          let questionsList;
          if (Array.isArray(questions)) {
            // If questions is already an array
            questionsList = questions;
          } else if (typeof questions === 'object') {
            // If questions is an object, get the keys (question IDs)
            questionsList = Object.keys(questions);
          } else {
            console.error('Unexpected questions data structure:', questions);
            questionsList = [];
          }

          console.log('Processed questions list:', questionsList);
          setAllQuestions(questionsList);

          // Find current question index
          const currentIndex = questionsList.findIndex(q => q === questionId);
          console.log('Current question ID:', questionId);
          console.log('Found index:', currentIndex);
          setCurrentQuestionIndex(currentIndex !== -1 ? currentIndex : 0);
        }
      } catch (error) {
        console.error("Error fetching data from Firebase:", error);
      }
    };

    fetchData();
    fetchDataQuestions();

    if (questionId === "CpuVisual") {
      setData({
        type: "CpuVisual"
      })
    }


    setLoading(false);


  }, [questionId, course, subcourse]); // Dependencies adjusted

  const handlePreviousQuestion = () => {
    console.log('Previous button clicked');
    console.log('Current index:', currentQuestionIndex);
    console.log('All questions:', allQuestions);

    if (currentQuestionIndex > 0) {
      const prevQuestion = allQuestions[currentQuestionIndex - 1];
      console.log('Navigating to previous question:', prevQuestion);
      const url = `/problem/${course}/${subcourse}/${prevQuestion}`;
      console.log('Navigation URL:', url);
      navigate(url);
    } else {
      console.log('Already at first question - redirecting to home');
      navigate('/course/os'); // Redirect to home when at first question
    }
  };

  const handleNextQuestion = () => {
    console.log('Next button clicked');
    console.log('Current index:', currentQuestionIndex);
    console.log('All questions:', allQuestions);

    if (currentQuestionIndex < allQuestions.length - 1) {
      const nextQuestion = allQuestions[currentQuestionIndex + 1];
      console.log('Navigating to next question:', nextQuestion);
      const url = `/problem/${course}/${subcourse}/${nextQuestion}`;
      console.log('Navigation URL:', url);
      navigate(url);
    } else {
      console.log('At last question - redirecting to home');
      navigate('/course/os'); // Redirect to home when at last question
    }
  };

  if (loading) return <LoadingPage />;

  if (!data) return <LoadingPage message="Slow internet, loading...." />;

  // Navigation props to pass to child components
  const navigationProps = {
    showNavigation: allQuestions.length > 1,
    currentQuestionIndex,
    totalQuestions: allQuestions.length,
    onPrevious: handlePreviousQuestion,
    onNext: handleNextQuestion,
    NavigationIcons
  };

  if (status === "blocked") {
    return <LoadingPage message="This topic is blocked" />;
  }

  return (
    <div className="relative">
      {data.type === "Programming" && <CodePage data={data} navigation={navigationProps} />}
      {data.type === "MCQ" && <MCQPage data={data} />}
      {data.type === "CpuVisual" && <CpuApp />}
      {/* Add more conditional components as needed */}

      {/* Navigation Buttons - Only show for MCQ since CodePage handles its own */}
      {(data.type === "MCQ" || data.type === "CpuVisual") && allQuestions.length > 1 && (
        <div className="fixed bottom-6 right-6 flex gap-3 z-50">
          <button
            onClick={handlePreviousQuestion}
            // disabled={currentQuestionIndex === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg ${
              currentQuestionIndex === 0
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl transform hover:scale-105'
              }`}
          >
            <NavigationIcons.ChevronLeft />
            {currentQuestionIndex === 0 ? 'Previous Chapter' : 'Previous'}
          </button>

          <button
            onClick={handleNextQuestion}
            // disabled={currentQuestionIndex === allQuestions.length - 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg ${
              currentQuestionIndex === allQuestions.length - 1
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl transform hover:scale-105'
              }`}
          >
            {currentQuestionIndex === allQuestions.length - 1 ? 'Next Chapter' : 'Next'}
            <NavigationIcons.ChevronRight />
          </button>
        </div>
      )}


    </div>
  );
};

export default DynamicComponent;
