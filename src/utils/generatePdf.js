// src/utils/generatePdf.js
import jsPDF from "jspdf";
import "jspdf-autotable";

export const generateSubmissionPDF = (submission) => {
  const doc = new jsPDF();
  const timestamp = new Date(submission.timestamp).toLocaleString();

  doc.setFontSize(16);
  doc.text("Submission Report", 14, 20);

  doc.setFontSize(12);
  doc.text(`Problem: ${submission.problem}`, 14, 30);
  doc.text(`Course: ${submission.course}/${submission.subcourse}`, 14, 38);
  doc.text(`Language: ${submission.language}`, 14, 46);
  doc.text(`Status: ${submission.status}`, 14, 54);
  doc.text(`Timestamp: ${timestamp}`, 14, 62);

  doc.text("Code:", 14, 72);

  const splitCode = doc.splitTextToSize(submission.code, 180);
  doc.text(splitCode, 14, 80);

  doc.save(`${submission.problem}_submission.pdf`);
};
