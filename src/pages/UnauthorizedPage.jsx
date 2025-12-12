import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';

const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-center px-4">
      <div className="w-full max-w-md">
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-red-100 dark:bg-red-900/30">
          <FiLock className="h-12 w-12 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          You do not have the necessary permissions to view this page.
        </p>
        <div className="mt-8">
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 shadow-md"
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
