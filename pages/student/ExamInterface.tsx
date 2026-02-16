import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../services/storageService';
import { Exam, Question, QuestionType } from '../../types';

interface ExamInterfaceProps {
  examId: string;
  username: string; // Add username prop to identify student
  onFinish: () => void;
}

const ExamInterface: React.FC<ExamInterfaceProps> = ({ examId, username, onFinish }) => {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Features
  const [doubtful, setDoubtful] = useState<Set<string>>(new Set());
  const [violationCount, setViolationCount] = useState(0);
  const [isViolationWarning, setIsViolationWarning] = useState(false);
  
  // Finish State
  const [isFinished, setIsFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    const e = storage.exams.getAll().find(ex => ex.id === examId);
    if (e) {
      setExam(e);
      const qs = storage.questions.getByPacketId(e.packetId);
      setQuestions(qs);
      setTimeLeft(e.durationMinutes * 60);
    }
  }, [examId]);

  // --- Proctoring Logic ---
  useEffect(() => {
    if (isFinished) return; // Stop checks if finished

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation("Terdeteksi pindah tab/aplikasi.");
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Standard browser warning
      handleViolation("Terdeteksi mencoba refresh halaman.");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [violationCount, isFinished]); 

  const handleViolation = (msg: string) => {
      const newCount = violationCount + 1;
      setViolationCount(newCount);
      setIsViolationWarning(true);

      if (newCount >= 3) {
          alert(`PELANGGARAN BERAT! Anda telah melakukan pelanggaran sebanyak ${newCount} kali. Ujian akan dikirim otomatis.`);
          handleSubmitExam(true);
      }
  };
  // ------------------------

  useEffect(() => {
    if (isFinished) return;
    if (timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && exam) {
      handleSubmitExam(true); // Auto submit time up
    }
  }, [timeLeft, exam, isFinished]);

  const handleAnswer = (val: any) => {
    if (!questions[currentIdx]) return;
    setAnswers({ ...answers, [questions[currentIdx].id]: val });
  };

  const toggleDoubt = () => {
      if (!questions[currentIdx]) return;
      const qId = questions[currentIdx].id;
      const newDoubt = new Set(doubtful);
      if (newDoubt.has(qId)) newDoubt.delete(qId);
      else newDoubt.add(qId);
      setDoubtful(newDoubt);
  };

  const handleSubmitExam = (forced = false) => {
    if (!forced && !window.confirm("Apakah anda yakin ingin menyelesaikan ujian? Jawaban akan dikunci dan nilai langsung diproses.")) return;
        
    // 1. Scoring Logic
    let correctCount = 0;
    questions.forEach(q => {
        const studentAns = answers[q.id];
        
        if (q.type === QuestionType.MULTIPLE_CHOICE) {
            if (studentAns === q.correctAnswerIndex) correctCount++;
        } 
        else if (q.type === QuestionType.TRUE_FALSE) {
             try {
                 const bs = JSON.parse(q.options);
                 if (Array.isArray(studentAns) && studentAns.length === bs.items.length) {
                     const allCorrect = bs.items.every((item: any, idx: number) => item.answer === studentAns[idx]);
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

    // 2. Identify Student & Save Result
    const allStudents = storage.students.getAll();
    const me = allStudents.find(s => s.name === username);

    try {
        storage.results.add({
            id: Date.now().toString(), // Use timestamp ID to be safe
            examId: examId,
            examTitle: exam?.title || '',
            studentId: me?.id || 'unknown', 
            studentName: me?.name || username, // Use real username
            studentClass: me?.class || '',
            score: score,
            literasiScore: 0, // Placeholder for specific scoring logic
            numerasiScore: 0,
            answers: JSON.stringify(answers),
            timestamp: new Date().toISOString(),
            violationCount: violationCount,
            isDisqualified: forced && violationCount >= 3
        });
        
        // 3. Update State to Show Result Screen
        setIsFinished(true);
    } catch (error) {
        console.error("Save Error:", error);
        alert("Terjadi kesalahan saat menyimpan ujian. Mohon screenshot halaman ini dan lapor ke proktor.");
    }
  };

  // --- RENDER SCORE SCREEN IF FINISHED (Glassmorphism Style) ---
  if (isFinished) {
      return (
          <div 
            className="min-h-screen flex items-center justify-center p-4 font-sans bg-fixed bg-cover bg-center"
            style={{ 
                backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2864&auto=format&fit=crop')`,
            }}
          >
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

              <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-w-md w-full text-center animate-slideDown border border-white/20">
                  <div className="w-24 h-24 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-400/30 shadow-inner">
                      <span className="text-5xl drop-shadow-md">🏆</span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">Ujian Selesai!</h2>
                  <p className="text-blue-100 mb-8 font-medium">Terima kasih telah mengerjakan dengan jujur.</p>
                  
                  <div className="bg-white/20 p-6 rounded-2xl border border-white/10 mb-8 shadow-inner">
                      <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">Nilai Kamu</p>
                      <p className="text-6xl font-extrabold text-white drop-shadow-lg">{finalScore}</p>
                  </div>

                  <button 
                    onClick={onFinish}
                    className="w-full bg-white text-blue-900 py-4 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-xl transform hover:scale-[1.02]"
                  >
                      Kembali ke Dashboard
                  </button>
              </div>
          </div>
      )
  }

  if (!exam || questions.length === 0) return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Memuat soal ujian...</div>;

  const currentQ = questions[currentIdx];
  const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 relative">
        {/* Violation Warning Modal */}
        {isViolationWarning && violationCount < 3 && (
            <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-red-600 text-white p-6 rounded-2xl shadow-2xl max-w-md text-center border-2 border-red-400">
                    <h2 className="text-2xl font-bold mb-2">PERINGATAN!</h2>
                    <p className="mb-4 text-red-100">Anda terdeteksi meninggalkan halaman ujian atau melakukan refresh. Ini adalah pelanggaran ke-{violationCount}.</p>
                    <p className="mb-6 font-bold bg-red-800/30 py-2 rounded">Jika mencapai 3 kali, ujian akan otomatis dikirim!</p>
                    <button 
                        onClick={() => setIsViolationWarning(false)}
                        className="bg-white text-red-600 px-8 py-3 rounded-xl font-bold hover:bg-red-50 shadow-lg"
                    >
                        Saya Mengerti
                    </button>
                </div>
            </div>
        )}

        {/* Top Header & Navigation Grid */}
        <div className="bg-slate-900/95 backdrop-blur-md text-white shadow-md z-50 sticky top-0 border-b border-white/10">
            <div className="p-3 flex justify-between items-center">
                <div className="flex items-center gap-4">
                     <h1 className="font-bold text-sm md:text-base line-clamp-1">{exam.title}</h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`text-xl font-mono font-bold px-4 py-1.5 rounded-lg shadow-inner ${timeLeft < 300 ? 'bg-red-600 animate-pulse' : 'bg-black/40 border border-white/10'}`}>
                        {formatTime(timeLeft)}
                    </div>
                    {/* Tombol Akhiri Ujian di Kanan Atas */}
                    <button 
                        onClick={() => handleSubmitExam(false)}
                        className="bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border border-red-500/50 shadow-lg transition-all"
                    >
                        Akhiri Ujian
                    </button>
                </div>
            </div>
            
            {/* Horizontal Scrollable Question Grid */}
            <div className="py-3 px-2 overflow-x-auto whitespace-nowrap bg-black/20 no-scrollbar">
                <div className="inline-flex gap-2">
                    {questions.map((q, idx) => {
                        const isAnswered = answers[q.id] !== undefined;
                        const isDoubful = doubtful.has(q.id);
                        const isCurrent = currentIdx === idx;
                        
                        let btnClass = "bg-white/10 text-gray-400 border-white/10 hover:bg-white/20"; // Default
                        if (isCurrent) btnClass = "bg-blue-600 text-white border-blue-400 ring-2 ring-white/50 shadow-lg scale-110";
                        else if (isDoubful) btnClass = "bg-orange-500 text-white border-orange-400";
                        else if (isAnswered) btnClass = "bg-green-600 text-white border-green-500";
                        
                        return (
                            <button
                                key={q.id}
                                onClick={() => setCurrentIdx(idx)}
                                className={`w-10 h-10 flex-shrink-0 rounded-lg border font-bold text-sm transition-all ${btnClass}`}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100/50 pb-28 scroll-smooth">
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-2xl shadow-xl min-h-[50vh] border border-gray-200">
                <div className="mb-6 flex justify-between items-center border-b pb-4">
                    <span className="bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">Soal No. {currentIdx + 1}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{currentQ.type}</span>
                </div>

                {/* Stimulus */}
                {currentQ.stimulus && (
                    <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-800 leading-relaxed shadow-inner">
                        {currentQ.stimulus.startsWith('http') || currentQ.stimulus.startsWith('data:image') ? (
                            <img src={currentQ.stimulus} alt="Stimulus" className="max-w-full h-auto rounded-lg shadow-sm mx-auto" />
                        ) : (
                            <div className="whitespace-pre-wrap font-serif text-lg">{currentQ.stimulus}</div>
                        )}
                    </div>
                )}
                
                {/* Question Text */}
                <div className="text-xl md:text-2xl font-medium text-slate-900 mb-8 leading-snug">
                    {currentQ.text}
                </div>

                {/* Options based on Type */}
                <div className="space-y-4">
                    {/* PG */}
                    {currentQ.type === QuestionType.MULTIPLE_CHOICE && 
                        JSON.parse(currentQ.options).map((opt: string, idx: number) => (
                            <label 
                                key={idx}
                                className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all hover:bg-blue-50/50 group ${
                                    answers[currentQ.id] === idx 
                                    ? 'border-blue-600 bg-blue-50 shadow-md transform scale-[1.01]' 
                                    : 'border-gray-200 bg-white shadow-sm'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-5 font-bold border-2 flex-shrink-0 transition-colors ${
                                    answers[currentQ.id] === idx 
                                    ? 'bg-blue-600 text-white border-blue-600' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200 group-hover:border-blue-300'
                                }`}>
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <input 
                                    type="radio" 
                                    name={`q-${currentQ.id}`} 
                                    className="hidden" 
                                    checked={answers[currentQ.id] === idx} 
                                    onChange={() => handleAnswer(idx)} 
                                />
                                <span className={`text-lg ${answers[currentQ.id] === idx ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>{opt}</span>
                            </label>
                    ))}

                    {/* Benar / Salah (Complex) */}
                    {currentQ.type === QuestionType.TRUE_FALSE && (
                        (() => {
                            try {
                                const bs = JSON.parse(currentQ.options);
                                const ansArray = Array.isArray(answers[currentQ.id]) 
                                    ? [...answers[currentQ.id]] 
                                    : new Array(bs.items.length).fill(null);

                                const handleBsRowClick = (itemIdx: number, val: number) => {
                                    ansArray[itemIdx] = val;
                                    handleAnswer(ansArray);
                                };

                                return (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="p-4 font-bold text-gray-700">Pernyataan</th>
                                                    <th className="p-4 w-28 text-center font-bold text-gray-700 border-l">{bs.labels[0]}</th>
                                                    <th className="p-4 w-28 text-center font-bold text-gray-700 border-l">{bs.labels[1]}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {bs.items.map((item: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="p-4 text-gray-800">{item.text}</td>
                                                        <td className="p-4 text-center border-l border-gray-100 relative">
                                                            <input 
                                                                type="radio" 
                                                                name={`bs-${currentQ.id}-${idx}`}
                                                                className="w-6 h-6 cursor-pointer accent-blue-600"
                                                                checked={ansArray[idx] === 0}
                                                                onChange={() => handleBsRowClick(idx, 0)}
                                                            />
                                                        </td>
                                                        <td className="p-4 text-center border-l border-gray-100 relative">
                                                            <input 
                                                                type="radio" 
                                                                name={`bs-${currentQ.id}-${idx}`}
                                                                className="w-6 h-6 cursor-pointer accent-blue-600"
                                                                checked={ansArray[idx] === 1}
                                                                onChange={() => handleBsRowClick(idx, 1)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            } catch(e) { return <div>Error loading question format.</div>}
                        })()
                    )}
                    
                    {/* PG Kompleks */}
                    {currentQ.type === QuestionType.COMPLEX_MULTIPLE_CHOICE && 
                        JSON.parse(currentQ.options).map((opt: string, idx: number) => {
                             const currentAns = answers[currentQ.id] || [];
                             const isChecked = currentAns.includes(idx);
                             return (
                                <label 
                                    key={idx}
                                    className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all hover:bg-blue-50/50 ${
                                        isChecked
                                        ? 'border-blue-600 bg-blue-50 shadow-md' 
                                        : 'border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded flex items-center justify-center mr-4 border-2 flex-shrink-0 transition-colors ${
                                        isChecked 
                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                        : 'border-gray-300 bg-white'
                                    }`}>
                                        {isChecked && '✓'}
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={isChecked} 
                                        onChange={() => {
                                            const newAns = isChecked 
                                                ? currentAns.filter((i: number) => i !== idx)
                                                : [...currentAns, idx];
                                            handleAnswer(newAns);
                                        }} 
                                    />
                                    <span className={`text-lg ${isChecked ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>{opt}</span>
                                </label>
                            );
                        })
                    }
                </div>
            </div>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white/80 backdrop-blur-xl border-t border-white/20 p-4 flex justify-between items-center shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.1)] z-40 fixed bottom-0 w-full lg:pl-0">
             <button 
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="bg-white text-gray-700 px-6 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-gray-100 transition-colors w-32 shadow-sm border border-gray-200"
            >
                ← Prev
            </button>
            
            {/* Tombol Ragu-Ragu di Tengah */}
            <button 
                onClick={toggleDoubt}
                className={`px-8 py-3 rounded-xl font-bold border transition-colors flex items-center gap-2 shadow-sm ${
                    doubtful.has(currentQ.id) 
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
            >
                {doubtful.has(currentQ.id) ? (
                    <>
                        <span className="text-xl">🚩</span> <span className="hidden md:inline">Ragu-ragu</span>
                    </>
                ) : (
                    <>
                         <span className="text-xl opacity-30">🏳️</span> <span className="hidden md:inline">Ragu-ragu</span>
                    </>
                )}
            </button>

            {currentIdx === questions.length - 1 ? (
                <button 
                    onClick={() => handleSubmitExam(false)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-600/30 hover:shadow-xl transition-all transform hover:-translate-y-1 w-32"
                >
                    Selesai
                </button>
            ) : (
                <button 
                    onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                    className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-all w-32"
                >
                    Next →
                </button>
            )}
        </div>
    </div>
  );
};

export default ExamInterface;
