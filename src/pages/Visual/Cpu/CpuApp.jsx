import React, { useState, useEffect, useContext } from 'react';
import { Cpu, BookOpen, BarChart3, Settings, Sun, Moon } from 'lucide-react';
import AlgorithmSelector from './components/AlgorithmSelector';
import ProcessInput from './components/ProcessInput';
import GanttChart from './components/GanttChart';
import MetricsTable from './components/MetricsTable';
import AlgorithmExplanation from './components/AlgorithmExplanation';
import { runSchedulingAlgorithm } from './utils/schedulingAlgorithms';
import { ref, get, child, set } from "firebase/database";
import { database } from "../../../firebase";
import { useAuth } from '../../../context/AuthContext';
import { useParams } from "react-router-dom";
import { useTheme } from '../../../context/ThemeContext';
function CpuApp() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('fcfs');
  const [processes, setProcesses] = useState([]);
  const [timeQuantum, setTimeQuantum] = useState(2);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('simulator');

  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { course, subcourse, questionId } = useParams();


  useEffect(() => {
    if (processes.length > 0) {
      const algorithmResult = runSchedulingAlgorithm(selectedAlgorithm, processes, timeQuantum);
      setResult(algorithmResult);
    } else {
      setResult(null);
    }
  }, [selectedAlgorithm, processes, timeQuantum]);

  useEffect(() => {
    if (!user || !course || !subcourse || !questionId) return;

    const setprogress = async () => {
      const answerRef = ref(database, `userprogress/${user.uid}/${course}/${subcourse}/${questionId}`);
      console.log(answerRef);
      try {
        // Store both the selected option and submission status
        await set(answerRef, true);
      } catch (error) {
        console.error("Failed to save answer:", error);
      }
    };
    setprogress();
  }, [user, course, subcourse, questionId]);

  const tabs = [
    { id: 'simulator', label: 'Simulator', icon: Settings },
    { id: 'learn', label: 'Learn', icon: BookOpen },
    // { id: 'compare', label: 'Compare', icon: BarChart3 }
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200`}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Cpu className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">CPU Scheduler</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Learn & Visualize Scheduling Algorithms</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <nav className="flex space-x-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
              {/* <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button> */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-200">
        {activeTab === 'simulator' && (
          <div className="space-y-8">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Process Scheduler</h2>
                  <AlgorithmSelector
                    selectedAlgorithm={selectedAlgorithm}
                    onAlgorithmChange={setSelectedAlgorithm}
                  />

                  <ProcessInput
                    processes={processes}
                    setProcesses={setProcesses}
                    algorithm={selectedAlgorithm}
                    timeQuantum={timeQuantum}
                    setTimeQuantum={setTimeQuantum}
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <AlgorithmExplanation algorithm={selectedAlgorithm} />
                </div>
              </div>
            </div>

            {result && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <GanttChart
                    ganttChart={result.ganttChart}
                    title="Process Execution Timeline"
                  />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                  <MetricsTable result={result} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'learn' && (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                CPU Scheduling Algorithms Guide
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Learn about different CPU scheduling algorithms, their characteristics,
                and when to use each one in operating systems.
              </p>
            </div>

            <div className="grid gap-8">
              {['fcfs', 'sjf', 'srtf', 'rr', 'priority', 'multilevel'].map(algorithm => (
                <AlgorithmExplanation key={algorithm} algorithm={algorithm} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Algorithm Comparison
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Compare performance metrics across different scheduling algorithms with the same process set.
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Feature coming soon! Use the simulator to test different algorithms with the same processes.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default CpuApp;