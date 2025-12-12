import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { database } from '../../firebase';
import { ref, get, set, query, orderByChild, equalTo } from 'firebase/database';
import LoadingPage from '../LoadingPage';
import { useAuth } from '../../context/AuthContext';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { X, Code as CodeIcon, List, Download, ChevronUp, ChevronDown } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    Correct: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    Wrong: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    'Not Attended': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  };
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status]} mb-2`}>
      {status}
    </span>
  );
};

const QuestionTypeBadge = ({ type }) => {
  const typeStyles = {
    MCQ: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    Programming: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    SQL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  };
  
  const style = typeStyles[type] || typeStyles.default;
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style} mb-2`}>
      {type}
    </span>
  );
};

const ResultsTable = ({ children }) => (
  <div className="overflow-x-auto shadow-md rounded-lg">
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      {children}
    </table>
  </div>
);

const TableHeader = ({ children, onClick, sortDirection }) => (
  <th 
    scope="col" 
    className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
    onClick={onClick}
  >
    <div className="flex items-center">
      {children}
      {sortDirection && (
        <span className="ml-2">
          {sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      )}
    </div>
  </th>
);

const TableRow = ({ children, isSelected, onClick }) => (
  <tr 
    className={`${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'} ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

const TableCell = ({ children, className = '' }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-base text-gray-900 dark:text-gray-200 ${className}`}>
    {children}
  </td>
);

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
    <span className="ml-4 text-lg font-medium text-gray-600 dark:text-gray-400">Loading...</span>
  </div>
);

