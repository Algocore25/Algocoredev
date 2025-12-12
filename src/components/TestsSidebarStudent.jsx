import React from 'react';
import { motion } from 'framer-motion';

const TestsSidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'available-tests', label: 'Available Tests', icon: '📝' },
    { id: 'download-results', label: 'Results', icon: '📊' },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Test Management</h2>
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.label}
                {isActive && (
                  <motion.span
                    className="ml-auto h-2 w-2 rounded-full bg-blue-500"
                    layoutId="activeTab"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default TestsSidebar;
