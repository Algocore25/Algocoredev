import React from 'react';
import Navbar from './Navbar';

const PageLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] dark:bg-dark-primary transition-colors duration-200">
      {/* Fixed Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* Main Content - accounts for navbar height */}
      <main className="flex-1 pt-16 px-4 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default PageLayout;
