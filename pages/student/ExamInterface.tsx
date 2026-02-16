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
  
  // Proctoring & Doubtful
  const [violationCount, setViolationCount] = useState(0); // For UI
  const violationRef = useRef(0); // For Logic (avoid stale closures)
  const [doubtful, setDoubtful] = useState<Set<string>>(new Set());

  // Helper: Fisher-Yates Shuffle
  const shuffleArray = <T,>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
  };

  useEffect(() => {
    const e = storage.exams.getAll().find(ex => ex.id === examId);
    if (e) {
      setExam(e);
      let rawQs = storage.questions.getByPacketId(e.packetId);
      
      // 1. ACAK URUTAN SOAL
      // Kita clone deep agar tidak merusak urutan asli di storage
      let shuffledQs = shuffleArray(rawQs).map(q => ({...q}));

      // 2. ACAK OPSI JAWABAN (Untuk PG dan PG Kompleks)
      shuffledQs = shuffledQs.map(q => {
          // Hanya acak jika PG atau PG Kompleks
          if (q.type === QuestionType.MULTIPLE_CHOICE) {
              try {
                  const originalOptions = JSON.parse(q.options || '[]');
                  if(originalOptions.length > 0) {
                      // Map opsi dengan index aslinya
                      const optionsWithIndex: { text: string; originalIdx: number }[] = originalOptions.map((opt: string, idx: number) => ({
                          text: opt,
                          originalIdx: idx
                      }));
                      
                      // Acak opsi
                      const shuffledOptions = shuffleArray(optionsWithIndex);
                      
                      // Cari index baru dari jawaban yang benar
                      // Jawaban benar adalah index di mana originalIdx == q.correctAnswerIndex
                      const newCorrectIndex = shuffledOptions.findIndex(item => item.originalIdx === q.correctAnswerIndex);
                      
                      // Update question object
                      return {
                          ...q,
                          options: JSON.stringify(shuffledOptions.map(item => item.text)),
                          correctAnswerIndex: newCorrectIndex
                      };
                  }
              } catch(err) { console.error("Error shuffling PG", err); }
          }
          else if (q.type === QuestionType.COMPLEX_MULTIPLE_CHOICE) {
               try {
                   const originalOptions = JSON.parse(q.options || '[]');
                   const correctIndices = JSON.parse(q.correctAnswerIndices || '[]');
                   
                   if(originalOptions.length > 0) {
                       const optionsWithIndex: { text: string; originalIdx: number }[] = originalOptions.map((opt: string, idx: number) => ({
                           text: opt,
                           originalIdx: idx
                       }));

                       const shuffledOptions = shuffleArray(optionsWithIndex);

                       // Mapping index baru untuk kunci jawaban
                       // Kita cari item yang originalIdx-nya ada di daftar kunci lama, lalu ambil index barunya
                       const newCorrectIndices = shuffledOptions
                           .map((item, newIdx) => correctIndices.includes(item.originalIdx) ? newIdx : -1)
                           .filter((idx): idx is number => idx !== -1);
                       
                       return {
                           ...q,
                           options: JSON.stringify(shuffledOptions.map(item => item.text)),
                           correctAnswerIndices: JSON.stringify(newCorrectIndices)
                       };
                   }
               } catch(err) { console.error("Error shuffling PGK", err); }
          }
          
          return q; // Return as is for Essay, Matching, True/False (usually fixed order)
      });

      setQuestions(shuffledQs);
      setTimeLeft(e.durationMinutes * 60);
    }
  }, [examId]);

  // Timer
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

  // Anti-Cheating Mechanism
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (isFinished) return;

        if (document.hidden) {
            violationRef.current += 1;
            setViolationCount(violationRef.current);
            
            alert(`⚠️ PERINGATAN PELANGGARAN!\n\nAnda terdeteksi meninggalkan halaman ujian atau membuka tab lain.\nPelanggaran ke-${violationRef.current} dari 3.\n\nJika mencapai 3 kali, ujian akan otomatis dihentikan dan Anda didiskualifikasi.`);

            if (violationRef.current >= 3) {
                handleSubmitExam(true); // Forced submission due to cheating
            }
        }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Optional: window.blur can be added but visibilitychange is more reliable for tab switching
    
    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isFinished]); // Re-bind if isFinished changes to stop listening

  const handleAnswer = (val: any) => {
    if (!questions[currentIdx]) return;
    setAnswers({ ...answers, [questions[currentIdx].id]: val });
  };

  const handleToggleDoubtful = () => {
      if (!questions[currentIdx]) return;
      const qId = questions[currentIdx].id;
      const newDoubtful = new Set(doubtful);
      if (newDoubtful.has(qId)) {
          newDoubtful.delete(qId);
      } else {
          newDoubtful.add(qId);
      }
      setDoubtful(newDoubtful);
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
             try {
                 const pairs = JSON.parse(q.matchingPairs || '[]');
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

    // Note: Since we shuffled options, the 'answers' stored are based on the shuffled indices.
    // For advanced analytics later, you might want to store the question text or remap back,
    // but for simple scoring, storing the score is sufficient.
    
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
        violationCount: violationRef.current, // Use Ref to ensure latest value
        isDisqualified: forced && violationRef.current >= 3
    });
    
    setIsFinished(true);
  };

  if (isFinished) {
      const isDisqualified = violationRef.current >= 3;
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
              <div className="bg-white rounded-lg p-8 max-w-md w-full text-center shadow-2xl">
                  <div className="text-6xl mb-4">{isDisqualified ? '⛔' : '🏆'}</div>
                  <h2 className="text-2xl font-bold mb-2">{isDisqualified ? 'Ujian Dihentikan' : 'Ujian Selesai!'}</h2>
                  
                  {isDisqualified ? (
                      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative my-6">
                          <strong className="font-bold">Diskualifikasi!</strong>
                          <span className="block sm:inline"> Anda terdeteksi melakukan kecurangan (Pindah Tab) lebih dari batas toleransi.</span>
                          <div className="mt-2 text-3xl font-bold">Nilai: 0</div>
                      </div>
                  ) : (
                      <div className="text-4xl font-bold text-blue-600 my-6">{finalScore}</div>
                  )}
                  
                  <button onClick={onFinish} className="bg-gray-800 hover:bg-black text-white px-6 py-3 rounded-lg w-full font-bold transition-colors">
                      Kembali ke Dashboard
                  </button>
              </div>
          </div>
      )
  }

  if (!exam || questions.length === 0) return <div>Loading...</div>;
  const currentQ = questions[currentIdx];
  const isCurrentDoubtful = doubtful.has(currentQ.id);

  return (
    <div className="flex flex-col h-screen bg-gray-100 select-none"> {/* Added select-none to discourage copy-paste */}
        <div className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
            <div>
                <h1 className="font-bold text-lg md:text-xl truncate max-w-[200px] md:max-w-md">{exam.title}</h1>
                <div className="text-xs text-gray-500 font-mono">Soal {currentIdx + 1} / {questions.length}</div>
            </div>
            <div className="flex items-center gap-4">
                 {/* Violation Indicator */}
                 {violationCount > 0 && (
                     <div className="hidden md:flex items-center gap-1 bg-red-100 px-3 py-1 rounded-full border border-red-200 animate-pulse">
                         <span className="text-xs font-bold text-red-600">Pelanggaran: {violationCount}/3</span>
                     </div>
                 )}
                <div className={`font-mono text-xl font-bold px-3 py-1 rounded ${timeLeft < 300 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-800'}`}>
                    {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-2xl shadow-sm min-h-[60vh] border border-gray-100">
                {currentQ.stimulus && (
                    <div className="mb-8 bg-gray-50/80 p-6 rounded-xl border border-gray-200">
                        {(currentQ.stimulus.startsWith('http') || currentQ.stimulus.startsWith('data:')) ? 
                            <img src={currentQ.stimulus} className="max-w-full mx-auto rounded-lg shadow-sm" alt="Stimulus" /> : 
                            <div className="whitespace-pre-wrap text-lg leading-relaxed text-gray-800 font-serif">{currentQ.stimulus}</div>
                        }
                    </div>
                )}
                
                <div className="text-xl md:text-2xl font-medium mb-8 text-gray-900 leading-snug">{currentQ.text}</div>

                <div className="space-y-4">
                    {currentQ.type === QuestionType.MULTIPLE_CHOICE && JSON.parse(currentQ.options).map((opt: string, idx: number) => (
                        <label key={idx} className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:border-blue-200 ${answers[currentQ.id]===idx ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'}`}>
                            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full border-2 mr-4 font-bold text-lg transition-colors ${answers[currentQ.id]===idx ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{String.fromCharCode(65+idx)}</div>
                            <input type="radio" className="hidden" checked={answers[currentQ.id]===idx} onChange={() => handleAnswer(idx)} />
                            <span className="text-lg text-gray-700">{opt}</span>
                        </label>
                    ))}

                    {currentQ.type === QuestionType.COMPLEX_MULTIPLE_CHOICE && JSON.parse(currentQ.options).map((opt: string, idx: number) => {
                         const curr = answers[currentQ.id] || [];
                         const isChecked = curr.includes(idx);
                         return (
                            <label key={idx} className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-blue-50 hover:border-blue-200 ${isChecked ? 'bg-blue-50 border-blue-500' : 'border-gray-100'}`}>
                                <div className={`mr-4 flex items-center justify-center w-6 h-6 border-2 rounded transition-colors ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                    {isChecked && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                </div>
                                <input type="checkbox" className="hidden" checked={isChecked} onChange={() => {
                                    const next = isChecked ? curr.filter((i:number)=>i!==idx) : [...curr, idx];
                                    handleAnswer(next);
                                }} />
                                <span className="text-lg text-gray-700">{opt}</span>
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
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="p-4 text-left text-gray-600 font-bold uppercase text-xs tracking-wider">Pernyataan</th>
                                                    <th className="p-4 w-24 text-center border-l text-gray-600 font-bold uppercase text-xs tracking-wider bg-green-50/50">{opts[0]}</th>
                                                    <th className="p-4 w-24 text-center border-l text-gray-600 font-bold uppercase text-xs tracking-wider bg-red-50/50">{opts[1]}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {pairs.map((item: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="p-4 text-gray-800 font-medium">{item.left}</td>
                                                        <td className="p-4 text-center border-l bg-green-50/10">
                                                            <div className="flex justify-center">
                                                                <label className="cursor-pointer relative">
                                                                    <input type="radio" name={`bs-${currentQ.id}-${idx}`} checked={currentAns[idx] === 'a'} 
                                                                        onChange={() => {
                                                                            const n = [...currentAns]; n[idx] = 'a'; handleAnswer(n);
                                                                        }} 
                                                                    className="w-6 h-6 accent-green-600 cursor-pointer" />
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center border-l bg-red-50/10">
                                                             <div className="flex justify-center">
                                                                <label className="cursor-pointer relative">
                                                                    <input type="radio" name={`bs-${currentQ.id}-${idx}`} checked={currentAns[idx] === 'b'} 
                                                                        onChange={() => {
                                                                            const n = [...currentAns]; n[idx] = 'b'; handleAnswer(n);
                                                                        }} 
                                                                    className="w-6 h-6 accent-red-600 cursor-pointer" />
                                                                </label>
                                                            </div>
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

        {/* Bottom Navigation Bar */}
        <div className="bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] sticky bottom-0 z-20 backdrop-blur-lg bg-white/90">
             {/* Question Number Toggle List */}
             <div className="flex gap-2 overflow-x-auto no-scrollbar p-3 border-b border-gray-100 bg-gray-50/50">
                 {questions.map((q, i) => (
                     <button key={i} onClick={() => setCurrentIdx(i)} 
                         className={`w-10 h-10 flex-shrink-0 rounded-lg text-sm font-bold border-2 transition-all duration-200 ${
                             currentIdx === i ? 'bg-blue-600 text-white border-blue-600 scale-110 shadow-md ring-2 ring-blue-200' : 
                             doubtful.has(q.id) ? 'bg-yellow-400 text-white border-yellow-500' :
                             answers[q.id] ? 'bg-green-500 text-white border-green-600' : 
                             'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                         }`}>
                         {i+1}
                     </button>
                 ))}
             </div>

             {/* Navigation Controls */}
             <div className="p-4 flex justify-between items-center max-w-4xl mx-auto w-full">
                 <button 
                    onClick={() => setCurrentIdx(p => Math.max(0, p - 1))} 
                    disabled={currentIdx===0} 
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 font-bold flex items-center gap-2 transition-colors"
                 >
                    <span>←</span> <span className="hidden md:inline">Sebelumnya</span>
                 </button>
                 
                 {/* Ragu-ragu Button (Centered) */}
                 <button 
                    onClick={handleToggleDoubtful}
                    className={`px-6 py-2.5 rounded-xl font-bold border-2 flex items-center gap-2 transition-all duration-200 ${
                        isCurrentDoubtful 
                        ? 'bg-yellow-400 text-white border-yellow-500 shadow-lg scale-105' 
                        : 'bg-white text-yellow-600 border-yellow-400 hover:bg-yellow-50'
                    }`}
                 >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isCurrentDoubtful ? 'bg-white border-white' : 'border-yellow-600'}`}>
                        {isCurrentDoubtful && <span className="text-yellow-500 text-xs">✓</span>}
                    </div>
                    Ragu-ragu
                 </button>

                 {currentIdx === questions.length - 1 ? (
                     <button onClick={() => handleSubmitExam(false)} className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 flex items-center gap-2 transition-transform hover:-translate-y-0.5">
                        <span>Selesai</span> <span>✓</span>
                     </button>
                 ) : (
                     <button onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition-transform hover:-translate-y-0.5">
                        <span className="hidden md:inline">Selanjutnya</span> <span>→</span>
                     </button>
                 )}
             </div>
        </div>
    </div>
  );
};

export default ExamInterface;