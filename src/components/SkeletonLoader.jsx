import React from 'react';

const SkeletonLoader = () => {
  return (
    <div className="w-full max-w-sm p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="animate-pulse">
        {/* Title Skeleton */}
        <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
        
        {/* Text Lines Skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-4/6"></div>
        </div>
        
        {/* Button Skeleton */}
        <div className="mt-6 h-10 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
