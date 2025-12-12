import React from 'react';

const LoadingPage = ({ message = "Loading, please wait..." }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-lg font-semibold">{message}</p>
    </div>
  );
};

export default LoadingPage;
