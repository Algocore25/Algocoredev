import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { Wifi, WifiOff } from 'lucide-react';
import { FaSun as SunIcon, FaMoon as MoonIcon, FaUserCircle as UserCircleIcon } from 'react-icons/fa';
import logoLight from '../assets/LOGO.png';
import logoDark from '../assets/LOGO-1.png';

const pathMappings = [
  { pattern: "/problem/:course/:subcourse/:questionId", label: "course/os" },
  { pattern: "/course/:courseId", label: "course" },
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [questionData, setQuestionData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [progressMap, setProgressMap] = useState({});
  const [match, setMatch] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();

  const authDropdownRef = useRef(null);
  const authButtonRef = useRef(null);

  // 🟢 Online/Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (loading) return null;

  const matched = pathMappings
    .map(({ pattern, label }) => {
      const match = matchPath(pattern, location.pathname);
      return match ? { pattern, label, params: match.params } : null;
    })
    .find(Boolean);

  // 🟣 Menu items
  const menuItems = [
    { label: 'Home', href: '/' },
    { label: 'Courses', href: '/courses' },
    !isAdmin && user && { label: 'Tests', href: '/test' },
    isAdmin && { label: 'Admin', href: '/admin' },
    isAdmin && { label: 'Students', href: '/adminmonitor' },
    { label: 'Compiler', href: '/compiler' },
  ].filter(Boolean);

  // 🟠 Fetch admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return setIsAdmin(false);
      try {
        const userRef = ref(database, `Admins/${user.uid}`);
        const snapshot = await get(userRef);
        setIsAdmin(snapshot.exists());
      } catch (error) {
        console.error("Error checking admin:", error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, [user]);

  // 🟡 Fetch question progress for navbar dots
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const pathMatch = matchPath("/problem/:course/:subcourse/:questionId", location.pathname);
      setMatch(pathMatch);
      if (!pathMatch) {
        if (isMounted) {
          setQuestionData([]);
          setCurrentIndex(-1);
        }
        return;
      }

      const { course, subcourse, questionId } = pathMatch.params;
      if (isMounted) setIsLoading(true);
      try {
        const questionRef = ref(database, `AlgoCore/${course}`);
        const snapshot = await get(questionRef);
        if (!snapshot.exists()) return;

        const lessons = snapshot.val()?.["lessons"];
        const questionsArray = lessons[subcourse.replaceAll("%20", " ")]?.["questions"] || [];

        if (!isMounted) return;
        setQuestionData(questionsArray);

        const index = questionsArray.findIndex(q => q === questionId || q === questionId.replaceAll("%20", " "));
        setCurrentIndex(index);

        if (user) {
          const decodedSub = subcourse.replaceAll("%20", " ");
          const progressRef = ref(database, `userprogress/${user.uid}/${course}/${decodedSub}`);
          const progressSnap = await get(progressRef);
          setProgressMap(progressSnap.exists() ? progressSnap.val() : {});
        }
      } catch (err) {
        console.error("Navbar question fetch error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchData();
    return () => (isMounted = false);
  }, [location.pathname, user]);

  // 🧠 Handle outside clicks properly
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isAuthOpen &&
        authDropdownRef.current &&
        !authDropdownRef.current.contains(event.target) &&
        authButtonRef.current &&
        !authButtonRef.current.contains(event.target)
      ) {
        setIsAuthOpen(false);
      }

      if (
        isMenuOpen &&
        !event.target.closest('.mobile-menu-button') &&
        !event.target.closest('.mobile-menu')
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAuthOpen, isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsAuthOpen(false);
  }, [location]);

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-dark-secondary border-b border-gray-200 dark:border-dark-tertiary z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Left: Logo + Menu */}
        <div className="flex items-center gap-6">
          <Link to={matched?.label || '/'} className="flex items-center gap-2">
            <img src={theme === 'dark' ? logoDark : logoLight} alt="AlgoCore Logo" className="h-8 w-auto" />
            <span className="text-xl font-bold text-[#202124] dark:text-white">AlgoCore</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {menuItems.map((item, i) => (
              <Link
                key={i}
                to={item.href}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === item.href
                    ? 'text-[#4285F4]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-[#4285F4] dark:hover:text-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-4">
          {/* Question progress dots */}
          {match && questionData.length > 0 && currentIndex >= 0 && (
            <div className="mr-4 max-w-xs">
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {currentIndex + 1}/{questionData.length}
                </div>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {questionData.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`w-2.5 h-2.5 rounded-full transition-colors flex-shrink-0 ${
                        i === currentIndex
                          ? 'bg-blue-500'
                          : progressMap[q]
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                      }`}
                      onClick={() => {
                        const { course, subcourse } = match.params;
                        navigate(`/problem/${course}/${subcourse}/${encodeURIComponent(q)}`);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Online indicator */}
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-600" />
            )}
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-tertiary">
            {theme === 'dark' ? (
              <SunIcon className="w-5 h-5 text-yellow-400" />
            ) : (
              <MoonIcon className="w-5 h-5 text-gray-700" />
            )}
          </button>

          {/* Auth menu */}
          <div className="relative">
            {user ? (
              <>
                <button
                  ref={authButtonRef}
                  onClick={() => setIsAuthOpen(!isAuthOpen)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-tertiary rounded-full"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                  ) : (
                    <UserCircleIcon className="w-8 h-8 text-gray-700 dark:text-gray-200" />
                  )}
                </button>

                {isAuthOpen && (
                  <div
                    ref={authDropdownRef}
                    className="absolute top-12 right-0 w-60 bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-tertiary py-2 animate-fadeIn"
                  >
                    <div
                      className="px-4 py-2 border-b border-gray-100 dark:border-dark-tertiary cursor-pointer"
                      onClick={() => navigate('/profile')}
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name || 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsAuthOpen(false);
                        navigate('/');
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-tertiary"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-dark-tertiary rounded-full relative mobile-menu-button"
            onClick={() => {
              setIsMenuOpen(!isMenuOpen);
              setIsAuthOpen(false);
            }}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Mobile dropdown */}
          {isMenuOpen && (
            <div
              className="absolute top-16 right-4 w-64 bg-white dark:bg-dark-secondary rounded-lg shadow-lg border border-gray-200 dark:border-dark-tertiary py-2 animate-fadeIn mobile-menu transition-all duration-300"
            >
              {menuItems.map((item, index) => (
                <Link
                  key={index}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-[#4285F4]/10 hover:text-[#4285F4] transition-colors ${
                    location.pathname === item.href
                      ? 'bg-[#4285F4]/10 text-[#4285F4]'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
