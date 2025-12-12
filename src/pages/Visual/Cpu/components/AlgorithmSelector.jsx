import React from 'react';
import { Clock, Zap, RotateCcw, Timer, Star, Layers } from 'lucide-react';

const algorithms = [
  {
    id: 'fcfs',
    name: 'First Come First Serve',
    description: 'Processes are executed in the order they arrive',
    icon: Clock,
    color: 'blue'
  },
  {
    id: 'sjf',
    name: 'Shortest Job First',
    description: 'Process with shortest burst time is executed first',
    icon: Zap,
    color: 'green'
  },
  {
    id: 'srtf',
    name: 'Shortest Remaining Time First',
    description: 'Preemptive version of SJF',
    icon: Timer,
    color: 'yellow'
  },
  {
    id: 'rr',
    name: 'Round Robin',
    description: 'Each process gets a fixed time quantum',
    icon: RotateCcw,
    color: 'purple'
  },
  {
    id: 'priority',
    name: 'Priority Scheduling',
    description: 'Process with highest priority is executed first',
    icon: Star,
    color: 'pink'
  },
  // {
  //   id: 'multilevel',
  //   name: 'Multilevel Queue',
  //   description: 'Multiple queues with different scheduling algorithms',
  //   icon: Layers,
  //   color: 'indigo'
  // }
];

const AlgorithmSelector = ({ selectedAlgorithm, onAlgorithmChange }) => {
  const getColorClasses = (color, isSelected) => {
    const baseClasses = 'p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105';
    
    if (isSelected) {
      switch (color) {
        case 'blue': return `${baseClasses} bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-200 shadow-lg`;
        case 'green': return `${baseClasses} bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-400 text-green-700 dark:text-green-200 shadow-lg`;
        case 'yellow': return `${baseClasses} bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-400 text-yellow-700 dark:text-yellow-200 shadow-lg`;
        case 'purple': return `${baseClasses} bg-purple-50 dark:bg-purple-900/30 border-purple-500 dark:border-purple-400 text-purple-700 dark:text-purple-200 shadow-lg`;
        case 'pink': return `${baseClasses} bg-pink-50 dark:bg-pink-900/30 border-pink-500 dark:border-pink-400 text-pink-700 dark:text-pink-200 shadow-lg`;
        case 'indigo': return `${baseClasses} bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400 text-indigo-700 dark:text-indigo-200 shadow-lg`;
        default: return `${baseClasses} bg-gray-50 dark:bg-gray-700/50 border-gray-500 dark:border-gray-400 text-gray-700 dark:text-gray-200 shadow-lg`;
      }
    } else {
      return `${baseClasses} bg-white dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500`;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-200">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Select Scheduling Algorithm</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {algorithms.map((algorithm) => {
          const Icon = algorithm.icon;
          const isSelected = selectedAlgorithm === algorithm.id;
          
          return (
            <div
              key={algorithm.id}
              className={getColorClasses(algorithm.color, isSelected)}
              onClick={() => onAlgorithmChange(algorithm.id)}
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon size={24} className={selectedAlgorithm === algorithm.id ? 'opacity-100' : 'opacity-70'} />
                <h4 className="font-medium text-sm leading-tight">{algorithm.name}</h4>
              </div>
              <p className="text-xs opacity-80 dark:opacity-70 leading-relaxed">{algorithm.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlgorithmSelector;