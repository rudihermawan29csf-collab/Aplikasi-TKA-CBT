import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Result, Exam, Question } from '../../types';
import { analyzeResults } from '../../services/geminiService';

interface ItemAnalysis {
    questionNo: number;
    difficulty: 'Mudah' | 'Sedang' | 'Sukar';
    correctCount: number;
    totalAttempts: number;
    distractors: Record<number, number>; // Index of option -> count
}

const Analysis: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<ItemAnalysis[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    // Only show exams that have ended or have results
    const allExams = storage.exams.getAll();
    setExams(allExams);
    if (allExams.length > 0) setSelectedExamId(allExams[0].id);
  }, []);

  useEffect(() => {
      if (!selectedExamId) return;
      const exam = exams.find(e => e.id === selectedExamId);
      if (!exam) return;

      const examQuestions = storage.questions.getByPacketId(exam.packetId);
      const results = storage.results.getAll().filter(r => r.examId === selectedExamId);

      setQuestions(examQuestions);

      // Calculate Item Analysis
      const itemStats: ItemAnalysis[] = examQuestions.map(q => {
          let correct = 0;
          let attempts = 0;
          const dist: Record<number, number> = {};

          results.forEach(r => {
              const answers = JSON.parse(r.answers);
              const studentAns = answers[q.id];
              
              if (studentAns !== undefined) {
                  attempts++;
                  // Count distractors (assuming single choice for simplicity in stats)
                  if (typeof studentAns === 'number') {
                      dist[studentAns] = (dist[studentAns] || 0) + 1;
                  }
                  
                  // Check correctness
                  if (q.type === 'PG' && studentAns === q.correctAnswerIndex) correct++;
                  else if (q.type === 'PGK' && JSON.stringify(studentAns) === q.correctAnswerIndices) correct++; // Simplified check
                  // ... logic for other types
              }
          });

          const ratio = attempts > 0 ? correct / attempts : 0;
          let diff: 'Mudah' | 'Sedang' | 'Sukar' = 'Sedang';
          if (ratio > 0.7) diff = 'Mudah';
          else if (ratio < 0.3) diff = 'Sukar';

          return {
              questionNo: q.number,
              difficulty: diff,
              correctCount: correct,
              totalAttempts: attempts,
              distractors: dist
          };
      });
      
      setAnalysisData(itemStats.sort((a,b) => a.questionNo - b.questionNo));

  }, [selectedExamId]);

  const handleDownloadExcel = () => {
      // Create CSV content
      const headers = ["No Soal,Tingkat Kesukaran,Jml Benar,Jml Peserta,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E"];
      const rows = analysisData.map(item => [
          item.questionNo,
          item.difficulty,
          item.correctCount,
          item.totalAttempts,
          item.distractors[0] || 0,
          item.distractors[1] || 0,
          item.distractors[2] || 0,
          item.distractors[3] || 0,
          item.distractors[4] || 0
      ].join(","));
      
      const csvContent = "data:text/csv;charset=utf-8," + headers.join("\n") + "\n" + rows.join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Analisis_Ujian_${selectedExamId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
      // Use browser print, but we need to hide other elements
      // We do this by adding a temporary style to hide non-print area
      // In a real SPA, window.print() is the most robust way without heavy libraries like jsPDF
      window.print();
  };

  return (
    <div className="space-y-6">
      <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-analysis, #printable-analysis * {
              visibility: visible;
            }
            #printable-analysis {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            button, select {
                display: none !important;
            }
          }
      `}</style>

      <div className="flex justify-between items-center bg-white p-4 rounded shadow no-print">
         <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold">Analisis Hasil Ujian</h2>
             <select 
                className="border p-2 rounded w-64"
                value={selectedExamId}
                onChange={e => setSelectedExamId(e.target.value)}
             >
                 {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
             </select>
         </div>
         <div className="flex gap-2">
             <button onClick={handleDownloadExcel} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold text-sm flex items-center gap-2">
                <span>📄</span> Download Excel (CSV)
             </button>
             <button onClick={handleDownloadPDF} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-bold text-sm flex items-center gap-2">
                <span>🖨️</span> Print PDF
             </button>
         </div>
      </div>

      <div id="printable-analysis" className="bg-white p-6 rounded shadow">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg text-blue-800">Analisis Butir Soal & Daya Beda</h3>
              <p className="text-sm text-gray-500 print:block hidden">{new Date().toLocaleDateString()}</p>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-100 text-gray-700 uppercase">
                      <tr>
                          <th className="p-3 text-center border">No Soal</th>
                          <th className="p-3 text-center border">Tingkat Kesukaran</th>
                          <th className="p-3 text-center border">Jml Benar</th>
                          <th className="p-3 text-center border">Jml Peserta</th>
                          <th className="p-3 text-center border bg-blue-50">Opsi A</th>
                          <th className="p-3 text-center border bg-blue-50">Opsi B</th>
                          <th className="p-3 text-center border bg-blue-50">Opsi C</th>
                          <th className="p-3 text-center border bg-blue-50">Opsi D</th>
                          <th className="p-3 text-center border bg-blue-50">Opsi E</th>
                      </tr>
                  </thead>
                  <tbody>
                      {analysisData.length === 0 ? (
                          <tr><td colSpan={9} className="p-4 text-center">Belum ada data hasil ujian.</td></tr>
                      ) : analysisData.map(item => (
                          <tr key={item.questionNo} className="hover:bg-gray-50">
                              <td className="p-3 text-center border font-bold">{item.questionNo}</td>
                              <td className="p-3 text-center border">
                                  <span className={`px-2 py-1 rounded text-xs font-bold text-white print:text-black print:border print:bg-transparent ${
                                      item.difficulty === 'Mudah' ? 'bg-green-500' : 
                                      item.difficulty === 'Sedang' ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}>
                                      {item.difficulty}
                                  </span>
                              </td>
                              <td className="p-3 text-center border">{item.correctCount}</td>
                              <td className="p-3 text-center border">{item.totalAttempts}</td>
                              <td className="p-3 text-center border text-gray-500">{item.distractors[0] || 0}</td>
                              <td className="p-3 text-center border text-gray-500">{item.distractors[1] || 0}</td>
                              <td className="p-3 text-center border text-gray-500">{item.distractors[2] || 0}</td>
                              <td className="p-3 text-center border text-gray-500">{item.distractors[3] || 0}</td>
                              <td className="p-3 text-center border text-gray-500">{item.distractors[4] || 0}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Analysis;
