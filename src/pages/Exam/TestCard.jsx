// components/TestCard.jsx
import React from "react";

const TestCard = ({ test, onStart }) => {
  console.log(test);

  const status = test?.Properties?.status || "Unknown";

  return (
        <div className="bg-white dark:bg-dark-secondary rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-dark-tertiary">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{test.name}</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Duration: {test.duration} minutes</p>
            <p className="text-gray-600 dark:text-gray-400">Questions: {test?.configure?.questionsPerType ? Object.values(test.configure.questionsPerType).reduce((a, b) => a + b, 0) : 0}</p>

      <div className="mt-4">
        {status === "NotStarted" && (
                    <button
            className="w-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 py-2 px-4 rounded-md cursor-not-allowed"
            disabled
          >
            Available Soon
          </button>
        )}

        {status === "Started" && (
                    <button
            onClick={() => onStart(test.id)}
            className="w-full bg-blue-600 dark:bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            View
          </button>
        )}

        {status === "Completed" && (
                    <button
                    onClick={() => onStart(test.id)}

            className="w-full bg-green-500 dark:bg-green-600 text-white py-2 px-4 rounded-md cursor-not-allowed"
          >
            Completed
          </button>
        )}
        
      </div>
    </div>
  );
};

export default TestCard;