export default function AdminResult() {
  const { testid } = useParams();
  const [results, setResults] = useState([]);
  const [testName, setTestName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionDetails, setQuestionDetails] = useState(null);
  const [userCode, setUserCode] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sortColumn, setSortColumn] = useState('studentId');
  const [sortDirection, setSortDirection] = useState('asc');
  const user = useAuth();
  const pdfRef = useRef();

  // Weightage state and helpers
  const [weights, setWeights] = useState({ mcq: 25, programming: 25, sql: 25, other: 25 });
  const [useWeightage, setUseWeightage] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);

  const normalizeType = (t) => {
    const s = String(t || '').toLowerCase();
    if (s.includes('program')) return 'programming';
    if (s === 'mcq') return 'mcq';
    if (s === 'sql') return 'sql';
    return 'other';
  };

  // Detailed report generation progress state
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState('');

  const [ ExamcodeSubmissions, setExamcodeSubmissions ] = useState({});

  useEffect(() => {
    const fetchreultdata = async () => {
      try {
        // Batch all database reads at once
        const [
          studentSnapshot,
          usersSnapshot,
          resultsSnapshot,
          testInfoSnapshot,
          examQuestionsSnapshot,
          marksSnapshot,
          examCodeSubmissionsSnapshot
        ] = await Promise.all([
          get(ref(database, `Exam/${testid}/Eligible`)),
          get(ref(database, 'users')),
          get(ref(database, `ExamSubmissions/${testid}`)),
          get(ref(database, `Exam/${testid}/name`)),
          get(ref(database, `Exam/${testid}/questions`)),
          get(ref(database, `Marks/${testid}`)),
          get(ref(database, `ExamCodeSubmissions/${testid}`)) // Unused but reserved for future use,
        ]);

        // Process basic data
        const studentEmails = Object.values(studentSnapshot.val() || {});
        const usersData = usersSnapshot.val() || {};
        const resultsData = resultsSnapshot.val() || {};
        const examQuestions = examQuestionsSnapshot.val() || {};
        const marksData = marksSnapshot.val() || {};
        setTestName(testInfoSnapshot.val() || '');

        setExamcodeSubmissions(examCodeSubmissionsSnapshot.val() || {});

        console.log('Exam Code Submissions:', examCodeSubmissionsSnapshot.val() || {});

        // Load weightage config
        try {
          const [weightageSnapshot, useWeightageSnapshot] = await Promise.all([
            get(ref(database, `Exam/${testid}/configure/weightage`)),
            get(ref(database, `Exam/${testid}/configure/useWeightage`))
          ]);

          if (weightageSnapshot.exists()) {
            const w = weightageSnapshot.val() || {};
            setWeights({
              mcq: Number(w.mcq) || 0,
              programming: Number(w.programming) || 0,
              sql: Number(w.sql) || 0,
              other: Number(w.other) || 0,
            });
          } else {
            // Equal weights for present categories
            const typesPresent = new Set(Object.values(examQuestions).map(normalizeType));
            const present = Array.from(typesPresent);
            const base = present.length > 0 ? Math.floor(100 / present.length) : 25;
            const defaultW = { mcq: 0, programming: 0, sql: 0, other: 0 };
            present.forEach((t) => { defaultW[t] = base; });
            const remainder = 100 - base * present.length;
            if (remainder > 0 && present[0]) defaultW[present[0]] += remainder;
            setWeights(defaultW);
          }

          if (useWeightageSnapshot.exists()) {
            setUseWeightage(Boolean(useWeightageSnapshot.val()));
          }
        } catch (e) {
          console.error('Error loading weightage config:', e);
        }

        if (!studentEmails.length) {
          setLoading(false);
          return;
        }

        // Create email to UID mapping efficiently
        const emailToUidMap = Object.fromEntries(
          Object.entries(usersData).map(([uid, userData]) => [userData.email, uid])
        );

        // Get student UIDs from emails
        const studentIds = studentEmails
          .map(email => emailToUidMap[email])
          .filter(Boolean); // Remove undefined values

        if (!studentIds.length) {
          console.log('No matching users found for the provided emails');
          setLoading(false);
          return;
        }

        // Batch fetch all student questions and code submissions
        const studentQuestionsPromises = studentIds.map(studentId =>
          get(ref(database, `Exam/${testid}/myquestions/${studentId}`))
        );

        const codeSubmissionsPromises = studentIds.map(studentId =>
          get(ref(database, `ExamCode/${testid}/${studentId}`))
        );

        const [studentQuestionsSnapshots, codeSubmissionsSnapshots] = await Promise.all([
          Promise.all(studentQuestionsPromises),
          Promise.all(codeSubmissionsPromises)
        ]);

        console.log(codeSubmissionsSnapshots);

        // Process results for each student
        const studentResults = studentIds.map((studentId, index) => {
          const userData = usersData[studentId] || {};
          const studentQuestions = studentQuestionsSnapshots[index].val() || {};
          const answers = resultsData[studentId] || {};
          const codeSubmissions = codeSubmissionsSnapshots[index].val() || {};
          const marks = marksData[studentId] || {};

          const questionIds = Object.keys(studentQuestions);
          let correctCount = 0;
          const questionDetails = [];

          const totalMarks = Object.values(marks).reduce((acc, mark) => acc + mark, 0) / questionIds.length;

          

          for (const questionId of questionIds) {
            const questionKey = studentQuestions[questionId];
            const questionType = examQuestions[questionKey] || 'mcq';
            console.log(answers);
            const isCorrect = answers[questionKey] === "true";

            if (isCorrect) correctCount++;

            // Handle code data for programming questions
            let codeData = null;
            if (questionType === 'Programming' && codeSubmissions[questionKey]?.cpp) {
              codeData =  codeSubmissions[questionKey].cpp
            }

            console.log(marks);
            questionDetails.push({
              id: questionKey || "No name",
              originalId: questionId,
              correct: isCorrect,
              type: questionType,
              code: codeData,
              mcqanswer: codeSubmissions[questionKey] || null,
              marks: marks[questionKey] || 0,
            });
          }

          // Calculate score
          const score = questionIds.length > 0
            ? Math.round((correctCount / questionIds.length) * 100)
            : 0;

          return {
            studentId: userData.name || studentId,
            mail: userData.email || 'No email',
            uid: studentId,
            correctCount,
            totalQuestions: questionIds.length,
            score,
            questions: questionDetails,
            totalMarks
          };
        });

        console.log('Processed student results:', studentResults);
        setResults(studentResults);
      } catch (error) {
        console.error('Error fetching results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchreultdata();
  }, [testid]);

  // Sorting function
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Enrich results with weightedMarks based on category weightage
  const enrichedResults = React.useMemo(() => {
    return results.map((r) => {
      const acc = {
        mcq: { sum: 0, count: 0 },
        programming: { sum: 0, count: 0 },
        sql: { sum: 0, count: 0 },
        other: { sum: 0, count: 0 },
      };
      (r.questions || []).forEach((q) => {
        const t = normalizeType(q.type);
        const m = Number(q.marks);
        if (!isNaN(m)) {
          acc[t].sum += m;
          acc[t].count += 1;
        }
      });
      const cats = Object.keys(acc);
      let usedWeightSum = 0;
      let weightedSum = 0;
      cats.forEach((k) => {
        if (acc[k].count > 0) {
          const avg = acc[k].sum / acc[k].count;
          const w = Number(weights[k]) || 0;
          usedWeightSum += w;
          weightedSum += avg * w;
        }
      });
      const weightedMarks = usedWeightSum > 0 ? (weightedSum / usedWeightSum) : NaN;
      return { ...r, weightedMarks };
    });
  }, [results, weights]);

  // Sort results based on current sort settings
  const sortedResults = [...enrichedResults].sort((a, b) => {
    let aValue, bValue;

    switch (sortColumn) {
      case 'studentId':
        aValue = a.studentId.toLowerCase();
        bValue = b.studentId.toLowerCase();
        break;
      case 'mail':
        aValue = a.mail.toLowerCase();
        bValue = b.mail.toLowerCase();
        break;
      case 'totalMarks':
        // Use weighted or regular marks based on toggle
        const aScore = useWeightage ? a.weightedMarks : a.totalMarks;
        const bScore = useWeightage ? b.weightedMarks : b.totalMarks;
        aValue = isNaN(aScore) ? -1 : aScore;
        bValue = isNaN(bScore) ? -1 : bScore;
        break;
      case 'correctCount':
        // Sort by percentage of correct answers
        aValue = a.totalQuestions > 0 ? (a.correctCount / a.totalQuestions) : 0;
        bValue = b.totalQuestions > 0 ? (b.correctCount / b.totalQuestions) : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalStudents = results.length;
  const attendedResults = sortedResults.filter(r => {
    const s = useWeightage ? r.weightedMarks : r.totalMarks;
    return !isNaN(s);
  });
  const totalAttended = attendedResults.length;
  const averageScore = totalAttended > 0
    ? attendedResults.reduce((sum, r) => sum + (useWeightage ? r.weightedMarks : r.totalMarks), 0) / totalAttended
    : null;
  const topScore = totalAttended > 0
    ? Math.max(...attendedResults.map(r => (useWeightage ? r.weightedMarks : r.totalMarks)))
    : null;

  const downloadAllResultsPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Title Page
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Test Results Summary', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Test: ${testName || testid}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    pdf.text(`Total Students: ${sortedResults.length}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Summary Table
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Overall Performance Summary', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    const validScores = sortedResults
      .map(r => (useWeightage ? r.weightedMarks : r.totalMarks))
      .filter(v => !isNaN(v));
    const avgScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2) : 'N/A';
    const maxScore = validScores.length > 0 ? Math.max(...validScores).toFixed(2) : 'N/A';
    const minScore = validScores.length > 0 ? Math.min(...validScores).toFixed(2) : 'N/A';

    pdf.text(`Average Score: ${avgScore}%`, margin + 5, yPosition);
    yPosition += 6;
    pdf.text(`Highest Score: ${maxScore}%`, margin + 5, yPosition);
    yPosition += 6;
    pdf.text(`Lowest Score: ${minScore}%`, margin + 5, yPosition);
    yPosition += 6;
    pdf.text(`Students Attended: ${validScores.length} / ${sortedResults.length}`, margin + 5, yPosition);

    // Scoring mode and weights info
    yPosition += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Scoring Mode', margin, yPosition);
    yPosition += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Mode: ${useWeightage ? 'Weighted (category-wise)' : 'Standard (unweighted)'}`, margin + 5, yPosition);
    yPosition += 5;
    if (useWeightage) {
      const weightsLine = `Weights — MCQ: ${Number(weights.mcq)||0}%, Programming: ${Number(weights.programming)||0}%, SQL: ${Number(weights.sql)||0}%, Other: ${Number(weights.other)||0}%`;
      pdf.text(weightsLine, margin + 5, yPosition);
      yPosition += 6;
    }

    // Students table header
    yPosition += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Students', margin, yPosition);
    yPosition += 8;

    // Header row
    pdf.setFillColor(70, 130, 180);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(margin, yPosition - 6, pageWidth - 2 * margin, 8, 'F');
    pdf.setFontSize(9);
    pdf.text('#', margin + 2, yPosition);
    pdf.text('Student Name', margin + 8, yPosition);
    pdf.text('Email', margin + 60, yPosition);
    pdf.text('Score', margin + 120, yPosition);
    pdf.text('Correct', margin + 140, yPosition);
    pdf.text('Total', margin + 165, yPosition);
    pdf.setTextColor(0, 0, 0);
    yPosition += 8;

    // Rows with zebra striping
    sortedResults.forEach((result, index) => {
      if (yPosition + 10 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        // repeat header on new page
        pdf.setFillColor(70, 130, 180);
        pdf.setTextColor(255, 255, 255);
        pdf.rect(margin, yPosition - 6, pageWidth - 2 * margin, 8, 'F');
        pdf.setFontSize(9);
        pdf.text('#', margin + 2, yPosition);
        pdf.text('Student Name', margin + 8, yPosition);
        pdf.text('Email', margin + 60, yPosition);
        pdf.text('Score', margin + 120, yPosition);
        pdf.text('Correct', margin + 140, yPosition);
        pdf.text('Total', margin + 165, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 8;
      }

      if (index % 2 === 1) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 7, 'F');
      }

      pdf.setFontSize(9);
      pdf.text(`${index + 1}`, margin + 2, yPosition);
      const studentName = result.studentId.length > 20 ? result.studentId.substring(0, 20) + '...' : result.studentId;
      pdf.text(studentName, margin + 8, yPosition);
      const email = result.mail.length > 25 ? result.mail.substring(0, 25) + '...' : result.mail;
      pdf.text(email, margin + 60, yPosition);
      const scoreVal = useWeightage ? result.weightedMarks : result.totalMarks;
      const scoreText = isNaN(scoreVal) ? 'N/A' : `${scoreVal.toFixed(1)}%`;
      pdf.text(scoreText, margin + 120, yPosition);
      pdf.text(`${result.correctCount}`, margin + 145, yPosition);
      pdf.text(`${result.totalQuestions}`, margin + 168, yPosition);
      yPosition += 7;
    });

    // Footer on all pages
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i} of ${totalPages} - ${testName || testid}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    pdf.save(`${testName || testid}_all_results.pdf`);
  };

  const downloadDetailedReportPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;
    // Track current tint (RGB) for student pages; null for summary/TOC
    let currentTint = null;
   const tintPalette = [
  [230, 240, 255], // soft blue
  [255, 230, 240], // soft pink
  [240, 255, 230], // soft green
  [225, 235, 255], // bluish tint
  [255, 240, 225], // warm tint
  [225, 255, 240], // cyan tint
  [240, 225, 255], // violet tint
  [255, 225, 235], // rose tint
  [220, 245, 255], // sky blue
  [240, 255, 220], // spring green
  [255, 220, 245], // lilac pink
  [220, 255, 235]  // mint tint
];


    // Page header for each page
    const drawHeader = ( studentName ) => {
      if( studentName === undefined ) {
        studentName = 'Detailed';
      }
      pdf.setFillColor(245, 248, 255);
      pdf.rect(0, 0, pageWidth, 14, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(40, 80, 160);
      pdf.text(`${testName || testid}`, margin, 9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${studentName} Report`, pageWidth - margin, 9, { align: 'right' });
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin, 14, pageWidth - margin, 14);
      yPosition = 18;
      pdf.setTextColor(0, 0, 0);
    };

    const checkNewPage = (required) => {
      if (yPosition + required > pageHeight - margin) {
        pdf.addPage();
        drawHeader();
        if (currentTint) {
          pdf.setFillColor(...currentTint);
          pdf.rect(0, 14, pageWidth, pageHeight - 14, 'F');
        }
        return true;
      }
      return false;
    };

    // Helpers
    const addText = (text, x, y, maxWidth, fontSize = 10) => {
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(String(text ?? ''), maxWidth);
      pdf.text(lines, x, y);
      return lines.length * (fontSize * 0.35);
    };

    const convertOptionKey = (key) => {
      const numKey = parseInt(key);
      return isNaN(numKey) ? key : (numKey + 1).toString();
    };

    setIsGeneratingReport(true);
    setGenProgress(0);
    setGenStatus('Preparing report...');

    try {
      drawHeader();
      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('AlgoCore Test Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Test: ${testName || testid}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
      pdf.setFontSize(9);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 12;

      // TOC header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('Students Summary (Click name to jump to details)', margin, yPosition);
      yPosition += 8;

      // TOC table header
      pdf.setFillColor(70, 130, 180);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(margin, yPosition - 6, pageWidth - 2 * margin, 8, 'F');
      pdf.setFontSize(9);
      pdf.text('#', margin + 2, yPosition);
      pdf.text('Student Name', margin + 8, yPosition);
      pdf.text('Email', margin + 60, yPosition);
      pdf.text('Score', margin + 120, yPosition);
      pdf.text('Correct', margin + 140, yPosition);
      pdf.text('Total', margin + 165, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;

      const tocEntries = [];

      sortedResults.forEach((result, index) => {
        if (checkNewPage(8)) {
          // Redraw header on new TOC page
          pdf.setFillColor(70, 130, 180);
          pdf.setTextColor(255, 255, 255);
          pdf.rect(margin, yPosition - 6, pageWidth - 2 * margin, 8, 'F');
          pdf.setFontSize(9);
          pdf.text('#', margin + 2, yPosition);
          pdf.text('Student Name', margin + 8, yPosition);
          pdf.text('Email', margin + 60, yPosition);
          pdf.text('Score', margin + 120, yPosition);
          pdf.text('Correct', margin + 140, yPosition);
          pdf.text('Total', margin + 165, yPosition);
          pdf.setTextColor(0, 0, 0);
          yPosition += 8;
        }

        const currentTocPage = pdf.internal.getNumberOfPages();

        // zebra row background
        if (index % 2 === 1) { pdf.setFillColor(245, 245, 245); pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 7, 'F'); }
        const studentName = result.studentId.length > 20 ? result.studentId.substring(0, 20) + '...' : result.studentId;
        pdf.text(`${index + 1}`, margin + 2, yPosition);
        pdf.text(studentName, margin + 8, yPosition);
        const nameWidth = pdf.getTextWidth(studentName);
        const email = result.mail.length > 25 ? result.mail.substring(0, 25) + '...' : result.mail;
        pdf.text(email, margin + 60, yPosition);
        const scoreVal = useWeightage ? result.weightedMarks : result.totalMarks;
        const scoreText = isNaN(scoreVal) ? 'N/A' : `${scoreVal.toFixed(1)}%`;
        pdf.text(scoreText, margin + 120, yPosition);
        pdf.text(`${result.correctCount}`, margin + 145, yPosition);
        pdf.text(`${result.totalQuestions}`, margin + 168, yPosition);

        tocEntries.push({
          page: currentTocPage,
          x: margin + 8,
          y: yPosition,
          w: nameWidth,
          uid: result.uid,
        });

        yPosition += 7;
      });

      // Students detailed sections
      const pageForStudent = {};
      const total = sortedResults.length;
      for (let i = 0; i < sortedResults.length; i++) {
        const r = sortedResults[i];
        pdf.addPage();
        const studentPageNumber = pdf.internal.getNumberOfPages();
        pageForStudent[r.uid] = studentPageNumber;
        // Assign unique very light background tint for this student
        currentTint = tintPalette[i % tintPalette.length];
        const studentName = r.studentId ;

        drawHeader(studentName);
        pdf.setFillColor(...currentTint);
        pdf.rect(0, 14, pageWidth, pageHeight - 14, 'F');
        // Back to Summary link
        pdf.setFontSize(8);
        pdf.setTextColor(60, 90, 160);
        pdf.text('Back to Summary', pageWidth - margin, yPosition, { align: 'right' });
        pdf.link(pageWidth - margin - 35, yPosition - 4, 35, 6, { pageNumber: 1, top: 18 });
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(`Student: ${r.studentId}`, margin, yPosition);
        yPosition += 7;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(`Email: ${r.mail}`, margin, yPosition);
        yPosition += 5;
        pdf.text(`Student ID: ${r.uid.substring(0, 10)}...`, margin, yPosition);
        yPosition += 5;
        const sc = useWeightage ? r.weightedMarks : r.totalMarks;
        pdf.text(`Score: ${isNaN(sc) ? 'Not Attended' : sc.toFixed(2) + '%'}`, margin, yPosition);
        yPosition += 8;

        // Performance summary card
        const w = pageWidth - 2 * margin;
        const colW = w / 3;
        const accPct = r.totalQuestions > 0 ? Math.round((r.correctCount / r.totalQuestions) * 100) : 0;
        pdf.setFillColor(250, 250, 250);
        pdf.setDrawColor(230, 230, 230);
        pdf.rect(margin, yPosition - 4, w, 22, 'F');
        pdf.rect(margin, yPosition - 4, w, 22, 'S');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('Score', margin + 4, yPosition);
        pdf.text('Correct', margin + 4 + colW, yPosition);
        pdf.text('Accuracy', margin + 4 + 2 * colW, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.text(isNaN(sc) ? 'N/A' : `${sc.toFixed(1)}%`, margin + 4, yPosition + 12);
        pdf.text(`${r.correctCount} / ${r.totalQuestions}`, margin + 4 + colW, yPosition + 12);
        pdf.text(`${accPct}%`, margin + 4 + 2 * colW, yPosition + 12);
        yPosition += 24;

        // Category breakdown
        const cats = ['mcq', 'programming', 'sql', 'other'];
        const catStats = { mcq: { att: 0, cor: 0, sum: 0 }, programming: { att: 0, cor: 0, sum: 0 }, sql: { att: 0, cor: 0, sum: 0 }, other: { att: 0, cor: 0, sum: 0 } };
        (r.questions || []).forEach(qi2 => { const t = normalizeType(qi2.type); catStats[t].att++; if (qi2.correct) catStats[t].cor++; const m = Number(qi2.marks); if (!isNaN(m)) catStats[t].sum += m; });
        const presentCats = cats.filter(c => catStats[c].att > 0);
        if (presentCats.length) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.text('Category Breakdown', margin, yPosition);
          yPosition += 6;

          pdf.setFillColor(70, 130, 180);
          pdf.setTextColor(255, 255, 255);
          pdf.rect(margin, yPosition - 5, w, 7, 'F');
          pdf.setFontSize(9);
          pdf.text('Category', margin + 2, yPosition);
          pdf.text('Attempted', margin + 52, yPosition);
          pdf.text('Correct', margin + 88, yPosition);
          pdf.text('Avg Mark', margin + 118, yPosition);
          if (useWeightage) pdf.text('Weight', margin + 150, yPosition);
          pdf.setTextColor(0, 0, 0);
          yPosition += 8;

          presentCats.forEach((c, idx) => {
            if (yPosition + 8 > pageHeight - margin) { 
              pdf.addPage(); 
              drawHeader() ; 
              if (currentTint) { pdf.setFillColor(...currentTint); pdf.rect(0, 14, pageWidth, pageHeight - 14, 'F'); }
            }
            if (idx % 2 === 1) { pdf.setFillColor(245, 245, 245); pdf.rect(margin, yPosition - 5, w, 7, 'F'); }
            const avg = catStats[c].att ? (catStats[c].sum / catStats[c].att).toFixed(1) : '0.0';
            const label = c.charAt(0).toUpperCase() + c.slice(1);
            pdf.setFontSize(9);
            pdf.text(label, margin + 2, yPosition);
            pdf.text(String(catStats[c].att), margin + 60, yPosition, { align: 'right' });
            pdf.text(String(catStats[c].cor), margin + 96, yPosition, { align: 'right' });
            pdf.text(String(avg), margin + 130, yPosition, { align: 'right' });
            if (useWeightage) pdf.text(`${Number(weights[c]) || 0}%`, margin + 180, yPosition, { align: 'right' });
            yPosition += 7;
          });

          yPosition += 4;
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Question Details', margin, yPosition);
        yPosition += 6;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        for (let qi = 0; qi < (r.questions || []).length; qi++) {
          const q = r.questions[qi];

          // Fetch question details and student's answer
          let qData = {};
          let studentAnswer = null; // value from ExamSubmissions (true/false or null)
          let studentAnswerIndex = null; // numeric 0-based from ExamCode or q.mcqanswer
          try {
            const [qSnap, ansSnap, codeSnap] = await Promise.all([
              get(ref(database, `questions/${q.id}`)),
              get(ref(database, `ExamSubmissions/${testid}/${r.uid}/${q.id}`)),
              get(ref(database, `ExamCode/${testid}/${r.uid}/${q.id}`))
            ]);
            qData = qSnap.val() || {};
            studentAnswer = ansSnap.val();
            const codeVal = codeSnap.exists() ? codeSnap.val() : null;
            if (typeof q.mcqanswer === 'number') {
              studentAnswerIndex = q.mcqanswer;
            } else if (typeof codeVal === 'number') {
              studentAnswerIndex = codeVal;
            } else {
              studentAnswerIndex = null;
            }
          } catch (e) {
            console.error('Error fetching q/a for', q.id, e);
          }

          checkNewPage(16);
          const status = (studentAnswer === null || studentAnswer === undefined) ? 'Not Attended' : (q.correct ? 'Correct' : 'Wrong');
          const statusColor = status === 'Correct' ? [0,128,0] : status === 'Wrong' ? [255,0,0] : [150,150,150];
          const type = String(q.type || '').toUpperCase();

          // Header row
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Question ${qi + 1} [${type}] - ${(Number(q.marks)||0).toFixed(2)} pts`, margin + 2, yPosition);
          
          // Status badge
          pdf.setTextColor(...statusColor);
          pdf.text(status, pageWidth - margin - 25, yPosition);
          pdf.setTextColor(0,0,0);
          
          yPosition += 8;

          // Question text
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          const qTitle = qData.questionname || q.id;
          const titleH = addText(qTitle, margin + 2, yPosition, pageWidth - 2 * margin - 4, 10);
          yPosition += titleH + 3;

          // Question description
          if (qData.question) {
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            const descH = addText(qData.question , margin + 2, yPosition, pageWidth - 2 * margin - 4, 9);
            yPosition += descH + 3;
            pdf.setFont('helvetica', 'normal');
          }

          // MCQ-like questions
          if (q.type !== 'Programming' && qData.options) {
            checkNewPage(8);
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.text('Options:', margin + 2, yPosition);
            yPosition += 5;
            
            pdf.setFont('helvetica', 'normal');
            const entries = Object.entries(qData.options);
            for (const [optKey, optValue] of entries) {
              checkNewPage(7);
              
              const isCorrectAnswer = optKey === qData.correctAnswer;
              const isStudentAnswer = studentAnswerIndex !== null
                ? String(optKey) === String(studentAnswerIndex)
                : String(optKey) === String(studentAnswer);
              
              // Highlight boxes
              if (isCorrectAnswer) {
                pdf.setFillColor(200, 255, 200);
                pdf.rect(margin + 4, yPosition - 4, pageWidth - 2 * margin - 8, 6, 'F');
              } else if (isStudentAnswer && !isCorrectAnswer) {
                pdf.setFillColor(255, 200, 200);
                pdf.rect(margin + 4, yPosition - 4, pageWidth - 2 * margin - 8, 6, 'F');
              }
              
              const optLabel = `${convertOptionKey(optKey)}. ${optValue}`;
              const textH = addText(optLabel, margin + 6, yPosition, pageWidth - 2 * margin - 12, 9);
              
              // Add badges
              let badgeX = margin + 8 + pdf.getTextWidth(optLabel);
              if (isCorrectAnswer) {
                pdf.setTextColor(0, 128, 0);
                pdf.setFont('helvetica', 'bold');
                pdf.text(' [CORRECT]', badgeX, yPosition);
              }
              if (isStudentAnswer) {
                pdf.setTextColor(0, 0, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.text(' [SELECTED]', badgeX + (isCorrectAnswer ? 25 : 0), yPosition);
              }
              pdf.setTextColor(0, 0, 0);
              
              yPosition += textH + 2;
            }

            // Student answer and correct answer
            yPosition += 2;
            pdf.setFont('helvetica', 'bold');
            if (studentAnswer === null || studentAnswer === undefined) {
              pdf.setTextColor(150, 150, 150);
              pdf.text(`Student's Answer: Not Attended`, margin + 2, yPosition);
            } else {
              const stIdx = studentAnswerIndex !== null ? studentAnswerIndex : null;
              if (stIdx !== null) {
                const stLabel = convertOptionKey(String(stIdx));
                pdf.text(`Student's Answer: Option ${stLabel}`, margin + 2, yPosition);
              } else {
                // Fallback: we only know correct/wrong
                const infer = studentAnswer === 'true' ? 'Correct' : (studentAnswer === 'false' ? 'Wrong' : 'Unknown');
                pdf.text(`Student's Answer: ${infer}`, margin + 2, yPosition);
              }
            }
            pdf.setTextColor(0, 0, 0);
            yPosition += 5;
            pdf.text(`Correct Answer: Option ${qData.correctAnswer}`, margin + 2, yPosition);
            yPosition += 7;
          }

          // Programming code snippet
          if (q.type === 'Programming' && q.code) {
            checkNewPage(10);

            yPosition += 14;

            
            pdf.setFont('helvetica', 'bold');
            pdf.text('Code Submission:', margin + 2, yPosition);
            yPosition += 6;
            
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(7);
            const codeLines = String(q.code).split('\n');
            for (let li = 0; li < Math.min(codeLines.length, 60); li++) {
              checkNewPage(5);
              
              const line = codeLines[li];
              const truncated = line.length > 95 ? line.substring(0, 95) + '...' : line;
              // Background for code line
              pdf.setFillColor(240, 240, 240);
              pdf.rect(margin + 2, yPosition - 3, pageWidth - 2 * margin - 4, 4.5, 'F');
              pdf.setTextColor(20, 20, 20);
              pdf.text(truncated, margin + 4, yPosition);
              pdf.setTextColor(0, 0, 0);
              yPosition += 3.5;
            }
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            yPosition += 2;
          }

          // Test cases
          if (qData.testcases) {

           
            checkNewPage(10);
            
            pdf.setFont('helvetica', 'bold');
            pdf.text('Test Cases:', margin + 2, yPosition);
            yPosition += 6;
            
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            const testCases = qData.testcases;
            for (let tcIndex = 0; tcIndex < testCases.length; tcIndex++) {
              const testCase = testCases[tcIndex];
              checkNewPage(10);


               const testcaseresult = ExamcodeSubmissions?.[r.uid]?.[q.id] || {};

            // Find the highest mark object
            const highest = Object.entries(testcaseresult).reduce((max, [key, value]) => {
              return !max || value.marks > max[1].marks ? [key, value] : max;
            }, null);


              console.log('highest test case result', highest);
              
              // Test case header with status
              const testCaseStatus = highest && highest[1]?.testResults?.[tcIndex]?.passed 
                ? (highest[1].testResults[tcIndex].passed === true ? 'PASSED' : 'FAILED') 
                : 'NOT RUN';


              const statusColor = testCaseStatus === 'PASSED' 
                ? [0, 128, 0] 
                : testCaseStatus === 'FAILED' 
                  ? [255, 0, 0] 
                  : [150, 150, 150];
              
              pdf.setFillColor(240, 240, 240);
              pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 8, 'F');
              
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'bold');
              pdf.text(`Test Case ${tcIndex + 1}`, margin + 2, yPosition);
              
              pdf.setTextColor(...statusColor);
              pdf.text(testCaseStatus, pageWidth - margin - 20, yPosition);
              pdf.setTextColor(0, 0, 0);
              
              yPosition += 8;
              
              // Input
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(8);
              pdf.text('Input:', margin + 4, yPosition);
              yPosition += 4;
              
              pdf.setFont('courier', 'normal');
              pdf.setFontSize(7);
              const inputText = testCase.input || 'No input';
              const inputLines = pdf.splitTextToSize(inputText, pageWidth - 2 * margin - 8);
              pdf.text(inputLines, margin + 6, yPosition);
              yPosition += inputLines.length * 3.5 + 2;
              
              // Expected Output
              checkNewPage(15);
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(8);
              pdf.setTextColor(0, 128, 0);
              pdf.text('Expected Output:', margin + 4, yPosition);
              yPosition += 4;
              
              pdf.setFont('courier', 'normal');
              pdf.setFontSize(7);
              pdf.setTextColor(0, 0, 0);
              const expectedText = testCase.expectedOutput || 'No expected output';
              const expectedLines = pdf.splitTextToSize(expectedText, pageWidth - 2 * margin - 8);
              pdf.text(expectedLines, margin + 6, yPosition);
              yPosition += expectedLines.length * 3.5 + 2;
              
              // Actual Output (if available)
              if (qData.codeSubmission && testCaseStatus === 'FAILED') {
                checkNewPage(15);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(8);
                pdf.setTextColor(255, 0, 0);
                pdf.text('Actual Output:', margin + 4, yPosition);
                yPosition += 4;
                
                pdf.setFont('courier', 'normal');
                pdf.setFontSize(7);
                pdf.setTextColor(0, 0, 0);
                const actualText = 'Code execution output would be shown here'; // In real implementation, you'd need to store/re-run test results
                const actualLines = pdf.splitTextToSize(actualText, pageWidth - 2 * margin - 8);
                pdf.text(actualLines, margin + 6, yPosition);
                yPosition += actualLines.length * 3.5 + 4;
              }
              
              yPosition += 3; // Space between test cases
            }
          } else {
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            pdf.setTextColor(150, 150, 150);
            pdf.text('No test cases available', margin + 4, yPosition);
            pdf.setTextColor(0, 0, 0);
            yPosition += 7;
          }

          yPosition += 5; // Extra space after test cases


          // Explanation if exists
          if (qData.explanation) {
            checkNewPage(15);
            pdf.setFillColor(230, 240, 255);
            const explStartY = yPosition - 3;
            
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text('Explanation:', margin + 2, yPosition);
            yPosition += 5;
            
            pdf.setFont('helvetica', 'normal');
            const explHeight = addText(qData.explanation, margin + 2, yPosition, pageWidth - 2 * margin - 4, 8);
            
            // Draw explanation box
            pdf.rect(margin, explStartY, pageWidth - 2 * margin, explHeight + 8, 'S');
            yPosition += explHeight + 5;
          }

          yPosition += 5; // Space between questions
        }
        

        setGenProgress(Math.round(((i + 1) / total) * 100));
        setGenStatus(`Processed ${i + 1} of ${total} students`);
        if (i % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Backfill TOC links to student pages
      tocEntries.forEach((e) => {
        const target = pageForStudent[e.uid];
        if (!target) return;
        pdf.setPage(e.page);
        pdf.link(e.x, e.y - 4, e.w, 6, { pageNumber: target, top: margin });
      });

      // Footer
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Page ${i} of ${totalPages} - ${testName || testid}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      pdf.save(`${testName || testid}_detailed_all_students.pdf`);
    } catch (err) {
      console.error('Error generating detailed report:', err);
    } finally {
      setIsGeneratingReport(false);
      setGenProgress(0);
      setGenStatus('');
    }
  };

  const downloadStudentPDF = async (result) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;
    // Fetch all question details for this student
    const questionDetailsMap = {};
    
    try {
      for (const q of result.questions) {
        try {
          // Fetch question details from database
          const questionDetailsRef = ref(database, `questions/${q.id}`);
          const questionDetailsSnapshot = await get(questionDetailsRef);
          const questionData = questionDetailsSnapshot.val() || {};

          // Fetch student's answer for MCQ
          const submissionRef = ref(database, `ExamSubmissions/${testid}/${result.uid}/${q.id}`);
          const submissionSnapshot = await get(submissionRef);
          const studentAnswer = submissionSnapshot.val();

          // Fetch code for programming questions
          let codeSubmission = null;
          if (q.type === 'Programming') {
            const codeRef = ref(database, `ExamCode/${testid}/${result.uid}/${q.id}/cpp`);
            console.log(`Attempting to fetch code from: ExamCode/${testid}/${result.uid}/${q.id}/cpp`);
            const codeSnapshot = await get(codeRef);

            if (codeSnapshot.exists()) {
              const codeValue = codeSnapshot.val();
              console.log('Found code with UID:', codeValue);
              codeSubmission = {
                code: codeValue,
                language: 'cpp'
              };
            }
          }

          console.log(codeSubmission);

          // Format the question data for display
          const questionDetails = {
            id: q.id,
            type: q.type,
            question: questionData.questionname || 'No question text available',
            description: questionData.question || '',
            options: questionData.options || {},
            correctAnswer: questionData.correctAnswer,
            explanation: questionData.explanation || '',
            difficulty: questionData.difficulty || 'Not specified',
            isCorrect: q.correct,
            // Include any additional fields from your question data structure
            ...questionData
          };

          questionDetailsMap[q.id] = questionDetails;
        } catch (error) {
          console.error(`Error fetching details for question ${q.id}:`, error);
          questionDetailsMap[q.id] = {
            questionname: q.id,
            studentAnswer: null,
            isCorrect: q.correct,
            marks: q.marks,
            type: q.type
          };
        }
      }
    } catch (error) {
      console.error('Error fetching question details:', error);
    }

    // Helper function to check if we need a new page
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to add text with word wrap
    const addText = (text, x, y, maxWidth, fontSize = 10) => {
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return lines.length * (fontSize * 0.35); // Return height used
    };

    // Convert option key (0,1,2,3) to display format (1,2,3,4)
    const convertOptionKey = (key) => {
      const numKey = parseInt(key);
      return isNaN(numKey) ? key : (numKey + 1).toString();
    };

    // Title
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Student Performance Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Test Name
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Test: ${testName || testid}`, margin, yPosition);
    yPosition += 8;

    // Horizontal line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Student Information
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Student Information', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Name: ${result.studentId}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Email: ${result.mail}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Student ID: ${result.uid.substring(0, 10)}...`, margin, yPosition);
    yPosition += 10;

    // Performance Summary
    checkNewPage(40);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Performance Summary', margin, yPosition);
    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Score: ${isNaN(result.totalMarks) ? 'Not Attended' : result.totalMarks.toFixed(2) + '%'}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Questions Attempted: ${result.totalQuestions}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Correct Answers: ${result.correctCount}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Incorrect Answers: ${result.totalQuestions - result.correctCount}`, margin, yPosition);
    yPosition += 6;
    pdf.text(`Accuracy: ${result.totalQuestions > 0 ? Math.round((result.correctCount / result.totalQuestions) * 100) : 0}%`, margin, yPosition);
    yPosition += 12;

    // Detailed Question-wise Analysis
    checkNewPage(40);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detailed Question Analysis', margin, yPosition);
    yPosition += 10;

    // Iterate through each question
    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i];
      const qDetails = questionDetailsMap[q.id] || {};
      
      checkNewPage(40);

      // Question header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, 'F');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Question ${i + 1}`, margin + 2, yPosition);
      
      // Status badge
      if (qDetails.studentAnswer === null || qDetails.studentAnswer === undefined) {
        pdf.setTextColor(150, 150, 150);
        pdf.text('Not Attended', pageWidth - margin - 30, yPosition);
      } else if (q.correct) {
        pdf.setTextColor(0, 128, 0);
        pdf.text(`Correct (+${q.marks.toFixed(2)})`, pageWidth - margin - 35, yPosition);
      } else {
        pdf.setTextColor(255, 0, 0);
        pdf.text(`Wrong (${q.marks.toFixed(2)})`, pageWidth - margin - 30, yPosition);
      }
      pdf.setTextColor(0, 0, 0);
      
      yPosition += 10;

      // Question text
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const qTitle = qDetails.questionname || 'No question text available';
      const titleH = addText(qTitle, margin + 2, yPosition, pageWidth - 2 * margin - 4, 10);
      yPosition += titleH + 3;

      // Question description
      if (qDetails.description) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        const descH = addText(qDetails.description, margin + 2, yPosition, pageWidth - 2 * margin - 4, 9);
        yPosition += descH + 3;
        pdf.setFont('helvetica', 'normal');
      }

      // For MCQ questions
      if (q.type !== 'Programming' && qDetails.options) {
        checkNewPage(30);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text('Options:', margin + 2, yPosition);
        yPosition += 5;
        
        pdf.setFont('helvetica', 'normal');
        const entries = Object.entries(qDetails.options);
        for (const [optKey, optValue] of entries) {
          checkNewPage(8);
          
          const isCorrectAnswer = optKey === qDetails.correctAnswer;
          const isStudentAnswer = optKey === qDetails.studentAnswer;
          
          // Highlight boxes
          if (isCorrectAnswer) {
            pdf.setFillColor(200, 255, 200); // Light green for correct
            pdf.rect(margin + 4, yPosition - 4, pageWidth - 2 * margin - 8, 6, 'F');
          } else if (isStudentAnswer && !isCorrectAnswer) {
            pdf.setFillColor(255, 200, 200); // Light red for wrong selection
            pdf.rect(margin + 4, yPosition - 4, pageWidth - 2 * margin - 8, 6, 'F');
          }

          // Option text with converted key
          pdf.setFont('helvetica', 'normal');
          const optionText = `${convertOptionKey(optKey)}. ${optValue}`;
          const optHeight = addText(optionText, margin + 6, yPosition, pageWidth - 2 * margin - 12, 9);
          
          // Add badges
          let badgeX = margin + 8 + pdf.getTextWidth(optionText);
          if (isCorrectAnswer) {
            pdf.setTextColor(0, 128, 0);
            pdf.setFont('helvetica', 'bold');
            pdf.text(' [CORRECT]', badgeX, yPosition);
          }
          if (isStudentAnswer) {
            pdf.setTextColor(0, 0, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.text(' [SELECTED]', badgeX + (isCorrectAnswer ? 25 : 0), yPosition);
          }
          pdf.setTextColor(0, 0, 0);
          
          yPosition += optHeight + 2;
        }

        // Student answer and correct answer
        yPosition += 2;
        pdf.setFont('helvetica', 'bold');
        if (qDetails.studentAnswer === null || qDetails.studentAnswer === undefined) {
          pdf.setTextColor(150, 150, 150);
          pdf.text(`Student's Answer: Not Attended`, margin + 2, yPosition);
        } else {
          const stIdx = qDetails.studentAnswer !== null ? qDetails.studentAnswer : null;
          if (stIdx !== null) {
            const stLabel = convertOptionKey(String(stIdx));
            pdf.text(`Student's Answer: Option ${stLabel}`, margin + 2, yPosition);
          } else {
            // Fallback: we only know correct/wrong
            const infer = qDetails.studentAnswer === 'true' ? 'Correct' : (qDetails.studentAnswer === 'false' ? 'Wrong' : 'Unknown');
            pdf.text(`Student's Answer: ${infer}`, margin + 2, yPosition);
          }
        }
        pdf.setTextColor(0, 0, 0);
        yPosition += 5;
        pdf.text(`Correct Answer: Option ${qDetails.correctAnswer}`, margin + 2, yPosition);
        yPosition += 7;
      }

      // For Programming questions - SHOW ALL CODE WITHOUT OMISSION
      if (q.type === 'Programming') {
        checkNewPage(30);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('Code Submission:', margin + 2, yPosition);
        yPosition += 6;

        const codeToDisplay = qDetails.code;

        if (codeToDisplay) {
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(7);
          
          // Split code into lines and display ALL of them with background
          const codeLines = codeToDisplay.split('\n');
          
          for (const line of codeLines) {
            // Check if we need a new page before adding each line
            if (checkNewPage(5)) {
              pdf.setFont('courier', 'normal');
              pdf.setFontSize(7);
            }
            
            // Truncate only extremely long lines to fit the page width
            const truncatedLine = line.length > 95 ? line.substring(0, 95) + '...' : line;
            // Light background behind code line
            pdf.setFillColor(240, 240, 240);
            pdf.rect(margin + 2, yPosition - 3, pageWidth - 2 * margin - 4, 4.5, 'F');
            pdf.setTextColor(20, 20, 20);
            pdf.text(truncatedLine, margin + 4, yPosition);
            pdf.setTextColor(0, 0, 0);
            yPosition += 3.5;
          }
          
          yPosition += 5;
        } else {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(9);
          pdf.setTextColor(150, 150, 150);
          pdf.text('No code submitted', margin + 4, yPosition);
          pdf.setTextColor(0, 0, 0);
          yPosition += 7;
        }
      }

      // Test cases
      if (qDetails.testCases) {
        checkNewPage(30);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('Test Cases:', margin + 2, yPosition);
        yPosition += 6;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const testCases = qDetails.testCases;
        for (let tcIndex = 0; tcIndex < testCases.length; tcIndex++) {
          const testCase = testCases[tcIndex];
          checkNewPage(10);
          
          // Test case header with status
          const testCaseStatus = q.correct ? 'PASSED' : 'FAILED'; // Simplified - in real implementation, you'd need individual test case results
          const statusColor = q.correct ? [0, 128, 0] : [255, 0, 0];
          
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 8, 'F');
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Test Case ${tcIndex + 1}`, margin + 2, yPosition);
          
          pdf.setTextColor(...statusColor);
          pdf.text(testCaseStatus, pageWidth - margin - 20, yPosition);
          pdf.setTextColor(0, 0, 0);
          
          yPosition += 8;
          
          // Input
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text('Input:', margin + 4, yPosition);
          yPosition += 4;
          
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(7);
          const inputText = testCase.input || 'No input';
          const inputLines = pdf.splitTextToSize(inputText, pageWidth - 2 * margin - 8);
          pdf.text(inputLines, margin + 6, yPosition);
          yPosition += inputLines.length * 3.5 + 2;
          
          // Expected Output
          checkNewPage(15);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(0, 128, 0);
          pdf.text('Expected Output:', margin + 4, yPosition);
          yPosition += 4;
          
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(7);
          pdf.setTextColor(0, 0, 0);
          const expectedText = testCase.expectedOutput || 'No expected output';
          const expectedLines = pdf.splitTextToSize(expectedText, pageWidth - 2 * margin - 8);
          pdf.text(expectedLines, margin + 6, yPosition);
          yPosition += expectedLines.length * 3.5 + 2;
          
          // Actual Output (if available)
          if (qDetails.codeSubmission && testCaseStatus === 'FAILED') {
            checkNewPage(15);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.setTextColor(255, 0, 0);
            pdf.text('Actual Output:', margin + 4, yPosition);
            yPosition += 4;
            
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(7);
            pdf.setTextColor(0, 0, 0);
            const actualText = 'Code execution output would be shown here'; // In real implementation, you'd need to store/re-run test results
            const actualLines = pdf.splitTextToSize(actualText, pageWidth - 2 * margin - 8);
            pdf.text(actualLines, margin + 6, yPosition);
            yPosition += actualLines.length * 3.5 + 4;
          }
          
          yPosition += 3; // Space between test cases
        }
      } else {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text('No test cases available', margin + 4, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 7;
      }

      yPosition += 5; // Extra space after test cases


      // Explanation if exists
      if (qDetails.explanation) {
        checkNewPage(15);
        pdf.setFillColor(230, 240, 255);
        const explStartY = yPosition - 3;
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('Explanation:', margin + 2, yPosition);
        yPosition += 5;
        
        pdf.setFont('helvetica', 'normal');
        const explHeight = addText(qDetails.explanation, margin + 2, yPosition, pageWidth - 2 * margin - 4, 8);
        
        // Draw explanation box
        pdf.rect(margin, explStartY, pageWidth - 2 * margin, explHeight + 8, 'S');
        yPosition += explHeight + 5;
      }

      yPosition += 5; // Space between questions
    }
    

    // Footer
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    pdf.save(`${result.studentId}_${testName || testid}_detailed_report.pdf`);
  };

  const fetchQuestionDetails = async (questionId, studentId, studentuid, isCorrect, questionType = 'mcq', originalId = null, codeData = null) => {
    // Use originalId if available (for programming questions)
    const effectiveQuestionId = originalId || questionId;

    console.log('Fetching question details:', {
      questionId,
      studentId,
      studentuid,
      questionType,
      originalId,
      codeData: !!codeData
    });

    if (!questionId || !studentId) return;

    setIsLoadingQuestion(true);

    try {
      // Get full question details from Questions node
      const questionDetailsRef = ref(database, `questions/${questionId}`);
      const questionDetailsSnapshot = await get(questionDetailsRef);
      const questionData = questionDetailsSnapshot.val() || {};

      console.log(questionId);

      // If codeData wasn't passed in and this is a programming question, try to fetch it
      let finalCodeData = codeData;
      if (questionType === 'Programming') {
        try {
          // First try with the student's UID (from the URL)
          const codeRef = ref(database, `ExamCode/${testid}/${studentuid}/${questionId}/cpp`);
          console.log(`Attempting to fetch code from: ExamCode/${testid}/${studentuid}/${questionId}/cpp`);
          const codeSnapshot = await get(codeRef);

          if (codeSnapshot.exists()) {
            const codeValue = codeSnapshot.val();
            console.log('Found code with UID:', codeValue);
            finalCodeData = {
              code: codeValue,
              language: 'cpp'
            };
          } else {
            // Fallback to studentId if UID didn't work
            const fallbackRef = ref(database, `ExamCode/${testid}/${studentId}/${questionId}/cpp`);
            console.log(`Code not found with UID, trying with studentId: ExamCode/${testid}/${studentId}/${questionId}/cpp`);
            const fallbackSnapshot = await get(fallbackRef);

            if (fallbackSnapshot.exists()) {
              const codeValue = fallbackSnapshot.val();
              console.log('Found code with studentId:', codeValue);
              finalCodeData = {
                code: codeValue,
                language: 'cpp'
              };
            }
          }
        } catch (error) {
          console.error('Error fetching code:', error);
        }
      }

      console.log(finalCodeData);

      // Format the question data for display
      const questionDetails = {
        id: questionId,
        type: questionType,
        question: questionData.questionname || 'No question text available',
        description: questionData.question || '',
        options: questionData.options || {},
        correctAnswer: questionData.correctAnswer,
        explanation: questionData.explanation || '',
        difficulty: questionData.difficulty || 'Not specified',
        isCorrect,
        // Include any additional fields from your question data structure
        ...questionData
      };

      setQuestionDetails(questionDetails);
      setUserCode(finalCodeData || null);
      setSelectedQuestion({
        id: questionId,
        studentId,
        type: questionType,
        isCorrect
      });

      console.log(questionDetails);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching question details:', error);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedQuestion(null);
    setQuestionDetails(null);
    setUserCode(null);
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6" ref={pdfRef}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {testName || 'Test Results'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Detailed performance analysis of all students
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-700/40 rounded-lg">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Total Attended
              </p>
              <p className="text-2xl font-semibold text-blue-900 dark:text-blue-100">
                {totalAttended} / {totalStudents}
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-700/40 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                Average Score
              </p>
              <p className="text-2xl font-semibold text-green-900 dark:text-green-100">
                {averageScore !== null ? `${averageScore.toFixed(2)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-700/40 rounded-lg">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                Top Score
              </p>
              <p className="text-2xl font-semibold text-purple-900 dark:text-purple-100">
                {topScore !== null ? `${topScore.toFixed(2)}%` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="mb-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">MCQ (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weights.mcq}
                    onChange={(e) => setWeights((w) => ({ ...w, mcq: Math.max(0, Math.min(100, Number(e.target.value)||0)) }))}
                    className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Programming (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weights.programming}
                    onChange={(e) => setWeights((w) => ({ ...w, programming: Math.max(0, Math.min(100, Number(e.target.value)||0)) }))}
                    className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">SQL (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weights.sql}
                    onChange={(e) => setWeights((w) => ({ ...w, sql: Math.max(0, Math.min(100, Number(e.target.value)||0)) }))}
                    className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Other (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={weights.other}
                    onChange={(e) => setWeights((w) => ({ ...w, other: Math.max(0, Math.min(100, Number(e.target.value)||0)) }))}
                    className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2">
                  <input
                    id="useWeightage"
                    type="checkbox"
                    checked={useWeightage}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setUseWeightage(val);
                      try { await set(ref(database, `Exam/${testid}/configure/useWeightage`), val); } catch (err) { console.error(err); }
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor="useWeightage" className="text-sm text-gray-700 dark:text-gray-200">Use weightage in scores</label>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Total: {['mcq','programming','sql','other'].reduce((s,k)=>s+(Number(weights[k])||0),0)}%
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const present = new Set();
                      enrichedResults.forEach(r => (r.questions||[]).forEach(q => present.add(normalizeType(q.type))));
                      const arr = Array.from(present);
                      const base = arr.length>0 ? Math.floor(100/arr.length) : 25;
                      const equal = { mcq: 0, programming: 0, sql: 0, other: 0 };
                      arr.forEach(t=>{ equal[t]=base; });
                      const rem = 100 - base*arr.length; if (rem>0 && arr[0]) equal[arr[0]] += rem;
                      setWeights(equal);
                    }}
                    className="px-3 py-1.5 rounded-md border text-sm bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200"
                  >
                    Distribute equally
                  </button>
                  <button
                    disabled={savingWeights}
                    onClick={async ()=>{
                      setSavingWeights(true);
                      try {
                        await set(ref(database, `Exam/${testid}/configure/weightage`), weights);
                      } catch (err) {
                        console.error('Failed to save weights', err);
                      } finally {
                        setSavingWeights(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
                  >
                    {savingWeights ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mb-4 gap-2">
            <button
              onClick={downloadDetailedReportPDF}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              Download Detailed Report
            </button>
            <button
              onClick={downloadAllResultsPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              Download All Results
            </button>
          </div>

          <ResultsTable>
            <thead>
              <tr>
                <TableHeader onClick={() => handleSort('studentId')} sortDirection={sortColumn === 'studentId' ? sortDirection : undefined}>
                  Student ID
                </TableHeader>
                <TableHeader onClick={() => handleSort('mail')} sortDirection={sortColumn === 'mail' ? sortDirection : undefined}>
                  Email
                </TableHeader>
                <TableHeader onClick={() => handleSort('totalMarks')} sortDirection={sortColumn === 'totalMarks' ? sortDirection : undefined}>
                  Score
                </TableHeader>
                <TableHeader onClick={() => handleSort('correctCount')} sortDirection={sortColumn === 'correctCount' ? sortDirection : undefined}>
                  Correct
                </TableHeader>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.length > 0 ? (
                sortedResults.map((result, index) => (
                  <React.Fragment key={index}>
                    <TableRow
                      isSelected={selectedRow === index}
                      onClick={() => setSelectedRow(selectedRow === index ? null : index)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {result.studentId.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {result.studentId}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {result.uid.substring(0, 6)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {result.mail}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const score = useWeightage ? result.weightedMarks : result.totalMarks;
                          const badgeClass = isNaN(score)
                            ? 'bg-gray-100 text-gray-800'
                            : score >= 70
                              ? 'bg-green-100 text-green-800'
                              : score >= 50
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800';
                          return (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                              {isNaN(score) ? 'Not Attended' : `${score.toFixed(2)}%`}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900 dark:text-white font-medium">
                          {result.correctCount} / {result.totalQuestions}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadStudentPDF(result);
                          }}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1.5 text-sm"
                          title="Download detailed student report"
                        >
                          <Download size={16} />
                          Download PDF
                        </button>
                      </TableCell>
                    </TableRow>
                    {selectedRow === index && (
                      <TableRow>
                        <TableCell colSpan="5" className="p-6">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Question Details:
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {result.questions.map((q, i) => (
                              <div
                                key={i}
                                onClick={() =>
                                  fetchQuestionDetails(q.id, result.studentId, result.uid, q.correct, q.type, q.originalId, q.code)
                                }
                                className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs hover:shadow-sm transition-shadow cursor-pointer"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium text-gray-900 text-sm">
                                    {q.id || `Question ${i + 1}`}
                                  </h4>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${q.marks > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                      }`}
                                  >
                                    {q.marks || 0} points
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs ${q.correct
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                      }`}
                                  >
                                    {q.correct ? '✓ Correct' : '✗ Wrong'}
                                  </span>
                                  {q.code && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs flex items-center gap-1">
                                      <CodeIcon size={12} />
                                      Code
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No results found for this exam
                  </td>
                </tr>
              )}
            </tbody>
          </ResultsTable>
        </div>
      </div>

      {/* Question Details Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Question Details
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>

            {isLoadingQuestion ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${selectedQuestion?.isCorrect
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                    >
                      {selectedQuestion?.isCorrect ? '✓ Correct Answer' : '✗ Incorrect Answer'}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-medium">
                      {questionDetails?.type || 'MCQ'}
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {questionDetails?.questionname}
                  </h4>
                  {questionDetails?.question && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h4>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap">
                        {questionDetails?.question}
                      </p>
                    </div>
                  )}
                </div>

                {userCode ? (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                      <CodeIcon className="mr-2" size={16} /> Code Submission
                    </h4>
                    <pre className="mt-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                      {userCode}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-500 dark:text-gray-400">
                    No code submission available
                  </div>
                )}
                {questionDetails?.type === 'Programming' && questionDetails?.testCases && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <List size={18} className="text-purple-600" />
                      <h4 className="font-medium text-gray-900 dark:text-white">Test Cases</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Input</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expected Output</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {Object.entries(questionDetails.testCases).map(([key, testCase]) => (
                            <tr key={key}>
                              <td className="px-4 py-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-200">{testCase.input}</td>
                              <td className="px-4 py-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-200">{testCase.expectedOutput}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {questionDetails?.options && Object.keys(questionDetails.options).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Options:</h4>
                    <div className="space-y-2">
                      {Object.entries(questionDetails.options).map(([key, value]) => {
                        const displayKey = parseInt(key);
                        const displayLabel = isNaN(displayKey) ? key : (displayKey + 1).toString();
                        
                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border ${key === questionDetails?.correctAnswer
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                              }`}
                          >
                            <span className="font-medium">{displayLabel}:</span> {value}
                            {key === questionDetails?.correctAnswer && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                (Correct Answer)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {questionDetails.explanation && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Explanation:</h4>
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                      {questionDetails.explanation}
                    </p>
                  </div>
                )}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    <span className="font-medium">Status:</span> {
                      selectedQuestion?.isCorrect
                        ? <span className="text-green-600 dark:text-green-400 ml-1">Answered Correctly</span>
                        : <span className="text-red-600 dark:text-red-400 ml-1">Incorrect Answer</span>
                    }
                  </div>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {isGeneratingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Generating Detailed Report</h3>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${genProgress}%` }} />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{genStatus}</div>
          </div>
        </div>
      )}
    </div>
  );
}
