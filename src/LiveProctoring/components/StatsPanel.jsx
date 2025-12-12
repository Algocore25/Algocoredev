import React from 'react';
import { Clock, AlertTriangle, Users, TrendingUp } from 'lucide-react';

export const StatsPanel = ({ status }) => {
  const getSessionDuration = () => {
    const now = new Date();
    const start = new Date(status.sessionStartTime);
    const duration = now.getTime() - start.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const stats = [
    {
      label: 'Session Duration',
      value: getSessionDuration(),
      icon: Clock,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Total Violations',
      value: status.violations.total,
      icon: AlertTriangle,
      color: status.violations.total > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100',
    },
    {
      label: 'Multiple Person',
      value: status.violations.multiplePerson,
      icon: Users,
      color: 'text-orange-600 bg-orange-100',
    },
    {
      label: 'No Person',
      value: status.violations.noPerson,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-100',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Session Statistics</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${stat.color} mb-2`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
