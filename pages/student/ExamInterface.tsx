import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../services/storageService';
import { Exam, Question, QuestionType } from '../../types';

interface ExamInterfaceProps {
  examId: string;
  username: string; 
  onFinish: () => void;
}

const ExamInterface: React.FC<ExamInterfaceProps> = ({ examId, username, onFinish }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  
  // Proctoring
  const [violationCount, setViolationCount] = useState(0);
  const [doubtful, setDoubtful] = useState<Set<string>>(new Set());

  useEffect(() => {
    const e = storage.exams.getAll().find(ex => ex.id === examId);
    if (e) {
      setExam(e);
      const qs = storage.questions.getByPacketId(e.packetId);
      setQuestions(qs);
      setTimeLeft(e.durationMinutes * 60);
    }
  }, [examId]);

  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) { clearInterval(timer); handleSubmitExam(true); return 0; }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFinished, exam]);

  const handleAnswer = (val: any) => {
    if (!questions[currentIdx]) return;
    setAnswers({ ...answers, [questions[currentIdx].id]: val });
  };

  const handleSubmitExam = (forced = false) => {
    if (!forced && !window.confirm("Selesaikan ujian?")) return;
        
    let correctCount = 0;
    questions.forEach(q => {
        const studentAns = answers[q.id];
        
        if (q.type === QuestionType.MULTIPLE_CHOICE) {
            if (studentAns === q.correctAnswerIndex) correctCount++;
        } 
        else if (q.type === QuestionType.TRUE_FALSE) {
             // Logic for BS with matchingPairs
             try {
                 const pairs = JSON.parse(q.matchingPairs || '[]'); // [{left: "", right: "a"}]
                 // studentAns should be object { "Statement": "a" } or array matching indices
                 // Our UI stores answer as Array of 'a'/'b' corresponding to rows
                 if (Array.isArray(studentAns) && studentAns.length === pairs.length) {
                     const allCorrect = pairs.every((item: any, idx: number) => item.right === studentAns[idx]);
                     if (allCorrect) correctCount++;
                 }
             } catch(e) {}
        }
        else if (q.type === QuestionType.COMPLEX_MULTIPLE_CHOICE) {
            const correctIndices = JSON.parse(q.correctAnswerIndices || '[]');
            const studentIndices = studentAns || []; 
            if (Array.isArray(studentIndices) && 
                studentIndices.length === correctIndices.length && 
                studentIndices.every((val: number) => correctIndices.includes(val))) {
                correctCount++;
            }
        }
    });
    
    const score = Math.round((correctCount / (questions.length || 1)) * 100);
    setFinalScore(score);

    const allStudents = storage.students.getAll();
    const me = allStudents.find(s => s.name === username);

    storage.results.add({
        id: Date.now().toString(),
        examId: examId,
        examTitle: exam?.title || '',
        studentId: me?.id || 'unknown', 
        studentName: me?.name || username,
        studentClass: me?.class || '',
        score: score,
        literasiScore: 0,
        numerasiScore: 0,
        answers: JSON.stringify(answers),
        timestamp: new Date().toISOString(),
        violationCount: violationCount,
        isDisqualified: forced && violationCount >= 3
    });
    
    setIsFinished(true);
  };

  if (isFinished) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
              <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-2xl font-bold mb-2">Ujian Selesai!</h2>
                  <div className="text-4xl font-bold text-blue-600 my-6">{finalScore}</div>
                  <button onClick={onFinish} className="bg-blue-600 text-white px-6 py-2 rounded w-full">Kembali</button>
              </div>
          </div>
      )
  }

  if (!exam || questions.length === 0) return <div>Loading...</div>;
  const currentQ = questions[currentIdx];

  return (
    <div className="flex flex-col h-screen bg-gray-100">
        <div className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
            <div>
                <h1 className="font-bold">{exam.title}</h1>
                <div className="text-xs text-gray-500">Soal {currentIdx + 1} / {questions.length}</div>
            </div>
            <div className={`font-mono text-xl font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-gray-800'}`}>
                {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto bg-white p-6 rounded shadow-sm min-h-[60vh]">
                {currentQ.stimulus && (
                    <div className="mb-6 bg-gray-50 p-4 rounded border">
                        {(currentQ.stimulus.startsWith('http') || currentQ.stimulus.startsWith('data:')) ? 
                            <img src={currentQ.stimulus} className="max-w-full mx-auto" /> : 
                            <div className="whitespace-pre-wrap text-lg">{currentQ.stimulus}</div>
                        }
                    </div>
                )}
                
                <div className="text-xl font-medium mb-6">{currentQ.text}</div>

                <div className="space-y-3">
                    {currentQ.type === QuestionType.MULTIPLE_CHOICE && JSON.parse(currentQ.options).map((opt: string, idx: number) => (
                        <label key={idx} className={`flex items-center p-4 border rounded cursor-pointer hover:bg-blue-50 ${answers[currentQ.id]===idx ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : ''}`}>
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full border mr-3 font-bold ${answers[currentQ.id]===idx ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{String.fromCharCode(65+idx)}</div>
                            <input type="radio" className="hidden" checked={answers[currentQ.id]===idx} onChange={() => handleAnswer(idx)} />
                            <span>{opt}</span>
                        </label>
                    ))}

                    {currentQ.type === QuestionType.COMPLEX_MULTIPLE_CHOICE && JSON.parse(currentQ.options).map((opt: string, idx: number) => {
                         const curr = answers[currentQ.id] || [];
                         const isChecked = curr.includes(idx);
                         return (
                            <label key={idx} className={`flex items-center p-4 border rounded cursor-pointer hover:bg-blue-50 ${isChecked ? 'bg-blue-50 border-blue-500' : ''}`}>
                                <input type="checkbox" className="mr-3 w-5 h-5" checked={isChecked} onChange={() => {
                                    const next = isChecked ? curr.filter((i:number)=>i!==idx) : [...curr, idx];
                                    handleAnswer(next);
                                }} />
                                <span>{opt}</span>
                            </label>
                         );
                    })}

                    {currentQ.type === QuestionType.TRUE_FALSE && (
                        (() => {
                            try {
                                const opts = JSON.parse(currentQ.options || '["Benar", "Salah"]');
                                const pairs = JSON.parse(currentQ.matchingPairs || '[]');
                                const currentAns = answers[currentQ.id] || new Array(pairs.length).fill(null);

                                return (
                                    <div className="border rounded overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-3 text-left">Pernyataan</th>
                                                    <th className="p-3 w-20 text-center border-l">{opts[0]}</th>
                                                    <th className="p-3 w-20 text-center border-l">{opts[1]}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pairs.map((item: any, idx: number) => (
                                                    <tr key={idx} className="border-t hover:bg-gray-50">
                                                        <td className="p-3">{item.left}</td>
                                                        <td className="p-3 text-center border-l">
                                                            <input type="radio" name={`bs-${currentQ.id}-${idx}`} checked={currentAns[idx] === 'a'} 
                                                                onChange={() => {
                                                                    const n = [...currentAns]; n[idx] = 'a'; handleAnswer(n);
                                                                }} 
                                                            className="w-5 h-5 cursor-pointer accent-blue-600" />
                                                        </td>
                                                        <td className="p-3 text-center border-l">
                                                            <input type="radio" name={`bs-${currentQ.id}-${idx}`} checked={currentAns[idx] === 'b'} 
                                                                onChange={() => {
                                                                    const n = [...currentAns]; n[idx] = 'b'; handleAnswer(n);
                                                                }} 
                                                            className="w-5 h-5 cursor-pointer accent-blue-600" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            } catch(e) { return <div>Format Error</div>}
                        })()
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white border-t p-4 flex justify-between items-center shadow-lg sticky bottom-0">
             <button onClick={() => setCurrentIdx(p => Math.max(0, p - 1))} disabled={currentIdx===0} className="px-6 py-2 border rounded hover:bg-gray-50 disabled:opacity-50">← Sebelumnya</button>
             
             <div className="flex gap-2 overflow-x-auto max-w-[50%] no-scrollbar px-2">
                 {questions.map((q, i) => (
                     <button key={i} onClick={() => setCurrentIdx(i)} 
                         className={`w-8 h-8 flex-shrink-0 rounded text-xs font-bold ${
                             currentIdx===i ? 'bg-blue-600 text-white' : 
                             answers[q.id] ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                         }`}>
                         {i+1}
                     </button>
                 ))}
             </div>

             {currentIdx === questions.length - 1 ? (
                 <button onClick={() => handleSubmitExam(false)} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">Selesai ✓</button>
             ) : (
                 <button onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Selanjutnya →</button>
             )}
        </div>
    </div>
  );
};

export default ExamInterface;