import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import LoadingPage from '../LoadingPage';
import { useAuth } from '../../context/AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function StudentResult() {
    const { testid } = useParams();
    const [result, setResult] = useState(null);
    const [testName, setTestName] = useState('');
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const pdfRef = useRef();

    useEffect(() => {
        if (!user || !user.uid) {
            setLoading(false);
            return;
        }

        const fetchResultData = async () => {
            try {
                const submissionRef = ref(database, `ExamSubmissions/${testid}/${user.uid}`);
                const submissionSnapshot = await get(submissionRef);

                const questionsRef = ref(database, `Exam/${testid}/questions`);
                const questionsSnapshot = await get(questionsRef);

                const testInfoRef = ref(database, `Exam/${testid}/name`);
                const testInfoSnapshot = await get(testInfoRef);
                setTestName(testInfoSnapshot.val() || '');

                const submissionData = submissionSnapshot.val();
                const questionsData = questionsSnapshot.val();

                if (!submissionData || !questionsData) {
                    setLoading(false);
                    return;
                }

                const correctCount = questionsData.filter(qId => submissionData[qId] === 'true').length;
                const score = Math.round((correctCount / questionsData.length) * 100);

                const questionDetails = questionsData.map((qId, index) => ({
                    id: qId,
                    questionNumber: index + 1,
                    correct: submissionData[qId] === 'true',
                }));

                setResult({
                    studentName: user.displayName || user.email,
                    correctCount,
                    totalQuestions: questionsData.length,
                    score,
                    questions: questionDetails,
                });
            } catch (error) {
                console.error("Error fetching results:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResultData();
    }, [testid, user]);

    const downloadPDF = () => {
        const input = pdfRef.current;
        html2canvas(input).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4', true);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 30;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`results_${testName || testid}.pdf`);
        });
    };

    if (loading) return <LoadingPage message="Loading your results..." />;

    return (
        <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
            <div ref={pdfRef} className="bg-white rounded-lg shadow-xl p-8 max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Exam Results</h1>
                <h2 className="text-xl font-semibold text-center text-gray-600 mb-6">{testName || `Test ${testid}`}</h2>

                {result ? (
                    <div>
                        <div className="bg-blue-100 p-4 rounded-lg text-center mb-4">
                            <p className="text-md font-semibold text-blue-900">
                                <span className="font-bold">Student:</span> {result.studentName}
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-8">
                            <div className="bg-green-100 p-4 rounded-lg">
                                <p className="text-sm text-green-700 font-semibold">Score</p>
                                <p className="text-lg font-bold text-green-900">{result.score}%</p>
                            </div>
                            <div className="bg-indigo-100 p-4 rounded-lg">
                                <p className="text-sm text-indigo-700 font-semibold">Correct Answers</p>
                                <p className="text-lg font-bold text-indigo-900">{result.correctCount}</p>
                            </div>
                            <div className="bg-gray-200 p-4 rounded-lg">
                                <p className="text-sm text-gray-700 font-semibold">Total Questions</p>
                                <p className="text-lg font-bold text-gray-900">{result.totalQuestions}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-4">Detailed Breakdown</h3>
                            <div className="flex flex-wrap gap-2">
                                {result.questions.map((q) => (
                                    <span
                                        key={q.id}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${q.correct
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                            }`}
                                        title={`Question ${q.questionNumber}: ${q.correct ? 'Correct' : 'Incorrect'}`}
                                    >
                                        Q{q.questionNumber}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-gray-500 text-lg">No results found for this exam.</p>
                    </div>
                )}
            </div>

            {result && (
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={downloadPDF}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Download PDF
                    </button>
                </div>
            )}
        </div>
    );
}