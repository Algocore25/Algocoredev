import React from 'react';
import { AlertTriangle, Users, UserX, CheckCircle } from 'lucide-react';
import { AlertMessage } from '../types/proctoring';

interface AlertPanelProps {
  alerts: AlertMessage[];
  personCount: number;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, personCount }) => {
  const getStatusColor = () => {
    if (personCount === 0) return 'text-red-500';
    if (personCount > 1) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (personCount === 0) return <UserX className="w-6 h-6" />;
    if (personCount > 1) return <Users className="w-6 h-6" />;
    return <CheckCircle className="w-6 h-6" />;
  };

  const getStatusMessage = () => {
    if (personCount === 0) return 'No person detected';
    if (personCount > 1) return `${personCount} persons detected`;
    return 'Single person detected';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={getStatusColor()}>
          {getStatusIcon()}
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">Detection Status</h3>
          <p className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusMessage()}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
          Recent Alerts
        </h4>
        <div className="max-h-48 overflow-y-auto space-y-2">
          {alerts.slice(-5).map((alert, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg border-l-4 ${
                alert.type === 'error' 
                  ? 'bg-red-50 border-red-400 text-red-800'
                  : alert.type === 'warning'
                  ? 'bg-orange-50 border-orange-400 text-orange-800'
                  : 'bg-green-50 border-green-400 text-green-800'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs mt-1 opacity-75">
                    {alert.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">
              No alerts yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
};