
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';
import { useParams, useNavigate } from "react-router-dom";
import { Copy } from "lucide-react";


import { Icons, languageTemplates } from '../constants';
import { RxCrossCircled, RxCheckCircled } from "react-icons/rx";
import { BsDashCircle } from "react-icons/bs";

import { database } from "../../firebase";
import { ref, get, set, child } from "firebase/database";

import AnimatedTestResults from '../AnimatedTestResults';
import { executeCode } from '../api';
import { useAuth } from '../../context/AuthContext';

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { setItemWithExpiry, getItemWithExpiry } from "../../utils/storageWithExpiry";






function CodePage({ question }) {
  const [code, setCode] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [output, setOutput] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [testCaseTab, setTestCaseTab] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(45);
  const [selectedLanguage, setSelectedLanguage] = useState('cpp');
  const { theme } = useTheme();
  const [testCasesrun, setTestCases] = useState([]);
  const [allowlanguages, setallowlanguages] = useState([]);
  const [questionData, setQuestionData] = useState(null); // Initialize questionData state

  const [runsubmit, setRunSubmit] = useState('none');
  const [submissionTrigger, setSubmissionTrigger] = useState(0); // New state to trigger submission refresh

  const [showCopyModal, setShowCopyModal] = useState(false);
  const [pendingCopyText, setPendingCopyText] = useState("");

  // Open modal before copy
  const openCopyModal = (text) => {
    setPendingCopyText(text);
    setShowCopyModal(true);
  };

  const { testid } = useParams();
  const { user } = useAuth();
  const userId = user?.uid;
  const [submissionStatus, setSubmissionStatus] = useState('not_attended');
  const [submissions, setSubmissions] = useState([]);

  const sanitizeKey = (key) => {
    if (!key) return '';
    return key.replace(/[.#$/\[\]:]/g, '_');
  };



  const handleCopy = useCallback(async (text) => {
    try {
      setCode(text);
      await setCode(text);
      toast.success("Copied to Editor");
    } catch (error) {
      toast.error("Failed to copy");
    }
    setShowCopyModal(false);
    setPendingCopyText("");
  }, []);



  const logSubmission = async (status, submittedCode, marks , updatedResults) => {
    console.log("logging submission");
    console.log(user?.email);

    if (!user?.uid) return;

    const timestamp = new Date().toISOString();
    const safeTimestamp = sanitizeKey(timestamp);

    const path = `ExamCodeSubmissions/${testid}/${userId}/${question}/${safeTimestamp}`;

    try {
      await set(ref(database, path), {
        language: selectedLanguage,
        status,
        code: submittedCode,
        marks: marks * 100 || 0,
        testResults: updatedResults || [],
      });
      console.log("Submission logged successfully.");
      setSubmissionTrigger(prev => prev + 1); // Trigger submission refresh
    } catch (error) {
      console.error("Error logging submission:", error);
    }
  };


  // Fetch submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!user?.uid || !testid || !question) return;

      const path = `ExamCodeSubmissions/${testid}/${userId}/${question}`;
      const snapshot = await get(ref(database, path));

      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.entries(data).map(([timestamp, entry]) => ({
          timestamp,
          ...entry,
        }));
        setSubmissions(parsed.reverse());
      } else {
        setSubmissions([]);
      }
    };

    fetchSubmissions();
  }, [user, testid, question, submissionTrigger]); // Added submissionTrigger as dependency




  useEffect(() => {
    const preventDefault = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const preventContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const blockPaste = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '');
        e.clipboardData.clearData();
      }

      toast.error('Copy-paste is disabled in this environment');
      return false;
    };

    const blockDragDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const options = { capture: true, passive: false };

    document.addEventListener('copy', preventDefault, options);
    document.addEventListener('cut', preventDefault, options);
    document.addEventListener('paste', blockPaste, options);
    document.addEventListener('contextmenu', preventContextMenu, options);

    document.addEventListener('drop', blockDragDrop, options);
    document.addEventListener('dragover', blockDragDrop, options);

    const preventShortcuts = (e) => {
      const isPaste = (e.ctrlKey || e.metaKey) && ['v', 'V', 'Insert'].includes(e.key);
      const isCopy = (e.ctrlKey || e.metaKey) && ['c', 'C', 'Insert', 'F3', 'F16', 'F24'].includes(e.key);
      const isCut = (e.ctrlKey || e.metaKey) && ['x', 'X', 'Delete'].includes(e.key);

      if (isPaste || isCopy || isCut) {
        e.preventDefault();
        e.stopPropagation();

        window.getSelection().removeAllRanges();

        if (isPaste) {
          toast.error('Pasting is disabled in this environment');
        }

        return false;
      }
    };

    document.addEventListener('keydown', preventShortcuts, { capture: true });

    const blockEditable = (e) => {
      if (e.target.isContentEditable) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener('paste', blockEditable, { capture: true });

    const blurHandler = () => {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
        document.activeElement.blur();
      }
    };

    window.addEventListener('blur', blurHandler);

    return () => {
      document.removeEventListener('copy', preventDefault, options);
      document.removeEventListener('cut', preventDefault, options);
      document.removeEventListener('paste', blockPaste, options);
      document.removeEventListener('contextmenu', preventContextMenu, options);
      document.removeEventListener('drop', blockDragDrop, options);
      document.removeEventListener('dragover', blockDragDrop, options);
      document.removeEventListener('keydown', preventShortcuts, { capture: true });
      document.removeEventListener('paste', blockEditable, { capture: true });
      window.removeEventListener('blur', blurHandler);
    };
  }, []);

  // Refsz
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const editorRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Function to adjust textarea height based on content
  const adjustTextareaHeight = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`;
  };

  // Update textarea heights when test case tab changes or when test cases are loaded
  useEffect(() => {
    // Use a small timeout to ensure the DOM is updated before adjusting heights
    const timer = setTimeout(() => {
      if (inputRef.current) {
        adjustTextareaHeight(inputRef.current);
      }
      if (outputRef.current) {
        adjustTextareaHeight(outputRef.current);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [testCaseTab, testCasesrun, activeTab]);

  // Fetch submission status from Firebase
  const fetchSubmissionStatus = useCallback(async () => {
    if (!userId || !testid || !question) return;
    try {
      const resultRef = ref(database, `ExamSubmissions/${testid}/${userId}/${question}/`);
      const snapshot = await get(resultRef);

      if (snapshot.exists()) {
        const result = snapshot.val();
        setSubmissionStatus(result === 'true' ? 'correct' : 'wrong');
      } else {
        setSubmissionStatus('not_attended');
      }
    } catch (error) {
      console.error("Error fetching submission status:", error);
      setSubmissionStatus('not_attended');
    }
  }, [testid, question, userId]);




  useEffect(() => {
    console.log(question);
    fetchSubmissionStatus();
  }, [question, fetchSubmissionStatus]);

  const handleSubmit2 = async () => {
    if (!questionData || !questionData.testcases) {
      console.error('Question data not loaded');
      return;
    }
    setRunSubmit('submit');
    const testCases = questionData.testcases;
    const initialResults = testCases.map(tc => ({
      input: tc.input,
      expected: tc.expectedOutput,
      output: '',
      passed: false,
      status: 'running',
    }));

    setTestResults(initialResults);
    setOutput(null);
    setActiveTab('output');

    const updatedResults = [...initialResults];

    for (let i = 0; i < testCases.length; i++) {
      const { input, expectedOutput } = testCases[i];
      const { run: result } = await executeCode(selectedLanguage, code, input);












      // regex

      if (questionData?.testcases[2]?.input === "regex2") {
        const passed = result.output.match(questionData.testcases[2].expectedOutput);
        console.log(result.output);
        console.log(questionData.testcases[2].expectedOutput);
        const regex = new RegExp(
          // "Parent => PID: (\\d+)\\nWaiting for child process to finish\\.\\nChild => PPID: (\\d+), PID: (\\d+)\\nChild process finished\\.|Child => PPID: (\\d+), PID: (\\d+)\\nParent => PID: (\\d+)\\nWaiting for child process to finish\\.\\nChild process finished\\."
          /^PID of example\.c = \d+\n(?:[A-Za-z]{3} ){2}\d{1,2} \d{2}:\d{2}:\d{2} [A-Z]+ \d{4}\n?$/
        );
        console.log(regex.test(result.output))
        updatedResults[i] = {
          input,
          expected: expectedOutput,
          output: result.output,
          passed: regex.test(result.output),
          status: 'done',
        };
        setTestResults([...updatedResults]);
        await new Promise(res => setTimeout(res, 300));
        continue;
      }
      if (questionData?.testcases[2]?.input === "regex") {
        const passed = result.output.match(questionData.testcases[2].expectedOutput);
        console.log(result.output);
        console.log(questionData.testcases[2].expectedOutput);
        const regex = new RegExp(
          /^Child => PPID: \d+, PID: \d+\nParent => PID: \d+\nWaiting for child process to finish\.\nChild process finished\.\n?$/
        );
        console.log(regex.test(result.output))
        updatedResults[i] = {
          input,
          expected: expectedOutput,
          output: result.output,
          passed: regex.test(result.output),
          status: 'done',
        };

        setTestResults([...updatedResults]);
        await new Promise(res => setTimeout(res, 300));
        continue;
      }


      const resultlist = result.output ? result.output.split("\n") : ["No output received."];
      while (resultlist[resultlist.length - 1] === "") resultlist.pop();

      const expectedLines = expectedOutput.split("\n");
      while (expectedLines[expectedLines.length - 1] === "") expectedLines.pop();

      const passed = resultlist.length === expectedLines.length &&
        resultlist.every((val, idx) => val.trimEnd() === expectedLines[idx].trimEnd());

      updatedResults[i] = {
        input,
        expected: expectedOutput,
        output: result.output,
        passed,
        status: 'done',
      };

      setTestResults([...updatedResults]);
    }

    const allPassed = updatedResults.every(tc => tc.passed);
    const mark = updatedResults.filter(tc => tc.passed).length;

    let vm = 0;
    let hm = 0;
    let tclen = updatedResults.length;

    updatedResults.forEach((tc, index) => {
      if (tc.passed) {
        if (index < 2) {
          vm += 1;  // first two test cases
        } else {
          hm += 1;  // remaining test cases
        }
      }
    });

    let marks = (vm / 2) * 0.3 + (hm / (tclen - 2)) * 0.7;

    if( updatedResults.length <=2  )
    {
      marks = (vm / 2) * 1.0 ;
    }
    


    await logSubmission(allPassed ? 'correct' : 'wrong', code, marks , updatedResults);

    toast.success('Submitted', {
      autoClose: 1000, // 3 seconds
    });




    const finalResult = allPassed ? 'true' : 'false';

    // setOutput(finalResult);

    // ✅ Save final result to Firebase Realtime Database
    const resultRef = ref(database, `ExamSubmissions/${testid}/${user.uid}/${question}/`); // 'submissions' node, new entry
    const markRef = ref(database, `Marks/${testid}/${user.uid}/${question}/`); // 'submissions' node, new entry

    const prevmark = await get(markRef);
    if (prevmark.exists() && prevmark.val() >= (marks * 100)) {
      return;
    }
    await set(resultRef, finalResult);
    await set(markRef, (marks) * 100);

    setSubmissionStatus(allPassed ? 'correct' : 'wrong');


    console.log("Saved to Firebase:", finalResult);
  };






  const runCode = async () => {
    if (!testCasesrun || testCasesrun.length === 0) {
      console.error('No test cases available');
      return;
    }
    setRunSubmit('run');
    const testCases = testCasesrun;
    console.log('Running test cases:', testCases);

    try {
      // Initialize test results with 'running' status
      const initialResults = testCases.map(tc => ({
        input: tc.input || '',
        expected: tc.expectedOutput || '',
        output: '',
        passed: false,
        status: 'running',
        isFirstFailure: false
      }));

      setTestResults(initialResults);
      setOutput(null);
      setActiveTab('output');

      const updatedResults = [...initialResults];
      let firstFailureShown = false;

      for (let i = 0; i < testCases.length; i++) {
        const { input: testInput, expectedOutput } = testCases[i];

        try {
          const { run: result } = await executeCode(selectedLanguage, code, testInput);

          // regex
          if (questionData?.testcases[2]?.input === "regex2") {
            const passed = result.output.match(questionData.testcases[2].expectedOutput);
            console.log(result.output);
            console.log(questionData.testcases[2].expectedOutput);
            const regex = new RegExp(
              // "Parent => PID: (\\d+)\\nWaiting for child process to finish\\.\\nChild => PPID: (\\d+), PID: (\\d+)\\nChild process finished\\.|Child => PPID: (\\d+), PID: (\\d+)\\nParent => PID: (\\d+)\\nWaiting for child process to finish\\.\\nChild process finished\\."
              /^PID of example\.c = \d+\n(?:[A-Za-z]{3} ){2}\d{1,2} \d{2}:\d{2}:\d{2} [A-Z]+ \d{4}\n?$/
            );
            console.log(regex.test(result.output))
            updatedResults[i] = {
              input: testInput,
              expected: expectedOutput,
              output: result.output,
              passed: regex.test(result.output),
              status: 'done',
              isFirstFailure: !passed && !firstFailureShown
            };
            if (!passed && !firstFailureShown) {
              firstFailureShown = true;
              // Auto-expand the first failed test case
              setTestCaseTab(i);
            }
          }
          else if (questionData?.testcases[2]?.input === "regex") {
            const passed = result.output.match(questionData?.testcases[2]?.expectedOutput);
            console.log(result.output);
            console.log(questionData?.testcases[2]?.expectedOutput);
            const regex = new RegExp(
              /^Child => PPID: \d+, PID: \d+\nParent => PID: \d+\nWaiting for child process to finish\.\nChild process finished\.\n?$/);
            console.log(regex.test(result.output))
            updatedResults[i] = {
              input: testInput,
              expected: expectedOutput,
              output: result.output,
              passed: regex.test(result.output),
              status: 'done',
              isFirstFailure: !passed && !firstFailureShown
            };
            if (!passed && !firstFailureShown) {
              firstFailureShown = true;
              // Auto-expand the first failed test case
              setTestCaseTab(i);
            }
          }






















          else {

            const resultOutput = result.output || '';
            const resultLines = resultOutput ? resultOutput.split("\n").filter(line => line !== '') : [];
            const expectedLines = expectedOutput ? expectedOutput.split("\n").filter(line => line !== '') : [];

            const passed = resultLines.length === expectedLines.length &&
              resultLines.every((val, idx) => val.trimEnd() === expectedLines[idx].trimEnd());

            updatedResults[i] = {
              input: testInput,
              expected: expectedOutput,
              output: resultOutput,
              passed,
              status: 'done',
              isFirstFailure: !passed && !firstFailureShown
            };
            if (!passed && !firstFailureShown) {
              firstFailureShown = true;
              // Auto-expand the first failed test case
              setTestCaseTab(i);
            }

          }


        } catch (error) {
          console.error(`Error executing test case ${i + 1}:`, error);
          updatedResults[i] = {
            input: testInput,
            expected: expectedOutput || '',
            output: error.message || 'Error executing code',
            passed: false,
            status: 'done',
            isFirstFailure: !firstFailureShown
          };

          if (!firstFailureShown) {
            firstFailureShown = true;
            // Auto-expand the first failed test case
            setTestCaseTab(i);
          }
        }

        // Update UI after each test case
        setTestResults([...updatedResults]);

        // Small delay to show test cases running one by one
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error("Error during test cases:", error);
      setTestResults([{
        input: '',
        expected: '',
        output: error.message || 'Error executing test cases',
        passed: false,
        status: 'done',
        isFirstFailure: true
      }]);
    }









  };


  // Fixed loadCode function
  const loadCode = useCallback(async () => {
    if (!userId || !testid || !question) return;
    try {
      const dbRef = ref(database);
      const codeKey = `ExamCode/${testid}/${userId}/${question}/${selectedLanguage}`;
      const snapshot = await get(child(dbRef, codeKey));

      console.log(snapshot.val());

      if (snapshot.exists()) {
        const savedCode = snapshot.val();
        setCode(savedCode);
        console.log("Code loaded successfully!");
      } else {
        // Set default template if no saved code exists
        setCode(languageTemplates[selectedLanguage] || "");
        console.log("No saved code found, using default template");
      }
    } catch (error) {
      console.error("Error loading code:", error);
      // Fallback to default template on error
      setCode(languageTemplates[selectedLanguage] || "");
    }
  }, [selectedLanguage, testid, question, userId]);

  // Fixed saveCode function
  const saveCode = useCallback(async (codeToSave) => {
    if (!userId || !testid || !question) return;
    try {
      const codeKey = `ExamCode/${testid}/${userId}/${question}/${selectedLanguage}`;
      const dbRef = ref(database, codeKey);
      await set(dbRef, codeToSave);
      console.log("Code auto-saved successfully!");
    } catch (error) {
      console.error("Error saving code:", error);
    }
  }, [selectedLanguage, testid, question, userId]);


  // Fixed handleCodeChange function
  const handleCodeChange = useCallback((newValue) => {
    setCode(newValue); // Update state immediately

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for saving
    saveTimeoutRef.current = setTimeout(() => {
      saveCode(newValue);
    }, 500);
  }, [saveCode]);


  // Fixed handleLanguageChange function
  const handleLanguageChange = useCallback((e) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    // Load saved code for the new language, or use template if none exists
    // Note: loadCode will be called in useEffect when selectedLanguage changes
  }, []);

  // Reset code to the original template for the selected language
  const handleResetCode = useCallback(async () => {
    const template = languageTemplates[selectedLanguage] || "";
    setCode(template);
    await saveCode(template);
    toast.success('Code reset to default template');
    setShowResetModal(false);
  }, [selectedLanguage, saveCode]);

  // Load code when component mounts or language changes
  useEffect(() => {
    if (questionData && userId) { // Only load after question data is available
      loadCode();
    }
  }, [loadCode, questionData, userId]);


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // async function getAllowedLanguageTemplates() {

  //   const dbRef = ref(database);

  //   try {
  //     const snapshot = await get(child(dbRef, `/AlgoCore/${course}/allowedLanguages`));

  //     if (!snapshot.exists()) {
  //       console.warn("No data found in Firebase.");
  //       return {};
  //     }

  //     const data = snapshot.val();

  //     setallowlanguages(data);

  //     console.log(allowlanguages);

  //   } catch (error) {
  //     console.error("Failed to fetch templates:", error);
  //     return [];
  //   }
  // }


  // Fetch question data from Firebase
  useEffect(() => {

    const fetchData = async () => {
      try {
        // Single call for both question data and next question URL
        const questionRef = ref(
          database,
          `questions/${question}`);

        // Get both question data and all questions in parallel
        const [questionSnapshot] = await Promise.all([
          get(questionRef),
        ]);

        console.log(questionSnapshot.val());

        if (questionSnapshot.exists()) {
          const question = questionSnapshot.val();


          const testCases = [
            { input: question?.testcases[0]?.input, expectedOutput: question?.testcases[0]?.expectedOutput },
            ...(question?.testcases[1]?.expectedOutput
              ? [{ input: question?.testcases[1]?.input, expectedOutput: question?.testcases[1]?.expectedOutput }]
              : [])
          ];

          setTestCases(testCases);


          console.log(question);
          setQuestionData(question);
        }
      } catch (error) {
        console.error("Error fetching data from Firebase:", error);
      }
    };

    fetchData();

    console.log(question);

  }, [question]); // Dependencies adjusted

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;

    // Clean up previous observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    // Initialize new ResizeObserver
    resizeObserverRef.current = new ResizeObserver(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    });

    // Observe the editor container
    const editorContainer = editor.getContainerDomNode();
    if (editorContainer) {
      resizeObserverRef.current.observe(editorContainer);
    }

    // Disable Copy (Ctrl + C)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
      const copyDisabled = getItemWithExpiry("copyDisabled");
      if (copyDisabled === null) {
        toast.error("Copy disabled!", {
          position: "top-right",
          autoClose: 3000,
        });
        setItemWithExpiry("copyDisabled", true, 5000);
        return;
      }
    });

    // Disable Paste (Ctrl + V)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      const pasteDisabled = getItemWithExpiry("pasteDisabled");
      if (pasteDisabled === null) {
        toast.error("Paste disabled!", {
          position: "top-right",
          autoClose: 3000,
        });
        setItemWithExpiry("pasteDisabled", true, 5000);
        return;
      }
    });
  }
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.layout();
    }
  }, [leftPanelWidth]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const container = document.body;
    const rect = container.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    let newLeftWidth = ((x - rect.left) / rect.width) * 100;
    // Clamp between 18% and 70%
    newLeftWidth = Math.max(18, Math.min(70, newLeftWidth));
    setLeftPanelWidth(newLeftWidth);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);




  return (
    <div className="h-[calc(100vh-5rem)] w-full flex bg-white dark:bg-dark-primary select-none overflow-hidden">      {/* Left Panel */}
      <ToastContainer />
      {/* Left Panel */}
      <div
        className="bg-white dark:bg-dark-secondary border-r border-gray-200 dark:border-dark-tertiary flex flex-col overflow-hidden h-full"
        style={{ width: `${leftPanelWidth}%` }}
      >
        <div className="flex border-b border-gray-200 dark:border-dark-tertiary">
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'description' ? 'text-[#4285F4] border-b-2 border-[#4285F4]' : 'text-gray-600 dark:text-gray-400 hover:text-[#4285F4] dark:hover:text-white'
              }`}
            onClick={() => setActiveTab('description')}
          >
            <div className="flex items-center gap-2">
              <Icons.FileText />
              Description
            </div>
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'testcases' ? 'text-[#4285F4] border-b-2 border-[#4285F4]' : 'text-gray-600 dark:text-gray-400 hover:text-[#4285F4] dark:hover:text-white'
              }`}
            onClick={() => setActiveTab('testcases')}
          >
            <div className="flex items-center gap-2">
              <Icons.Code2 />
              Test Cases
            </div>
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'output' ? 'text-[#4285F4] border-b-2 border-[#4285F4]' : 'text-gray-600 dark:text-gray-400 hover:text-[#4285F4] dark:hover:text-white'
              }`}
            onClick={() => setActiveTab('output')}
          >
            <div className="flex items-center gap-2">
              <Icons.Terminal />
              Output
            </div>
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${activeTab === 'submissions' ? 'text-[#4285F4] border-b-2 border-[#4285F4]' : 'text-gray-600 dark:text-gray-400 hover:text-[#4285F4] dark:hover:text-white'}`}
            onClick={() => setActiveTab('submissions')}
          >
            <div className="flex items-center gap-2">
              <Icons.Clock />
              Submissions
            </div>
          </button>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-auto" style={{ height: '100%' }}>
          {activeTab === 'description' && (
            <div className="text-gray-700 dark:text-gray-400">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words flex items-center gap-2">
                  {String(questionData?.questionname)}
                  {submissionStatus === "not_submitted" && <BsDashCircle className="text-yellow-500" />}
                  {submissionStatus === "correct" && <RxCheckCircled className="text-green-500" />}
                  {submissionStatus === "wrong" && <RxCrossCircled className="text-red-500" />}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">Easy</span>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Icons.Trophy />
                    <span className="text-sm">2.5K</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Icons.Clock />
                    <span className="text-sm">15 min</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="break-words">
                  {questionData?.question}
                </p>

                <div className="mt-6">
                  <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Example 1:</h2>
                  <pre className="bg-gray-50 dark:bg-dark-secondary p-4 rounded-lg font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                    {questionData?.Example[0]}
                  </pre>
                </div>

                {questionData?.Example[1] && (
                  <div className="mt-6">
                    <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Example 2:</h2>
                    <pre className="bg-gray-50 dark:bg-dark-secondary p-4 rounded-lg font-mono whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                      {questionData?.Example[1]}
                    </pre>
                  </div>
                )}



                <div className="mt-6">
                  <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Constraints:</h2>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700 dark:text-gray-400">
                    {
                      questionData?.constraints.map((element) => (
                        <li>{element}</li>
                      ))
                    }

                  </ul>
                </div>



              </div>
            </div>
          )}


          {activeTab === 'testcases' && (

            <div className="space-y-6">

              {
                (questionData?.testcases?.length >= 3 && questionData?.testcases?.[2].input === "regex") ?
                  (
                    <h1>No input</h1>
                  )
                  :
                  (


                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white"> Manual Test Cases </h3>
                      <div className="flex items-center gap-2 mb-4">
                        {testCasesrun.map((_, idx) => (
                          <button
                            key={idx}
                            className={`px-4 py-2 rounded-t-lg font-medium border-b-2 transition-colors duration-150 focus:outline-none ${testCaseTab === idx ? 'border-[#4285F4] text-[#4285F4] bg-white dark:bg-dark-secondary' : 'border-transparent text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-dark-tertiary hover:text-[#4285F4]'
                              }`}
                            onClick={() => setTestCaseTab(idx)}
                          >
                            Case {idx + 1}
                          </button>
                        ))}
                        <button
                          className="ml-2 px-3 py-2 rounded-full bg-[#4285F4] text-white hover:bg-[#357ae8] text-lg font-bold"
                          onClick={() => {
                            setTestCases([...testCasesrun, { input: '', expectedOutput: '' }]);
                            setTestCaseTab(testCasesrun.length);
                          }}
                        >
                          +
                        </button>
                      </div>
                      <div className="bg-gray-50 dark:bg-dark-secondary rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex-1 min-w-0">
                            <label className="block text-gray-700 dark:text-gray-300 mb-1 font-medium">Input</label>
                            <div className="relative">
                              <textarea
                                ref={inputRef}
                                className="w-full p-2 border border-gray-300 dark:border-dark-tertiary rounded-md bg-white dark:bg-dark-secondary text-gray-900 dark:text-white font-mono text-base min-h-[80px] resize-y whitespace-pre overflow-x-auto"
                                value={testCasesrun[testCaseTab]?.input || ''}
                                onChange={e => {
                                  const updated = [...testCasesrun];
                                  updated[testCaseTab].input = e.target.value;
                                  setTestCases(updated);
                                  requestAnimationFrame(() => {
                                    adjustTextareaHeight(e.target);
                                  });
                                }}
                                onInput={e => adjustTextareaHeight(e.target)}
                                placeholder="Enter input (supports multiple lines)"
                                rows={1}
                                style={{
                                  minHeight: '40px',
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  overflowX: 'auto',
                                  whiteSpace: 'pre',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  minWidth: '100%',
                                  maxWidth: '100%'
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="block text-gray-700 dark:text-gray-300 mb-1 font-medium">Expected Output</label>
                            <div className="relative">
                              <textarea
                                ref={outputRef}
                                className="w-full p-2 border border-gray-300 dark:border-dark-tertiary rounded-md bg-white dark:bg-dark-secondary text-gray-900 dark:text-white font-mono text-base min-h-[80px] resize-y whitespace-pre overflow-x-auto"
                                value={testCasesrun[testCaseTab]?.expectedOutput || ''}
                                onChange={e => {
                                  const updated = [...testCasesrun];
                                  updated[testCaseTab].expectedOutput = e.target.value;
                                  setTestCases(updated);
                                  requestAnimationFrame(() => {
                                    adjustTextareaHeight(e.target);
                                  });
                                }}
                                onInput={e => adjustTextareaHeight(e.target)}
                                placeholder="Enter expected output (supports multiple lines)"
                                rows={1}
                                style={{
                                  minHeight: '40px',
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  overflowX: 'auto',
                                  whiteSpace: 'pre',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  minWidth: '100%',
                                  maxWidth: '100%'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end mt-4">
                          <button
                            className="text-red-500 hover:text-red-700 font-medium"
                            onClick={() => {
                              const updated = testCasesrun.filter((_, idx) => idx !== testCaseTab);
                              setTestCases(updated.length ? updated : [{ input: '', expectedOutput: '' }]);
                              setTestCaseTab(prev => Math.max(0, prev - 1));
                            }}
                            disabled={testCasesrun.length <= 1}
                            title="Delete this test case"
                          >
                            Delete Case
                          </button>
                        </div>
                      </div>
                    </div>
                  )
              }
            </div>
          )}

          {activeTab === 'output' && (
            <div className="py-8 px-4 flex flex-col items-center">
              {output ? (
                <pre className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">{output}</pre>
              ) : (
                <>
                  <AnimatedTestResults testResults={testResults} runsubmit={runsubmit} />
                </>
              )}
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="space-y-4">
              {submissions.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-300">
                  No submissions yet for this question.
                </p>
              ) : (
                // ✅ Scrollable container for dynamic width
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-tertiary">
                  <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-dark-tertiary">
                    <thead className="bg-gray-50 dark:bg-dark-secondary">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Time</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Language</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Marks</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-dark-tertiary">
                      {submissions.map((s, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-hover transition">
                          {/* Formatted Time */}
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {(() => {
                              const fixed = s.timestamp.replace(/T(\d{2})_(\d{2})_(\d{2})_(\d{3})Z/, 'T$1:$2:$3.$4Z');
                              const date = new Date(fixed);
                              return isNaN(date.getTime())
                                ? 'N/A'
                                : date.toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                });
                            })()}
                          </td>

                          {/* Language */}
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {s.language}
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-2 text-sm font-medium text-center whitespace-nowrap">
                            {s.marks === 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 font-semibold">
                                Failed
                              </span>
                            ) : s.marks === 100  ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                                Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                                Partial 
                              </span>
                            )}
                          </td>

                          {/* Marks */}
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 text-center whitespace-nowrap">
                            {s.marks }/100
                          </td>


                          {/* Copy Code Action */}
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <button
                              onClick={() => openCopyModal(s.code)}
                              className="text-gray-400 hover:text-blue-500 transition"
                              title="Copy code"
                            >
                              <Copy size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Draggable Divider */}
      <div
        className={`w-1 bg-gray-200 dark:bg-dark-tertiary hover:bg-[#4285F4] cursor-col-resize flex items-center justify-center group transition-colors duration-150 ${isDragging ? 'bg-[#4285F4]' : ''}`}
        onMouseDown={handleMouseDown}
        style={{ zIndex: 10 }}
      >
        <Icons.GripVertical
          size={16}
          className="text-gray-400 group-hover:text-[#4285F4] opacity-0 group-hover:opacity-100"
        />
      </div>

      {/* Right Panel (Code Editor) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <div className="bg-white dark:bg-dark-secondary border-t border-gray-200 dark:border-dark-tertiary p-2 flex justify-end gap-6">
          <div className="flex items-center gap-4">
            <select
              className="bg-white dark:bg-dark-secondary text-gray-900 dark:text-white border border-gray-300 dark:border-dark-tertiary rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#4285F4] focus:border-transparent"
              value={selectedLanguage}
              onChange={handleLanguageChange}
            >
              {/* <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option> */}
              <option value="cpp">C</option>
              {/* {  allowlanguages.map((lang) => (
                <option key={lang} value={lang}>
                  { lang}
                </option>
              ))} */}
            </select>
          </div>
          {/* Right: Run/Submit/Stats */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowResetModal(true)}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-dark-tertiary dark:hover:bg-dark-tertiary/80 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-150"
              title="Reset to default template"
            >
              <Icons.History />
              Reset Code
            </button>

            <button
              onClick={runCode}
              className="bg-[#4285F4] hover:bg-[#4285F4]/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-150"
            >
              <Icons.Play />
              Run Code
            </button>
            <button
              onClick={handleSubmit2}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors duration-150"
            >
              <Icons.ChevronRight />
              Submit
            </button>
          </div>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-900 min-w-0 overflow-auto">
          <Editor
            height="100%"
            defaultLanguage="cpp"
            language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage}
            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
            value={code}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              tabSize: 2,
              dragAndDrop: true,
              formatOnPaste: true,
              formatOnType: true
            }}
          />
        </div>
      </div>
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Code</h3>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
              This will replace your current code with the default template for the selected language. This action cannot be undone.
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleResetCode}
                className="px-5 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {showCopyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Confirm Copy
              </h3>
            </div>

            {/* Body */}
            <div className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
              Are you sure you want to copy this code snippet to your clipboard?
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCopy(pendingCopyText)}
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Confirm Copy
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CodePage;