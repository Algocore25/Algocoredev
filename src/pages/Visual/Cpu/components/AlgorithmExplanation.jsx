import React from 'react';
import { CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

const explanations = {
  fcfs: {
    title: 'First Come First Serve (FCFS)',
    description: 'The simplest scheduling algorithm where processes are executed in the order they arrive, like a queue at a store.',
    advantages: [
      'Simple to understand and implement',
      'Fair in the sense that every process gets equal opportunity',
      'No starvation - all processes will eventually be executed',
      'Low overhead - no complex calculations needed'
    ],
    disadvantages: [
      'Average waiting time is often quite long',
      'Convoy effect - short processes wait for long processes',
      'Not optimal for interactive systems',
      'Poor response time for time-critical applications'
    ],
    timeComplexity: 'O(n)',
    usage: 'Batch systems where fairness is more important than efficiency',
    characteristics: ['Non-preemptive', 'Simple implementation', 'FIFO order']
  },
  sjf: {
    title: 'Shortest Job First (SJF)',
    description: 'Non-preemptive algorithm that selects the process with the smallest burst time first.',
    advantages: [
      'Optimal for minimizing average waiting time',
      'Better performance than FCFS for most cases',
      'Good for batch systems with known execution times',
      'Reduces overall system load'
    ],
    disadvantages: [
      'Starvation of longer processes possible',
      'Difficult to predict burst time in practice',
      'Not suitable for interactive systems',
      'Can lead to indefinite postponement'
    ],
    timeComplexity: 'O(n²)',
    usage: 'Batch systems where process execution times are known in advance',
    characteristics: ['Non-preemptive', 'Optimal for average waiting time', 'Requires burst time knowledge']
  },
  srtf: {
    title: 'Shortest Remaining Time First (SRTF)',
    description: 'Preemptive version of SJF that can switch to a newly arrived shorter process.',
    advantages: [
      'Optimal for minimizing average waiting time',
      'Better response time than SJF',
      'Good for time-sharing systems',
      'Can handle dynamic process arrivals'
    ],
    disadvantages: [
      'High overhead due to frequent context switching',
      'Starvation of longer processes',
      'Complex to implement and manage',
      'Requires accurate burst time prediction'
    ],
    timeComplexity: 'O(n²)',
    usage: 'Time-sharing systems where quick response is needed',
    characteristics: ['Preemptive', 'Dynamic scheduling', 'High context switching']
  },
  rr: {
    title: 'Round Robin (RR)',
    description: 'Each process gets a fixed time quantum. If not completed, it goes to the back of the queue.',
    advantages: [
      'Fair allocation of CPU time to all processes',
      'Good response time for interactive systems',
      'No starvation - every process gets CPU time',
      'Works well for time-sharing systems'
    ],
    disadvantages: [
      'Higher average waiting time than SJF',
      'Performance depends heavily on time quantum size',
      'Context switching overhead can be significant',
      'Not optimal for batch processing'
    ],
    timeComplexity: 'O(n)',
    usage: 'Interactive and time-sharing systems',
    characteristics: ['Preemptive', 'Fixed time quantum', 'Circular queue']
  },
  priority: {
    title: 'Priority Scheduling',
    description: 'Each process has a priority. The process with the highest priority is executed first.',
    advantages: [
      'Important processes can be executed first',
      'Flexible - priorities can be assigned based on various criteria',
      'Good for real-time systems',
      'Can implement aging to prevent starvation'
    ],
    disadvantages: [
      'Starvation of low-priority processes',
      'Complex priority assignment and management',
      'May not be optimal for average waiting time',
      'Priority inversion problems possible'
    ],
    timeComplexity: 'O(n²)',
    usage: 'Real-time systems and systems with varying process importance',
    characteristics: ['Priority-based', 'Can be preemptive or non-preemptive', 'Flexible scheduling']
  },
  multilevel: {
    title: 'Multilevel Queue',
    description: 'Processes are classified into different queues based on their properties, each with its own scheduling algorithm.',
    advantages: [
      'Different algorithms for different types of processes',
      'Flexible and highly customizable',
      'Good for systems with diverse process types',
      'Can optimize for different process characteristics'
    ],
    disadvantages: [
      'Complex to implement and manage',
      'Potential for starvation in lower priority queues',
      'Fixed priority between queues',
      'Difficult to balance queue priorities'
    ],
    timeComplexity: 'Varies by implementation',
    usage: 'Complex systems with multiple types of processes (system, interactive, batch)',
    characteristics: ['Multiple queues', 'Different algorithms per queue', 'Process classification']
  }
};

const AlgorithmExplanation = ({ algorithm }) => {
  const explanation = explanations[algorithm];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 text-white p-6">
        <h3 className="text-xl font-bold mb-2">{explanation.title}</h3>
        <p className="text-blue-100/90 dark:text-blue-100/80 leading-relaxed">{explanation.description}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Characteristics */}
        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800/50">
          <h4 className="font-semibold text-indigo-800 dark:text-indigo-200 mb-3 flex items-center gap-2">
            <Zap size={18} className="text-indigo-600 dark:text-indigo-400" />
            Key Characteristics
          </h4>
          <div className="flex flex-wrap gap-2">
            {explanation.characteristics.map((char, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-200 rounded-full text-sm font-medium border border-indigo-200 dark:border-indigo-700/50"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
        
        {/* Pros and Cons */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600 dark:text-green-500" />
              Advantages
            </h4>
            <ul className="space-y-2">
              {explanation.advantages.map((advantage, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-green-500 dark:text-green-400 mt-1 flex-shrink-0">•</span>
                  <span>{advantage}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
              <XCircle size={18} className="text-red-600 dark:text-red-500" />
              Disadvantages
            </h4>
            <ul className="space-y-2">
              {explanation.disadvantages.map((disadvantage, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400 mt-1 flex-shrink-0">•</span>
                  <span>{disadvantage}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        {/* Technical Details */}
        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
              <Clock size={16} className="text-blue-600 dark:text-blue-400" />
              Time Complexity
            </h4>
            <p className="text-blue-800 dark:text-blue-200 font-mono text-lg">{explanation.timeComplexity}</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-100 dark:border-purple-900/30">
            <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Best Use Cases</h4>
            <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">{explanation.usage}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlgorithmExplanation;