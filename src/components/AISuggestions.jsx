import React, { useState, useEffect } from 'react';
import { getGroqResponse } from '../pages/api';
import { database } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

// Simple markdown formatter component
const MarkdownFormatter = ({ text }) => {
  if (!text) return null;

  // Simple markdown parsing
  const formatText = (text) => {
    // Replace **bold** with <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace *italic* with <em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace `inline code` with <code>
    text = text.replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Replace ### headers with <h3>
    text = text.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">$1</h3>');
    
    // Replace ## headers with <h2>
    text = text.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2 text-gray-900 dark:text-white">$1</h2>');
    
    // Replace # headers with <h1>
    text = text.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900 dark:text-white">$1</h1>');
    
    // Replace code blocks ```code``` with <pre><code>
    text = text.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto my-2"><code class="text-sm font-mono text-gray-800 dark:text-gray-200">$1</code></pre>');
    
    // Replace line breaks with <br>
    text = text.replace(/\n/g, '<br>');
    
    // Replace bullet points
    text = text.replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">$1</li>');
    text = text.replace(/(<li.*<\/li>)/s, '<ul class="list-disc pl-4 space-y-1">$1</ul>');
    
    return text;
  };

  return (
    <div 
      className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
      dangerouslySetInnerHTML={{ __html: formatText(text) }}
    />
  );
};

const AISuggestionsTab = ({ questionData, userCode, userId }) => {
  const [suggestions, setSuggestions] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [error, setError] = useState('');

  const COOLDOWN_DURATION = 60000 * 5; // 5 minuteS in milliseconds

  // Check cooldown on component mount
  useEffect(() => {
    checkCooldown();
  }, [userId]);

  // Update cooldown timer
  useEffect(() => {
    if (cooldownTime > 0) {
      const timer = setInterval(() => {
        setCooldownTime(prev => {
          const newTime = prev - 1000;
          return newTime <= 0 ? 0 : newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownTime]);

  const checkCooldown = async () => {
    if (!userId) return;
    
    try {
      const docRef = doc(database, 'userCooldowns', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const lastRequestTime = data.lastSuggestionRequest?.toMillis() || 0;
        const currentTime = Date.now();
        const timeDiff = currentTime - lastRequestTime;
        
        if (timeDiff < COOLDOWN_DURATION) {
          setCooldownTime(COOLDOWN_DURATION - timeDiff);
        }
      }
    } catch (error) {
      console.error('Error checking cooldown:', error);
    }
  };

  const setCooldown = async () => {
    if (!userId) return;
    
    try {
      const docRef = doc(database, 'userCooldowns', userId);
      await setDoc(docRef, {
        lastSuggestionRequest: serverTimestamp(),
        userId: userId
      }, { merge: true });
      
      setCooldownTime(COOLDOWN_DURATION);
    } catch (error) {
      console.error('Error setting cooldown:', error);
    }
  };

  const handleGetSuggestions = async () => {
    if (cooldownTime > 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Create prompt with question metadata
      const prompt = `
Question: ${questionData?.questionname || 'Untitled'}

Description: ${questionData?.question || 'No description provided'}

Example 1: ${questionData?.Example?.[0] || 'No example provided'}

Example 2: ${questionData?.Example?.[1] || 'No example provided'}

Constraints: ${questionData?.constraints?.join(', ') || 'No constraints provided'}
      `.trim();

      const response = await getGroqResponse({
        prompt: prompt,
        code: userCode || 'No code provided yet',
        mode: 'suggestions'
      });

      setSuggestions(response);
      await setCooldown();
    } catch (error) {
      console.error('Error getting suggestions:', error);
      setError('Failed to get AI suggestions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="text-gray-700 dark:text-gray-400">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          AI Suggestions
        </h2>
        <button
          onClick={handleGetSuggestions}
          disabled={loading || cooldownTime > 0}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            loading || cooldownTime > 0
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Getting Suggestions...
            </div>
          ) : cooldownTime > 0 ? (
            `Wait ${formatTime(cooldownTime)}`
          ) : (
            'Get AI Suggestions'
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-dark-secondary rounded-lg border border-gray-200 dark:border-gray-700">
        <div 
          className="p-4 h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
          style={{ maxHeight: '384px' }}
        >
          {suggestions ? (
            <MarkdownFormatter text={suggestions} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <svg 
                  className="w-12 h-12 mx-auto mb-4 text-gray-400"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                  />
                </svg>
                <p className="text-sm">Click "Get AI Suggestions" to receive helpful hints and guidance for solving this problem.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {cooldownTime > 0 && (
        <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-sm">
          <p className="text-yellow-700 dark:text-yellow-400">
            ⏱️ Cooldown active: {formatTime(cooldownTime)} remaining to prevent spam
          </p>
        </div>
      )}
    </div>
  );
};

export default AISuggestionsTab;