import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../context/ThemeContext';
import { executeCode } from './api';
import { languageTemplates } from './constants';

const CompilerPage = () => {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [output, setOutput] = useState({
    stdout: 'Your output will appear here.',
    stderr: null,
    time: null,
    memory: null,
  });
  const [language, setLanguage] = useState('cpp');
  const [isLoading, setIsLoading] = useState(false);

  // Load code from localStorage on component mount
  useEffect(() => {
    const savedCode = localStorage.getItem('compiler-code');
    const savedLanguage = localStorage.getItem('compiler-language');
    
    if (savedCode) {
      setCode(savedCode);
    } else {
      setCode(languageTemplates['cpp']);
    }
    
    if (savedLanguage) {
      setLanguage(savedLanguage);
    }
  }, []);

  // Save code to localStorage whenever it changes
  useEffect(() => {
    if (code) {
      localStorage.setItem('compiler-code', code);
    }
  }, [code]);

  // Save language to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('compiler-language', language);
  }, [language]);

  const handleRunCode = async () => {
    setIsLoading(true);
    setOutput({ stdout: 'Executing...', stderr: null, time: null, memory: null });
    try {
      const result = await executeCode(language, code, '');
      setOutput({
        stdout: result.run.stdout || '',
        stderr: result.run.stderr || '',
        time: `${result.run.cpuTime} ms`,
        memory: `${result.run.memory} KB`,
      });
    } catch (error) {
      setOutput({
        stdout: '',
        stderr: error.message || 'Execution failed.',
        time: null,
        memory: null,
      });
    }
    setIsLoading(false);
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    // Note: We're NOT setting code to the template anymore
    // The user's existing code is preserved
  };

  // Function to reset code to language template (optional - you can add a reset button)
  const resetToTemplate = () => {
    setCode(languageTemplates[language]);
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 md:p-6 bg-gray-100 dark:bg-gray-900 h-[calc(100vh-4rem)] overflow-hidden">
      {/* Code Editor Panel */}
      <div className="flex flex-col w-full md:w-3/5 h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-gray-800 dark:text-white font-semibold">Code Editor</h2>
          <div className="flex gap-2 items-center">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="bg-white dark:bg-gray-700 text-sm rounded-md px-2 py-1 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white"
            >
              <option value="cpp">C++</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
            </select>
            {/* Optional: Reset button to load language template */}
            <button
              onClick={resetToTemplate}
              className="text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-2 py-1 rounded transition"
              title="Reset to template"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-grow overflow-hidden" style={{ height: '100%' }}>
          <Editor
            height="100%"
            language={language}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
            }}
          />
        </div>

        {/* Run Button */}
        <div className="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleRunCode}
            className="bg-[#4285F4] hover:bg-[#357ae8] text-white px-4 py-2 rounded-md font-medium transition disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>

      {/* Output Panel */}
      <div className="flex flex-col w-full md:w-2/5 h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-gray-800 dark:text-white font-semibold">Output</h2>
        </div>
        <div className="flex-grow overflow-auto px-4 py-4">
          {output.stderr ? (
            <pre className="text-red-500 font-mono whitespace-pre-wrap">{output.stderr}</pre>
          ) : (
            <>
              <pre className="text-gray-800 dark:text-gray-100 font-mono whitespace-pre-wrap">{output.stdout}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompilerPage;
