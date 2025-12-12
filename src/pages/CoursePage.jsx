

import React, { useState, useEffect } from 'react';
import { FaChevronRight, FaStar, FaBook, FaAward, FaChevronDown, FaCheck } from 'react-icons/fa';
import { ref, get, child } from 'firebase/database';
import { database } from '../firebase';
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext';

import LoadingPage from './LoadingPage';

const CoursePage = () => {
  const [courseData, setCourseData] = useState(null);
  const [practiceTopics, setPracticeTopics] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [progressPercent, setProgressPercent] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openTopic, setOpenTopic] = useState(null);
  const { course } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Local storage keys per course
  const openTopicKey = `coursePageOpenTopic:${course}`;
  const scrollKey = `coursePageScroll:${course}`;

  // Restore open topic from localStorage (once on course change)
  useEffect(() => {
    const savedOpen = localStorage.getItem(openTopicKey);
    if (savedOpen !== null) {
      const idx = parseInt(savedOpen, 10);
      if (!Number.isNaN(idx)) setOpenTopic(idx);
    }
  }, [course]);

  // Persist open topic whenever it changes
  useEffect(() => {
    if (openTopic === null || openTopic === undefined) {
      localStorage.removeItem(openTopicKey);
    } else {
      localStorage.setItem(openTopicKey, String(openTopic));
    }
  }, [openTopic, openTopicKey]);

  // Restore scroll position after data loads
  useEffect(() => {
    if (!loading) {
      const savedY = localStorage.getItem(scrollKey);
      if (savedY !== null) {
        const y = parseInt(savedY, 10);
        if (!Number.isNaN(y)) {
          // Defer to ensure layout is ready
          requestAnimationFrame(() => window.scrollTo(0, y));
        }
      }
    }
  }, [loading, scrollKey]);

  // Track and persist scroll position (throttled via rAF)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          try {
            localStorage.setItem(scrollKey, String(window.scrollY || window.pageYOffset || 0));
          } catch (e) {
            // ignore storage failures
          } finally {
            ticking = false;
          }
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollKey]);


  const fetchUserProgress = async () => {

    if (!user) {
      return {};
    }

    // console.log(user);

    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, `userprogress/${user.uid}/${course}`));

      console.log(`userprogress/${user.uid}/${course}`);
      console.log("Snapshot:", snapshot.val());


      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      console.error('Error fetching user progress:', error);
      return {};
    }
  };

  const fetchPracticeTopics = async () => {
    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, `/AlgoCore/${course}/lessons`));

      if (!snapshot.exists()) {
        console.log('No data available');
        return [];
      }

      const data = snapshot.val();
      const practiceTopics = [];
      const progressData = await fetchUserProgress();

      console.log(data);


      // Process each topic
      Object.keys(data).forEach(topicKey => {
        const topicData = data[topicKey];

        // Skip if it's not a topic object
        if (typeof topicData !== 'object' || !topicData.description) {
          return;
        }

        const problems = [];

        console.log(topicData);

        topicData.questions?.forEach(problemData => {
          console.log(problemData);

          problems.push({
            name: problemData,
            status: 'Not Started', // Default status
            difficulty: "Easy",
            question: problemData,
          });
        });

        // Create the topic object
        practiceTopics.push({
          title: topicKey,
          description: topicData.description,
          problems: problems,
          status: topicData.status
        });
      });


      return practiceTopics;
    } catch (error) {
      console.error('Error fetching data from Firebase:', error);
      throw error;
    }
  };

  const updateProblemStatusesWithProgress = (topics, progress) => {
    if (!progress || typeof progress !== 'object') return topics;

    return topics.map(topic => {
      const topicProgress = progress[topic.title] || {};

      const updatedProblems = topic.problems.map(problem => {
        let status = 'Not Started'; // default

        if (problem.name in topicProgress) {
          status = topicProgress[problem.name] === true ? 'Completed' : 'Not Completed';
        }

        return {
          ...problem,
          status: status
        };
      });

      return {
        ...topic,
        problems: updatedProblems
      };
    });
  };

  const calculateProgressPercent = (topics) => {
    let total = 0;
    let completed = 0;

    topics.forEach(topic => {
      topic.problems.forEach(problem => {
        total++;
        if (problem.status === 'Completed') completed++;
      });
    });

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const calculateTopicProgress = (topic) => {
    const total = topic?.problems?.length || 0;
    const completed = (topic?.problems || []).filter(p => p.status === 'Completed').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  };



  useEffect(() => {

    async function executeAfterBoth() {
      try {
        setLoading(true);

        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `AlgoCore/${course}/course`));

        if (snapshot.exists()) {
          const data = snapshot.val();
          setCourseData(data);

        }
        else {
          throw new Error('Failed to fetch course data');
        }

        const [topics, progress] = await Promise.all([
          fetchPracticeTopics(),
          fetchUserProgress()
        ]);

        const updatedTopics = updateProblemStatusesWithProgress(topics, progress);
        setPracticeTopics(updatedTopics);

        // Set the % value
        const progressVal = calculateProgressPercent(updatedTopics);
        setProgressPercent(progressVal);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
        setPracticeTopics(null);
      } finally {
        setLoading(false);
      }
    }



    executeAfterBoth();




  }, [course, user]);

  if (loading) {
    <LoadingPage />
    // return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen">Error: {error}</div>;
  }

  if (!courseData) {
    return null;
  }

  const { title, description, stats } = courseData;
  const totalProblems = practiceTopics.reduce((count, topic) => count + topic.problems.length, 0);

  const completedProblems = practiceTopics.reduce(
    (count, topic) => count + topic.problems.filter(p => p.status === 'Completed').length,
    0
  );


  return (
    <div className="bg-gray-50 dark:bg-dark-primary text-gray-900 dark:text-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg mr-4">
                <FaBook className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-4xl font-bold">{title}</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{description}</p>

            {/* Progress Bar */}
            {/* Progress Bar */}
            {user && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Course Progress</h3>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{progressPercent}% Completed</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{completedProblems} Problems Completed</p>
              </div>
            )}

            <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400 mb-6">
              <span>{totalProblems} Problems</span>

              <span>{stats.level}</span>
            </div>


            {!user && (
              <div className="border-t border-b border-gray-200 dark:border-dark-tertiary py-4 mb-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Please <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">login</a> to track your progress
                </p>
              </div>
            )}

            <h2 className="text-2xl font-bold mb-4">Problems</h2>
            <div className="space-y-4">
              {practiceTopics.map((topic, index) => {
                const { total, completed, percent } = calculateTopicProgress(topic);
                return (
                  <div key={index} className="bg-white dark:bg-dark-tertiary rounded-lg shadow-sm border border-gray-200 dark:border-dark-tertiary">
                    <div
                      className="p-4 flex justify-between items-center cursor-pointer"
                      onClick={() => setOpenTopic(openTopic === index ? null : index)}
                    >
                      <div className="flex items-center">
                        <div className="bg-gray-100 dark:bg-dark-tertiary rounded-full w-10 h-10 flex items-center justify-center mr-4 font-bold text-lg">{index + 1}</div>
                        <div>
                          <h3 className="font-semibold text-lg">{topic.title.replace(/^[^a-zA-Z]*([a-zA-Z].*)$/, '$1')}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{topic.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="hidden sm:block">
                          <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">{completed}/{total}</div>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300 sm:hidden">{percent}%</span>
                        <FaChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openTopic === index ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {openTopic === index && topic.problems.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-dark-tertiary">
                        <table className="w-full text-left text-sm">
                          <thead className="text-gray-500 dark:text-gray-400">
                            <tr>
                              <th className="p-4 font-medium">Problem Name</th>
                              <th className="p-4 font-medium">Status</th>
                              <th className="p-4 font-medium">Difficulty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topic.problems.map((problem, pIndex) => (
                              <tr 
                                key={pIndex} 
                                className={`border-t border-gray-200 dark:border-dark-tertiary ${topic.status === 'blocked' ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                              >
                                <td
                                  className={`p-4 flex items-center ${topic.status === 'blocked' 
                                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                    : 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer'}`}
                                  onClick={() => {
                                    if (topic.status !== 'blocked') {
                                      navigate(`/problem/${course}/${topic.title}/${problem.name}`);
                                    }
                                  }}
                                >
                                  {problem.status === 'Completed' && (
                                    <FaCheck className="text-green-500 mr-2" />
                                  )}
                                  {problem.name}
                                  {topic.status === 'blocked' && (
                                    <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
                                      Locked
                                    </span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-xs ${problem.status === 'Completed'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                    {problem.status}
                                  </span>
                                </td>
                                <td className="p-4 text-green-600 dark:text-green-400">{problem.difficulty}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
};

export default CoursePage;