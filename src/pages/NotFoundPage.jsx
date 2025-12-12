import React from 'react';
import { Link } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center p-8 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <FiAlertTriangle className="text-yellow-500 dark:text-yellow-400 text-7xl" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          404 - Page Not Found
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          The page you’re looking for doesn’t exist or you might not have access.
        </p>
        <Link
          to="/"
          className="inline-block bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;