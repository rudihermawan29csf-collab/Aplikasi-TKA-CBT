import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Result, Exam, Packet, Question, QuestionType } from '../../types';

interface StudentResultsProps {
    username: string;
}

interface ResultDetail extends Result {
    category: string;
    totalQuestions: number;
    packetId: string;
}

interface AnswerAnalysis {
    questionNo: number;
    isCorrect: boolean;
    type: string;
    studentAnswer: string;
    correctAnswer: string;
}

const StudentResults: React.FC<StudentResultsProps> = ({ username }) => {
    const [results, setResults] = useState<ResultDetail[]>([]);
    const [selectedResult, setSelectedResult] = useState<ResultDetail | null>(null);
    const [analysis, setAnalysis] = useState<AnswerAnalysis[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // FILTERS
    const [filterCategory, setFilterCategory] = useState<'all' | 'Literasi' | 'Numerasi'>('all');
    const [filterScore, setFilterScore] = useState<'all' | 'under70' | 'above70'>('all');

    useEffect(() => {
        const allStudents = storage.students.getAll();
        const me = allStudents.find(s => s.name === username);

        if (me) {
            const allResults = storage.results.getAll();
            const allExams = storage.exams.getAll();
            const allPackets = storage.packets.getAll();

            const myResults = allResults
                .filter(r => r.studentName === me.name)
                .map(r => {
                    const exam = allExams.find(e => e.id === r.examId);
                    const packet = allPackets.find(p => p.id === exam?.packetId);
                    return {
                        ...r,
                        category: packet?.category || 'Umum',
                        totalQuestions: packet?.totalQuestions || 0,
                        packetId: exam?.packetId || ''
                    };
                })
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setResults(myResults);
        }
    }, [username]);

    const handleViewDetails = (result: ResultDetail) => {
        const questions = storage.questions.getByPacketId(result.packetId);
        const studentAnswers = JSON.parse(result.answers);

        const analyzed: AnswerAnalysis[] = questions.sort((a,b) => a.number - b.number).map(q => {
            const ans = studentAnswers[q.id];
            let isCorrect = false;
            let displayAns = '-';
            let displayKey = '-';

            if (q.type === QuestionType.MULTIPLE_CHOICE) {
                isCorrect = ans === q.correctAnswerIndex;
                const opts = JSON.parse(q.options || '[]');
                displayAns = ans !== undefined ? String.fromCharCode(65 + ans) : 'Kosong';
                displayKey = String.fromCharCode(65 + q.correctAnswerIndex);
            } 
            else if (q.type === QuestionType.TRUE_FALSE) {
                 try {
                     const pairs = JSON.parse(q.matchingPairs || '[]'); 
                     if (Array.isArray(ans) && ans.length === pairs.length) {
                         isCorrect = pairs.every((item: any, idx: number) => item.right === ans[idx]);
                     }
                     displayAns = isCorrect ? 'Benar Semua' : 'Ada Salah';
                     displayKey = 'Sesuai Kunci';
                 } catch(e) {}
            }
            else if (q.type === QuestionType.COMPLEX_MULTIPLE_CHOICE) {
                const correctIndices = JSON.parse(q.correctAnswerIndices || '[]');
                if (Array.isArray(ans) && 
                    ans.length === correctIndices.length && 
                    ans.every((val: number) => correctIndices.includes(val))) {
                    isCorrect = true;
                }
                displayAns = Array.isArray(ans) ? ans.map((i: number) => String.fromCharCode(65+i)).join(', ') : '-';
                displayKey = correctIndices.map((i: number) => String.fromCharCode(65+i)).join(', ');
            }

            return {
                questionNo: q.number,
                isCorrect,
                type: q.type,
                studentAnswer: displayAns,
                correctAnswer: displayKey
            };
        });

        setSelectedResult(result);
        setAnalysis(analyzed);
        setIsModalOpen(true);
    };

    // --- FILTERING LOGIC ---
    const filteredResults = results.filter(item => {
        // 1. Filter Category
        const catMatch = filterCategory === 'all' || item.category === filterCategory;
        
        // 2. Filter Score (Pass/Fail)
        const score = Math.round(Number(item.score));
        let scoreMatch = true;
        if (filterScore === 'under70') scoreMatch = score < 70;
        if (filterScore === 'above70') scoreMatch = score >= 70;

        return catMatch && scoreMatch;
    });

    return (
        <div className="space-y-6 animate-fadeIn">
             <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/20 pb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-white/40 p-4 rounded-2xl text-purple-600 shadow-lg backdrop-blur-sm border border-white/40">
                        <span className="text-4xl">📊</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-800 drop-shadow-sm">Hasil Ujian</h2>
                        <p className="text-gray-600 text-sm mt-1 font-medium bg-white/30 inline-block px-3 py-1 rounded-full">
                            Riwayat nilai dan analisis jawabanmu.
                        </p>
                    </div>
                </div>

                {/* FILTERS */}
                <div className="flex flex-wrap gap-2">
                    <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value as any)}
                        className="px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="all">📂 Semua Mapel</option>
                        <option value="Literasi">📖 Literasi</option>
                        <option value="Numerasi">📐 Numerasi</option>
                    </select>

                    <select 
                        value={filterScore}
                        onChange={(e) => setFilterScore(e.target.value as any)}
                        className="px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm font-bold text-gray-700 focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="all">🎯 Semua Nilai</option>
                        <option value="above70">✅ Tuntas (≥70)</option>
                        <option value="under70">⚠️ Belum Tuntas (&lt;70)</option>
                    </select>
                </div>
            </div>

            {filteredResults.length === 0 ? (
                 <div className="bg-white/60 backdrop-blur-xl p-16 rounded-3xl shadow-lg text-center border-2 border-dashed border-white/50">
                    <span className="text-6xl block mb-6 opacity-70">📭</span>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Data Tidak Ditemukan</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        Belum ada hasil ujian yang sesuai dengan filter yang dipilih.
                    </p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredResults.map((res) => {
                        const score = Math.round(Number(res.score));
                        const isPassed = score >= 70;

                        return (
                        <div key={res.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col hover:shadow-xl transition-shadow">
                            <div className={`h-2 w-full ${res.category === 'Numerasi' ? 'bg-orange-500' : 'bg-purple-600'}`}></div>
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${
                                        res.category === 'Numerasi' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                    }`}>
                                        {res.category}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">{new Date(res.timestamp).toLocaleDateString()}</span>
                                </div>
                                
                                <h3 className="text-lg font-bold text-gray-800 mb-4 line-clamp-2 min-h-[3.5rem]">{res.examTitle}</h3>
                                
                                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                                     <div className="flex flex-col">
                                         <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Nilai Akhir</p>
                                         <p className={`text-4xl font-extrabold ${isPassed ? 'text-green-600' : 'text-red-500'}`}>
                                             {score}
                                         </p>
                                         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit mt-1 ${isPassed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                             {isPassed ? 'TUNTAS' : 'BELUM TUNTAS'}
                                         </span>
                                     </div>
                                     <div className="text-right self-end">
                                         <button 
                                            onClick={() => handleViewDetails(res)}
                                            className="bg-gray-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-black shadow transition-transform active:scale-95 flex items-center gap-1"
                                         >
                                             <span>👁️</span> Detail
                                         </button>
                                     </div>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            )}

            {/* Analysis Modal */}
            {isModalOpen && selectedResult && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl animate-scaleIn">
                        <div className={`p-6 border-b rounded-t-2xl flex justify-between items-center ${
                             Math.round(Number(selectedResult.score)) >= 70 ? 'bg-green-50' : 'bg-red-50'
                        }`}>
                            <div>
                                <h3 className="font-bold text-xl text-gray-800">Detail Jawaban</h3>
                                <p className="text-sm text-gray-500 line-clamp-1 max-w-xs">{selectedResult.examTitle}</p>
                            </div>
                            <div className="text-right">
                                <span className={`block text-3xl font-extrabold ${
                                    Math.round(Number(selectedResult.score)) >= 70 ? 'text-green-600' : 'text-red-600'
                                }`}>{Math.round(Number(selectedResult.score))}</span>
                                <span className="text-xs font-bold text-gray-400 uppercase">Skor Kamu</span>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-white">
                            <div className="grid grid-cols-6 gap-2 text-xs font-bold uppercase text-gray-400 mb-3 px-2">
                                <div className="col-span-1 text-center">No</div>
                                <div className="col-span-1 text-center">Status</div>
                                <div className="col-span-2 text-center">Jawabanmu</div>
                                <div className="col-span-2 text-center">Kunci</div>
                            </div>
                            <div className="space-y-2">
                                {analysis.map((item) => (
                                    <div key={item.questionNo} className={`grid grid-cols-6 gap-2 items-center p-3 rounded-xl border ${
                                        item.isCorrect ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'
                                    }`}>
                                        <div className="col-span-1 text-center font-bold text-gray-600 bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-sm mx-auto">{item.questionNo}</div>
                                        <div className="col-span-1 text-center text-lg">
                                            {item.isCorrect ? '✅' : '❌'}
                                        </div>
                                        <div className={`col-span-2 text-center font-mono text-sm font-bold ${item.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                            {item.studentAnswer}
                                        </div>
                                        <div className="col-span-2 text-center font-mono text-sm text-gray-500 bg-gray-100 rounded py-1">
                                            {item.correctAnswer}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-end bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-colors shadow-lg">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentResults;