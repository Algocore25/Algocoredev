import React from 'react';

const GanttChart = ({ ganttChart, title }) => {
  if (ganttChart.length === 0) return null;

  const maxTime = Math.max(...ganttChart.map(item => item.endTime));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-colors duration-200">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-6">{title}</h3>
      
      <div className="space-y-6">
        {/* Gantt Chart */}
        <div className="relative bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <div className="flex border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            {ganttChart.map((item, index) => (
              <div
                key={index}
                className="relative h-16 flex items-center justify-center text-white font-bold text-sm border-r border-white dark:border-gray-600 last:border-r-0 hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: item.color,
                  width: `${((item.endTime - item.startTime) / maxTime) * 100}%`,
                  minWidth: '60px'
                }}
                title={`${item.processName} (${item.startTime}-${item.endTime})`}
              >
                {item.processName}
                <div className="absolute bottom-1 left-1 right-1 text-xs text-white/80">
                  {item.endTime - item.startTime}u
                </div>
              </div>
            ))}
          </div>
          
          {/* Time Scale */}
          <div className="flex mt-3 relative">
            {ganttChart.map((item, index) => (
              <div
                key={index}
                className="relative text-sm font-medium text-gray-700 dark:text-gray-300"
                style={{
                  width: `${((item.endTime - item.startTime) / maxTime) * 100}%`,
                  minWidth: '60px'
                }}
              >
                <span className="absolute left-0 -translate-x-1/2 bg-white dark:bg-gray-800 px-1 rounded text-gray-700 dark:text-gray-300">
                  {item.startTime}
                </span>
                {index === ganttChart.length - 1 && (
                  <span className="absolute right-0 translate-x-1/2 bg-white dark:bg-gray-800 px-1 rounded text-gray-700 dark:text-gray-300">
                    {item.endTime}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Process Legend */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Process Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from(new Set(ganttChart.map(item => item.processName))).map((processName) => {
              const item = ganttChart.find(g => g.processName === processName);
              return (
                <div key={processName} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                  <div
                    className="w-4 h-4 rounded flex-shrink-0 border border-white dark:border-gray-700"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{processName}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Execution Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Total Time</p>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{maxTime}</p>
            </div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Processes</p>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                {new Set(ganttChart.map(item => item.processName)).size}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Context Switches</p>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-200">{ganttChart.length - 1}</p>
            </div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Avg Time Slice</p>
              <p className="text-xl font-bold text-blue-800 dark:text-blue-200">
                {(maxTime / ganttChart.length).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;