import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FcGoogle } from 'react-icons/fc';
import Footer from '../components/Footer';
import LoadingPage from './LoadingPage';
import { ref, get, child } from 'firebase/database';
import { database } from '../firebase';

function HomePage() {
  const navigate = useNavigate();
  const { googleSignIn, loading, user } = useAuth();
  const [myCourses, setMyCourses] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const languages = [
    { name: 'JavaScript', icon: '⚡' },
    { name: 'Python', icon: '🐍' },
    { name: 'Java', icon: '☕' },
    { name: 'C++', icon: '⚙️' },
    { name: 'SQL', icon: '🗄️' },
    { name: 'TypeScript', icon: '📘' },
  ];

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      // navigate('/profile'); // Redirect to profile after successful sign-in
    } catch (error) {
      console.error("Google Sign-In failed", error);
      // Optionally, show an error to the user
    }
  };

  // Calculate course progress similar to CoursesPage
  const calculateCourseProgress = (lessons, userProgress) => {
    if (!lessons || typeof lessons !== 'object') return 0;
    let total = 0;
    let completed = 0;
    Object.keys(lessons).forEach(topicKey => {
      const topic = lessons[topicKey];
      if (typeof topic !== 'object' || !topic?.description) return;
      const questions = Array.isArray(topic.questions)
        ? topic.questions
        : (typeof topic.questions === 'object' ? Object.keys(topic.questions) : []);
      total += questions.length;
      const tProg = (userProgress && userProgress[topicKey]) || {};
      questions.forEach(q => {
        if (tProg && tProg[q] === true) completed += 1;
      });
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  // Fetch courses and user progress when signed in
  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) {
        setMyCourses([]);
        return;
      }
      try {
        setProgressLoading(true);
        const dbRef = ref(database);
        const coursesSnap = await get(child(dbRef, 'Courses'));
        if (!coursesSnap.exists()) {
          setMyCourses([]);
          setProgressLoading(false);
          return;
        }
        const coursesList = coursesSnap.val();

        if (!Array.isArray(coursesList)) {
          setMyCourses([]);
          setProgressLoading(false);
          return;
        }

        const enriched = await Promise.all(
          coursesList.map(async (c) => {
            try {
              const [lessonsSnap, progressSnap] = await Promise.all([
                get(child(dbRef, `AlgoCore/${c.id}/lessons`)),
                get(child(dbRef, `userprogress/${user.uid}/${c.id}`))
              ]);
              const lessons = lessonsSnap.exists() ? lessonsSnap.val() : {};
              const uprog = progressSnap.exists() ? progressSnap.val() : {};
              const percent = calculateCourseProgress(lessons, uprog);
              return { id: c.id, title: c.title, percent };
            } catch (e) {
              console.error('Error computing progress for', c.id, e);
              return { id: c.id, title: c.title, percent: 0 };
            }
          })
        );

        setMyCourses(enriched);
      } catch (e) {
        console.error('Error loading courses/progress on HomePage:', e);
        setMyCourses([]);
      } finally {
        setProgressLoading(false);
      }
    };

    fetchProgress();
  }, [user]);

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Grid Background */}
      <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern dark:bg-dark-grid-pattern bg-20"></div>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-16 h-16 bg-purple-200 rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute bottom-40 left-20 w-12 h-12 bg-green-200 rounded-full opacity-25 animate-pulse"></div>
        <div className="absolute bottom-60 right-40 w-24 h-24 bg-yellow-200 rounded-full opacity-20 animate-pulse"></div>
      </div>

      <main className="relative flex-grow flex flex-col items-center justify-center z-10 pt-20">
        <div className="text-center px-4">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-800 dark:text-white">
            Master Programming with AlgoCore
          </h1>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold text-blue-600 dark:text-blue-400">
            Bored of Theory? Let's Code for Real
          </h2>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Kickstart Your Coding Journey — No Boring Lectures, Just Real Practice!
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <div className="flex flex-col items-center gap-2">
                <div className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                  Welcome back, {user.displayName || user.name || 'Coder'} 👋
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Here’s a quick snapshot of your learning progress
                </p>
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={() => navigate('/profile')}
                    className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 shadow-sm"
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => navigate('/courses')}
                    className="bg-white text-blue-600 font-semibold py-2 px-4 rounded-md border-2 border-blue-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-700 transition duration-200"
                  >
                    Browse Courses
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-3 bg-blue-600 text-white font-semibold pl-2 pr-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md w-full sm:w-auto"
              >
                <div className="bg-white p-1 rounded-full">
                  <FcGoogle size={24} />
                </div>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>

        {user && (
          <section className="w-full max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Your Course Progress</h3>
              {!progressLoading && myCourses.length > 0 && (
                <button
                  onClick={() => navigate('/courses')}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View all courses
                </button>
              )}
            </div>
            {progressLoading ? (
              <div className="text-gray-600 dark:text-gray-300">Loading your progress...</div>
            ) : myCourses.length === 0 ? (
              <div className="text-gray-600 dark:text-gray-300">No courses yet. Explore and start learning!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {myCourses
                  .slice() // copy
                  .sort((a, b) => b.percent - a.percent)
                  .slice(0, 4)
                  .map(c => (
                    <div key={c.id} className="bg-white/90 dark:bg-gray-800/90 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white leading-tight pr-2 truncate">{c.title}</h4>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{c.percent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full" style={{ width: `${c.percent}%` }}></div>
                      </div>
                      <button
                        onClick={() => navigate(`/course/${c.id}`)}
                        className="w-full text-sm font-medium bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Resume
                      </button>
                    </div>
                  ))}

              </div>

            )}


          </section>
        )}

        {/* Languages Section - Only show when user is not logged in */}
        {!user && (

          <section className="w-full max-w-5xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-12">
              Learn in Your Favorite Language
            </h2>
            <div className="flex flex-wrap justify-center gap-6">
              {languages.map((language, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 w-32 h-32 border border-gray-200/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  <span className="text-4xl mb-2">{language.icon}</span>
                  <span className="text-lg font-medium text-gray-900 dark:text-white">{language.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="relative z-10 w-full">
        <Footer />
      </div>
    </div>
  );
}

export default HomePage;