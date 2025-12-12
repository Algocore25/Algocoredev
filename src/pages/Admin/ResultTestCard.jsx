import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, remove } from 'firebase/database';
import { FiTrash2 } from 'react-icons/fi';
import { database } from '../../firebase';

export default function ResultTestCard({ test }) {
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await remove(ref(database, `Exam/${test.id}`));
      setIsConfirmOpen(false);
    } catch (error) {
      console.error('Error deleting exam:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 relative border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-900">
      <div className="absolute top-3 right-3">
        <button
          onClick={(event) => {
            event.stopPropagation();
            setIsConfirmOpen(true);
          }}
          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-full hover:bg-red-50 dark:hover:bg-gray-700"
          title="Delete exam"
        >
          <FiTrash2 size={18} />
        </button>
      </div>
      <h3 className="text-xl font-semibold text-gray-800 dark:text-white pr-6">{test.name}</h3>
      <p className="text-gray-600 dark:text-gray-300 mt-2">
        Created: {new Date(test.createdAt).toLocaleDateString()}
      </p>
      <p className="text-gray-600 dark:text-gray-300">
        Status: <span className="capitalize">{test.Properties?.status || 'completed'}</span>
      </p>
      <div className="mt-4">
        <button
          onClick={() => navigate(`/adminresults/${test.id}`)}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Show Results
        </button>
      </div>
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete exam?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              This action cannot be undone. Are you sure you want to delete `{test.name}`?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
