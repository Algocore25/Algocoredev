
import React, { useState, useEffect } from 'react';
import { ref, onValue, remove, set } from 'firebase/database';
import { database } from '../../firebase';
import AddQuestionModal from './AddQuestionModal';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

const AddQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load questions from Firebase
  useEffect(() => {
    const questionsRef = ref(database, 'questions');
    const unsubscribe = onValue(questionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const questionsData = snapshot.val();
        const questionsArray = Object.entries(questionsData).map(([id, question]) => ({
          id,
          ...question
        }));
        setQuestions(questionsArray);
        setFilteredQuestions(questionsArray);
      } else {
        setQuestions([]);
        setFilteredQuestions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter questions based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredQuestions(questions);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = questions.filter(q => 
        (q.questionname && q.questionname.toLowerCase().includes(searchLower)) ||
        (q.question && q.question.toLowerCase().includes(searchLower))
      );
      setFilteredQuestions(filtered);
    }
  }, [searchTerm, questions]);

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setIsModalOpen(true);
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setIsModalOpen(true);
  };

  const handleDeleteQuestion = async (questionId) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await remove(ref(database, `questions/${questionId}`));
      } catch (error) {
        console.error('Error deleting question:', error);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Questions</h1>
        <button
          onClick={handleAddQuestion}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add New Question
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search questions..."
          className="w-full p-2 border rounded-md"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div>Loading questions...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-4">
          {searchTerm ? 'No questions match your search.' : 'No questions available.'}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
            <div key={question.id} className="p-4 border rounded-md shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{question.questionname}</h3>
                  <p className="text-gray-600 mt-1">{question.question}</p>
                  <div className="flex space-x-2 mt-2">
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {question.difficulty}
                    </span>
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {question.type}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditQuestion(question)}
                    className="p-1 text-blue-600 hover:text-blue-800"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(question.id)}
                    className="p-1 text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddQuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        question={editingQuestion}
      />
    </div>
  );
};

export default AddQuestions;