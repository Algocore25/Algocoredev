import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TestsSidebar from '../../components/TestsSidebarStudent';
import AvailableTests from './AvailableTests';
import Results from './Results';

const TestsPage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    // Load the saved tab from localStorage, default to 'available-tests'
    return localStorage.getItem('studentActiveTab') || 'available-tests';
  });

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('studentActiveTab', activeTab);
  }, [activeTab]);


  return (
        <div className="flex h-[calc(100vh)] bg-gray-50 dark:bg-dark-primary overflow-hidden">
      <TestsSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Tests</h1>
        </div>
        
        {activeTab === 'available-tests' && (
  
          <AvailableTests/>


        )}

        {activeTab === 'download-results' && (

          <Results/>

        )}


      </main>
    </div>
  );
};

export default TestsPage;
