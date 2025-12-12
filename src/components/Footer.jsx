import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto py-6">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 dark:text-gray-400">
              <div className="flex justify-center gap-x-6 mb-4">
        <Link to="/about" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">About</Link>
        <Link to="/contact" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Contact</Link>
      </div>
      <p>&copy; 2025 AlgoCore. All rights reserved.</p>
    </div>
  </footer>
  );
};

export default Footer;
