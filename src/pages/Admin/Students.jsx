import React, { useState, useEffect, useCallback } from 'react';
import { FiTrash2, FiUserPlus, FiMail, FiUpload, FiDownload, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { ref, get, set, remove, push, update } from 'firebase/database';
import { database } from '../../firebase';

const Students = ({ test, setTest, testId }) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [manualStudents, setManualStudents] = useState({});
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [newStudent, setNewStudent] = useState({ name: '', email: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [showStudentSelector, setShowStudentSelector] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'email'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  // Fetch students
  const fetchStudents = useCallback(async () => {
    try {
      const eligibleRef = ref(database, `Exam/${testId}/Eligible`);
      const snapshot = await get(eligibleRef);

      if (!snapshot.exists()) {
        return { eligibleStudents: {}, enrolledStudents: [] };
      }

      const eligibleData = snapshot.val();
      let eligibleStudents = {};

      // Handle both formats: {email:name} and array/object formats
      if (eligibleData && typeof eligibleData === 'object' && !Array.isArray(eligibleData)) {
        // New format: {name:email}
        eligibleStudents = eligibleData;
      } else if (Array.isArray(eligibleData)) {
        // Old array format
        eligibleStudents = eligibleData.reduce((acc, student) => {
          acc[student.name] = student.email;
          return acc;
        }, {});
      } else if (eligibleData && typeof eligibleData === 'object') {
        // Old object format
        eligibleStudents = Object.entries(eligibleData).reduce((acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value;
          } else {
            acc[value.name] = value.email;
          }
          return acc;
        }, {});
      }

      return {
        eligibleStudents,
        enrolledStudents: Object.keys(eligibleStudents)
      };
    } catch (error) {
      console.error('Error fetching students:', error);
      return { eligibleStudents: {}, enrolledStudents: [] };
    }
  }, [testId]);

  useEffect(() => {
    const loadStudents = async () => {
      const { eligibleStudents, enrolledStudents } = await fetchStudents();
      setManualStudents(eligibleStudents);
      setEnrolledStudents(enrolledStudents);
      setLoading(false);
    };

    if (testId) {
      loadStudents();
    }
  }, [testId, fetchStudents]);

  // Fetch all students from Firebase Students collection
  const fetchAllStudents = useCallback(async () => {
    setLoadingAllStudents(true);
    try {
      // Fetch students list (emails)
      const studentsRef = ref(database, 'Students');
      const studentsSnapshot = await get(studentsRef);

      if (!studentsSnapshot.exists()) {
        toast.error('No students found in database');
        return;
      }

      const studentEmails = studentsSnapshot.val();
      
      if (!Array.isArray(studentEmails)) {
        toast.error('Invalid students data format');
        return;
      }

      // Fetch user data for each email to get names
      const usersRef = ref(database, 'users');
      const usersSnapshot = await get(usersRef);
      const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};

      // Map emails to student objects with names
      const studentsWithNames = [];
      
      for (const email of studentEmails) {
        // Find user by email in users collection
        const userEntry = Object.entries(usersData).find(
          ([uid, userData]) => userData.email === email
        );

        studentsWithNames.push({
          email: email,
          name: userEntry ? userEntry[1].name || email : email,
          uid: userEntry ? userEntry[0] : null
        });
      }

      setAllStudents(studentsWithNames);
      setShowStudentSelector(true);
    } catch (error) {
      console.error('Error fetching all students:', error);
      toast.error('Failed to load students from database');
    } finally {
      setLoadingAllStudents(false);
    }
  }, []);

  // Add selected students from the student selector
  const addSelectedStudents = useCallback(async () => {
    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student');
      return;
    }

    setIsSaving(true);
    try {
      const eligibleRef = ref(database, `Exam/${testId}/Eligible`);
      const snapshot = await get(eligibleRef);
      const currentStudents = snapshot.exists() ? snapshot.val() : {};

      let addedCount = 0;
      let skippedCount = 0;
      const newStudents = { ...currentStudents };

      selectedStudents.forEach(studentEmail => {
        const student = allStudents.find(s => s.email === studentEmail);
        if (student) {
          // Check for duplicates
          if (currentStudents[student.name] || Object.values(currentStudents).includes(student.email)) {
            skippedCount++;
          } else {
            newStudents[student.name] = student.email;
            addedCount++;
          }
        }
      });

      if (addedCount > 0) {
        await set(eligibleRef, newStudents);
        setManualStudents(newStudents);
        setEnrolledStudents(Object.keys(newStudents));
        toast.success(`Added ${addedCount} student(s)${skippedCount > 0 ? `. Skipped ${skippedCount} duplicate(s).` : ''}`);
      } else {
        toast.warning('All selected students already exist');
      }

      setSelectedStudents(new Set());
      setShowStudentSelector(false);
      setStudentSearchQuery('');
      setSortBy('name');
      setSortOrder('asc');
    } catch (error) {
      console.error('Error adding students:', error);
      toast.error('Failed to add students');
    } finally {
      setIsSaving(false);
    }
  }, [selectedStudents, allStudents, testId]);

  // Toggle student selection
  const toggleStudentSelection = (email) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(email)) {
        newSet.delete(email);
      } else {
        newSet.add(email);
      }
      return newSet;
    });
  };

  // Add student
  const addStudent = useCallback(async (student) => {
    try {
      if (!student.email || !student.name) {
        toast.error('Both email and name are required');
        return;
      }

      setIsSaving(true);

      // Get current students
      const eligibleRef = ref(database, `Exam/${testId}/Eligible`);
      const snapshot = await get(eligibleRef);
      const currentStudents = snapshot.exists() ? snapshot.val() : {};

      // Check for duplicate name
      if (currentStudents[student.name]) {
        toast.error('Student with this name already exists');
        return;
      }

      // Check for duplicate email
      const emailExists = Object.values(currentStudents).includes(student.email);
      if (emailExists) {
        toast.error('This email is already registered');
        return;
      }

      // Update Firebase with new student in name:mail format
      await update(eligibleRef, {
        [student.name]: student.email
      });

      // Update local state
      setManualStudents(prev => ({ ...prev, [student.name]: student.email }));
      setEnrolledStudents(prev => [...prev, student.name]);
      setNewStudent({ name: '', email: '' });

      toast.success('Student added successfully');
    } catch (err) {
      console.error('Add student error:', err);
      toast.error(`Failed to add student: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [testId]);

  // Delete student
  const deleteStudent = useCallback(async (studentId) => {
    try {
      setIsSaving(true);

      // For name:mail format, studentId is the name
      const updates = {};
      updates[`Exam/${testId}/Eligible/${studentId}`] = null;

      await update(ref(database), updates);

      setManualStudents(prev => {
        const newStudents = { ...prev };
        delete newStudents[studentId];
        return newStudents;
      });
      setEnrolledStudents(prev => prev.filter(id => id !== studentId));

      toast.success('Student deleted successfully');
    } catch (err) {
      toast.error('Failed to delete student');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }, [testId]);

  // Parse CSV content
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    const students = [];

    // Skip header if it exists
    const startIndex = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('email') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [name, email] = line.split(',').map(field => field.trim().replace(/"/g, ''));

      if (name && email && email.includes('@')) {
        students.push({ name, email });
      }
    }

    return students;
  };

  // Handle CSV file upload
  const handleCSVUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);

    try {
      const text = await csvFile.text();
      const studentsFromCSV = parseCSV(text);

      if (studentsFromCSV.length === 0) {
        toast.error('No valid students found in CSV file');
        return;
      }

      // Get current students
      const eligibleRef = ref(database, `Exam/${testId}/Eligible`);
      const snapshot = await get(eligibleRef);
      const currentStudents = snapshot.exists() ? snapshot.val() : {};

      let addedCount = 0;
      let skippedCount = 0;
      const newStudents = { ...currentStudents };

      for (const student of studentsFromCSV) {
        // Check for duplicate name or email
        if (currentStudents[student.name] || Object.values(currentStudents).includes(student.email)) {
          skippedCount++;
          continue;
        }

        newStudents[student.name] = student.email;
        addedCount++;
      }

      if (addedCount > 0) {
        // Update Firebase
        await set(eligibleRef, newStudents);

        console.log(newStudents);

        console.log(newStudents);

        console.log(skippedCount);

        // Update local state
        setManualStudents(newStudents);
        setEnrolledStudents(Object.keys(newStudents));

        toast.success(`Added ${addedCount} students successfully${skippedCount > 0 ? `. Skipped ${skippedCount} duplicates.` : ''}`);
      } else {
        toast.warning('All students in the CSV already exist');
      }

      setCsvFile(null);

    } catch (error) {
      console.error('CSV upload error:', error);
      toast.error('Failed to process CSV file');
    } finally {
      setIsUploading(false);
    }
  };

  // Download CSV template
  const downloadCSVTemplate = () => {
    const csvContent = 'Name,Email\nJohn Doe,john.doe@example.com\nJane Smith,jane.smith@example.com';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('CSV template downloaded');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      {/* Search and Filter */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search students by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white p-2"
          />
        </div>
        <button
          onClick={() => {
            const filteredStudents = Object.entries(manualStudents).filter(([name, email]) =>
              name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              email.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setEnrolledStudents(filteredStudents.map(([name]) => name));
            toast.success(`Found ${filteredStudents.length} matching students`);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiMail className="mr-1.5 h-4 w-4" />
          Search
        </button>
      </div>

      {/* Student List */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden mb-4">
        <div className="max-h-96 overflow-y-auto">
          {enrolledStudents.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {enrolledStudents.map(studentName => {
                const studentEmail = manualStudents[studentName];
                return studentEmail ? (
                  <li key={studentName} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{studentName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{studentEmail}</p>
                    </div>
                    <button
                      onClick={() => deleteStudent(studentName)}
                      className="text-red-600 hover:text-red-800 dark:hover:text-red-400"
                    >
                      <FiTrash2 className="h-5 w-5" />
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No students found
            </div>
          )}
        </div>
      </div>

      {/* Add Student Form */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Students</h4>

        {/* Select from Database Section */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <FiUserPlus className="mr-2 h-4 w-4" />
            Select from Student Database
          </h5>
          <div className="flex gap-3">
            <button
              onClick={fetchAllStudents}
              disabled={loadingAllStudents}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loadingAllStudents ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  <FiUsers className="mr-2 h-4 w-4" />
                  Browse Students
                </>
              )}
            </button>
            {showStudentSelector && (
              <button
                onClick={() => {
                  setShowStudentSelector(false);
                  setSelectedStudents(new Set());
                  setStudentSearchQuery('');
                  setSortBy('name');
                  setSortOrder('asc');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Student Selector Modal/Section */}
          {showStudentSelector && (
            <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h6 className="text-sm font-medium text-gray-900 dark:text-white">
                    Select Students ({selectedStudents.size} selected)
                  </h6>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const filteredEmails = new Set(
                          allStudents
                            .filter(s => 
                              s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                              s.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
                            )
                            .sort((a, b) => {
                              const aValue = a[sortBy].toLowerCase();
                              const bValue = b[sortBy].toLowerCase();
                              if (sortOrder === 'asc') {
                                return aValue.localeCompare(bValue);
                              } else {
                                return bValue.localeCompare(aValue);
                              }
                            })
                            .map(s => s.email)
                        );
                        setSelectedStudents(filteredEmails);
                      }}
                      className="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedStudents(new Set())}
                      className="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                {/* Search Input */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  {studentSearchQuery && (
                    <button
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {/* Sort Controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white flex items-center gap-1"
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                  >
                    {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {allStudents
                  .filter(student => 
                    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                    student.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
                  )
                  .sort((a, b) => {
                    const aValue = a[sortBy].toLowerCase();
                    const bValue = b[sortBy].toLowerCase();
                    if (sortOrder === 'asc') {
                      return aValue.localeCompare(bValue);
                    } else {
                      return bValue.localeCompare(aValue);
                    }
                  })
                  .length > 0 ? (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {allStudents
                      .filter(student => 
                        student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
                        student.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
                      )
                      .sort((a, b) => {
                        const aValue = a[sortBy].toLowerCase();
                        const bValue = b[sortBy].toLowerCase();
                        if (sortOrder === 'asc') {
                          return aValue.localeCompare(bValue);
                        } else {
                          return bValue.localeCompare(aValue);
                        }
                      })
                      .map((student) => (
                      <li key={student.email} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStudents.has(student.email)}
                            onChange={() => toggleStudentSelection(student.email)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{student.email}</p>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No students found
                  </div>
                )}
              </div>
              {selectedStudents.size > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                  <button
                    onClick={addSelectedStudents}
                    disabled={isSaving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <FiCheck className="mr-2 h-4 w-4" />
                        Add Selected Students
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CSV Upload Section */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Bulk Upload from CSV</h5>
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files[0])}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-600 dark:file:text-gray-200"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                CSV format: Name, Email (one student per line)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadCSVTemplate}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FiDownload className="mr-1.5 h-4 w-4" />
                Template
              </button>
              <button
                onClick={handleCSVUpload}
                disabled={!csvFile || isUploading}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1.5"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <FiUpload className="mr-1.5 h-4 w-4" />
                    Upload CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Manual Add Section */}
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Individual Student</h5>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            type="text"
            placeholder="Name"
            value={newStudent.name}
            onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white p-2"
          />
          <input
            type="email"
            placeholder="Email"
            value={newStudent.email}
            onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white p-2"
          />
          <button
            onClick={async () => {
              if (newStudent.name && newStudent.email) {
                try {
                  await addStudent(newStudent);
                } catch (err) {
                  console.error(err);
                }
              }
            }}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FiUserPlus className="mr-1.5 h-4 w-4" />
            Add Student
          </button>
        </div>
      </div>
    </div>
  );
};

export default Students;
