import React from 'react';
import { Clock, RotateCcw, Zap, Activity } from 'lucide-react';

const MetricsTable = ({ result }) => {
  if (!result.processes.length) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-200">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">Performance Analysis</h3>
      
      {/* Individual Process Metrics */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 border-b-2 border-gray-200 dark:border-gray-600">
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Process</th>
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Arrival</th>
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Burst</th>
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Completion</th>
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Waiting</th>
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Turnaround</th>
              <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200">Response</th>
            </tr>
          </thead>
          <tbody>
            {result.processes.map((process, index) => (
              <tr 
                key={process.id} 
                className={`border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                  index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <td className="py-4 px-4 font-bold text-gray-800 dark:text-gray-100 bg-gradient-to-r from-blue-100 to-transparent dark:from-blue-900/30 dark:to-transparent">
                  {process.name}
                </td>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{process.arrivalTime}</td>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{process.burstTime}</td>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{process.completionTime}</td>
                <td className="py-4 px-4 font-medium">
                  <span className={process.waitingTime === 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                    {process.waitingTime}
                  </span>
                </td>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{process.turnaroundTime}</td>
                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{process.responseTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Average Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-6 border border-blue-200 dark:border-blue-800/50 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Avg Waiting Time</h4>
          </div>
          <p className="text-3xl font-bold text-blue-800 dark:text-blue-200 mb-1">
            {result.averageWaitingTime.toFixed(2)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300/80">time units</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-6 border border-green-200 dark:border-green-800/50 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <RotateCcw className="h-5 w-5 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-green-700 dark:text-green-300">Avg Turnaround Time</h4>
          </div>
          <p className="text-3xl font-bold text-green-800 dark:text-green-200 mb-1">
            {result.averageTurnaroundTime.toFixed(2)}
          </p>
          <p className="text-xs text-green-600 dark:text-green-300/80">time units</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-6 border border-purple-200 dark:border-purple-800/50 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300">Avg Response Time</h4>
          </div>
          <p className="text-3xl font-bold text-purple-800 dark:text-purple-200 mb-1">
            {result.averageResponseTime.toFixed(2)}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-300/80">time units</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl p-6 border border-orange-200 dark:border-orange-800/50 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-300">CPU Utilization</h4>
          </div>
          <p className="text-3xl font-bold text-orange-800 dark:text-orange-200 mb-1">
            {result.cpuUtilization.toFixed(1)}%
          </p>
          <p className="text-xs text-orange-600 dark:text-orange-300/80">efficiency</p>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg transition-colors duration-200">
        <h4 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Performance Insights</h4>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-medium text-gray-800 dark:text-gray-100">Best Performer:</span> {
                result.processes.reduce((min, p) => 
                  p.waitingTime < min.waitingTime ? p : min
                ).name
              } <span className="text-gray-500 dark:text-gray-400">(lowest waiting time)</span>
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-medium text-gray-800 dark:text-gray-100">Total Execution Time:</span> {
                Math.max(...result.processes.map(p => p.completionTime))
              } <span className="text-gray-500 dark:text-gray-400">time units</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsTable;