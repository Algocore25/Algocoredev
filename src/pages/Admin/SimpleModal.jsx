import React, { Fragment, useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

import { database } from "../../firebase";
import { ref, get } from "firebase/database";
import LoadingPage from '../LoadingPage';
const SimpleModal = ({ isOpen, onClose, onAddQuestions, questions: propQuestions = [], existingQuestionIds = [] }) => {
  const [activeTab, setActiveTab] = useState('select');
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [filterType, setFilterType] = useState('all'); // 'all', 'mcq', 'programming', 'sql'
  const [sortBy, setSortBy] = useState('title'); // 'title', 'type'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

  // Filter and sort questions based on search term, type filter, and sorting
  useEffect(() => {
    let filtered = [...questions];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(q => q.type && q.type.toLowerCase() === filterType.toLowerCase());
    }

    // Apply search filter
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        q => (q.title && q.title.toLowerCase().includes(searchLower)) ||
          (q.content && q.content.toLowerCase().includes(searchLower)) ||
          (q.description && q.description.toLowerCase().includes(searchLower)) ||
          (q.type && q.type.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'title') {
        aValue = (a.title || '').toLowerCase();
        bValue = (b.title || '').toLowerCase();
      } else if (sortBy === 'type') {
        aValue = (a.type || '').toLowerCase();
        bValue = (b.type || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    setFilteredQuestions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, questions, filterType, sortBy, sortOrder]);

  // Memoize pagination calculations
  const { totalPages, indexOfFirstItem, indexOfLastItem, currentItems, pageNumbers, startPage, endPage } = React.useMemo(() => {
    const totalItems = filteredQuestions.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const indexOfLastItem = Math.min(currentPage * itemsPerPage, totalItems);
    const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
    const currentItems = filteredQuestions.slice(indexOfFirstItem, indexOfLastItem);

    // Generate page numbers to show in pagination
    const pageNumbers = [];
    const maxPageNumbers = 5; // Maximum page numbers to show in pagination

    let startPage = Math.max(1, currentPage - Math.floor(maxPageNumbers / 2));
    let endPage = Math.min(totalPages, startPage + maxPageNumbers - 1);

    if (endPage - startPage + 1 < maxPageNumbers) {
      startPage = Math.max(1, endPage - maxPageNumbers + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return {
      totalPages,
      indexOfFirstItem,
      indexOfLastItem,
      currentItems,
      pageNumbers,
      startPage,
      endPage,
      showPagination: totalItems > 0
    };
  }, [filteredQuestions, currentPage, itemsPerPage]);

  useEffect(() => {
    if (propQuestions.length > 0) {
      setQuestions(propQuestions);
      setFilteredQuestions(propQuestions);
      setIsLoading(false);
    } else {
      // Load questions if not provided
      const loadQuestions = async () => {
        try {
          const questionsRef = ref(database, `questions`);
          const snapshot = await get(questionsRef);
          if (snapshot.exists()) {
            // Convert object of questions to array format
            const questions = Object.entries(snapshot.val()).map(([id, questionData]) => ({
              id,
              title: questionData.questionname,
              description: questionData.question,
              difficulty: questionData.difficulty,
              type: questionData.type,
              examples: questionData.Example,
              constraints: questionData.constraints,
              testCases: questionData.testcases
            }));
            console.log(questions);
            setQuestions(questions);
            setFilteredQuestions(questions);
          }
        } catch (error) {
          console.error('Error loading questions:', error);
        } finally {
          setIsLoading(false);
        }
      };

      if (isOpen) {
        loadQuestions();
      }
    }
  }, [isOpen, propQuestions]);

  const handleQuestionToggle = (questionId) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const handleAddSelected = () => {
    const selected = questions.filter(q => selectedQuestions.includes(q.id));
    onAddQuestions(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/30"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-4xl rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
          {/* Close button */}
          <button
            type="button"
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-500"
            onClick={onClose}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Modal content */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeTab === 'select' ? 'Select Questions' : 'Create New Question'}
            </h2>


            {/* Content */}
            <div className="mt-4">
              {activeTab === 'select' ? (
                <div>
                  {/* Search input */}
                  <div className="mb-4">
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="text"
                        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-white bg-white dark:bg-gray-700 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                        placeholder="Search by title, content, or type (MCQ, Programming, SQL)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Filter and Sort Controls */}
                  <div className="mb-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Type Filter Buttons */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Filter:</span>
                      <div className="inline-flex rounded-md shadow-sm" role="group">
                        <button
                          onClick={() => setFilterType('all')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-l-md border ${
                            filterType === 'all'
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setFilterType('mcq')}
                          className={`px-3 py-1.5 text-xs font-medium border-t border-b ${
                            filterType === 'mcq'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          MCQ
                        </button>
                        <button
                          onClick={() => setFilterType('programming')}
                          className={`px-3 py-1.5 text-xs font-medium border-t border-b ${
                            filterType === 'programming'
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          Programming
                        </button>
                        <button
                          onClick={() => setFilterType('sql')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-r-md border ${
                            filterType === 'sql'
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          SQL
                        </button>
                      </div>
                    </div>

                      {/* Sort Controls */}
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 dark:text-white"
                        >
                          <option value="title">Title</option>
                          <option value="type">Type</option>
                        </select>
                        <button
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="px-2 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 dark:text-white flex items-center gap-1"
                          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                          {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Results Counter */}
                    {filteredQuestions.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
                        {filterType !== 'all' && ` (${filterType.toUpperCase()} only)`}
                      </div>
                    )}
                  </div>

                  {/* Questions list */}
                  <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                    {isLoading ? (
                      <LoadingPage message="Loading questions, please wait..."/>
                    ) : filteredQuestions.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">
                        {searchTerm || filterType !== 'all' 
                          ? 'No questions match your filters.' 
                          : 'No questions available.'}
                      </p>
                    ) : (
                      currentItems.map((question) => {
                        const isAlreadyInTest = existingQuestionIds.includes(question.id);
                        const isSelected = selectedQuestions.includes(question.id);
                        
                        return (
                        <div
                          key={question.id}
                          className={`p-4 rounded-lg border transition-all cursor-pointer relative ${
                            isAlreadyInTest
                              ? 'border-green-400 bg-green-50 dark:bg-green-900/20 opacity-70'
                              : isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500'
                          }`}
                          onClick={() => handleQuestionToggle(question.id)}
                        >
                          <div className="flex items-start">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={selectedQuestions.includes(question.id) || isAlreadyInTest}
                                onChange={() => { }}
                                disabled={isAlreadyInTest}
                                className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                              />
                              {isAlreadyInTest && (
                                <svg className="absolute top-1 left-0 h-4 w-4 text-green-600 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                                  {question.title}
                                </h3>
                                {question.type && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    question.type.toLowerCase() === 'mcq' 
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      : question.type.toLowerCase() === 'programming'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                      : question.type.toLowerCase() === 'sql'
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {question.type.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                {question.content || question.description || 'No description available'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                      })
                    )}
                  </div>

                  {/* Always show pagination controls if there are any questions */}
                  {filteredQuestions.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                            <span className="font-medium">
                              {Math.min(indexOfLastItem, filteredQuestions.length)}
                            </span>{' '}
                            of <span className="font-medium">{filteredQuestions.length}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="sr-only">Previous</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>

                            {startPage > 1 && (
                              <>
                                <button
                                  onClick={() => setCurrentPage(1)}
                                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm font-medium ${1 === currentPage
                                      ? 'z-10 bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 text-indigo-600 dark:text-indigo-300'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                  1
                                </button>
                                {startPage > 2 && (
                                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    ...
                                  </span>
                                )}
                              </>
                            )}

                            {pageNumbers.map(number => (
                              <button
                                key={number}
                                onClick={() => setCurrentPage(number)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${number === currentPage
                                    ? 'z-10 bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 text-indigo-600 dark:text-indigo-300'
                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                  }`}
                              >
                                {number}
                              </button>
                            ))}

                            {endPage < totalPages && (
                              <>
                                {endPage < totalPages - 1 && (
                                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    ...
                                  </span>
                                )}
                                <button
                                  onClick={() => setCurrentPage(totalPages)}
                                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm font-medium ${totalPages === currentPage
                                      ? 'z-10 bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 text-indigo-600 dark:text-indigo-300'
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                  {totalPages}
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="sr-only">Next</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Question Title
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter question title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Enter question description"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${activeTab === 'select' && selectedQuestions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                onClick={activeTab === 'select' ? handleAddSelected : () => { }}
                disabled={activeTab === 'select' && selectedQuestions.length === 0}
              >
                {activeTab === 'select' ? (
                  <>
                    <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5 inline" />
                    Add Selected ({selectedQuestions.length})
                  </>
                ) : (
                  'Create Question'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleModal;
