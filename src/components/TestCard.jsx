// components/TestCard.jsx
import React from "react";

const TestCard = ({ test, onStart }) => {
  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200"
    >
      <h3 className="text-xl font-semibold text-gray-800">{test.name}</h3>
      <p className="text-gray-600 mt-2">Duration: {test.duration} minutes</p>
      <p className="text-gray-600">Questions: {test.questions?.length || 0}</p>
      <div className="mt-4">
        <button
          onClick={() => onStart(test.id)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Start Test
        </button>
      </div>
    </div>
  );
};

export default TestCard;
