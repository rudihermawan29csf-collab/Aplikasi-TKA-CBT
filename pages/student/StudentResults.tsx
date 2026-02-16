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

    return (
        <div className="space-y-6 animate-fadeIn">
             <div className="flex flex-col md:flex-row md:items-center gap-6 border-b border-white/20 pb-6">
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

            {results.length === 0 ? (
                 <div className="bg-white/60 backdrop-blur-xl p-16 rounded-3xl shadow-lg text-center border-2 border-dashed border-white/50">
                    <span className="text-6xl block mb-6 opacity-70">📭</span>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Belum Ada Hasil</h3>
                    <p className="text-gray-600 max-w-md mx-auto">
                        Kamu belum mengerjakan ujian apapun. Silakan kerjakan ujian di menu <b>Ujian</b>.
                    </p>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.map((res) => (
                        <div key={res.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 flex flex-col">
                            <div className={`h-2 w-full ${res.category === 'Numerasi' ? 'bg-orange-500' : 'bg-purple-600'}`}></div>
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${
                                        res.category === 'Numerasi' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                    }`}>
                                        {res.category}
                                    </span>
                                    <span className="text-xs text-gray-400">{new Date(res.timestamp).toLocaleDateString()}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-1">{res.examTitle}</h3>
                                <div className="mt-4 flex items-center justify-between">
                                     <div className="text-center">
                                         <p className="text-xs text-gray-500 uppercase font-bold">Nilai Akhir</p>
                                         <p className="text-4xl font-extrabold text-gray-800">{Math.round(Number(res.score))}</p>
                                     </div>
                                     <div className="text-right">
                                         {/* Simple Donut Chart Representation or just text */}
                                         <button 
                                            onClick={() => handleViewDetails(res)}
                                            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 shadow transition-transform active:scale-95"
                                         >
                                             Lihat Detail
                                         </button>
                                     </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Analysis Modal */}
            {isModalOpen && selectedResult && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b bg-gray-50 rounded-t-2xl flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-xl text-gray-800">Detail Jawaban</h3>
                                <p className="text-sm text-gray-500">{selectedResult.examTitle}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-bold text-blue-600">{Math.round(Number(selectedResult.score))}</span>
                                <span className="text-xs font-bold text-gray-400 uppercase">Skor Kamu</span>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-gray-50/50">
                            <div className="grid grid-cols-6 gap-2 text-xs font-bold uppercase text-gray-500 mb-2 px-2">
                                <div className="col-span-1 text-center">No</div>
                                <div className="col-span-1 text-center">Status</div>
                                <div className="col-span-2 text-center">Jawabanmu</div>
                                <div className="col-span-2 text-center">Kunci</div>
                            </div>
                            <div className="space-y-2">
                                {analysis.map((item) => (
                                    <div key={item.questionNo} className={`grid grid-cols-6 gap-2 items-center p-3 rounded-lg border ${
                                        item.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                    }`}>
                                        <div className="col-span-1 text-center font-bold text-gray-700">{item.questionNo}</div>
                                        <div className="col-span-1 text-center text-lg">
                                            {item.isCorrect ? '✅' : '❌'}
                                        </div>
                                        <div className="col-span-2 text-center font-mono text-sm font-bold text-gray-800">
                                            {item.studentAnswer}
                                        </div>
                                        <div className="col-span-2 text-center font-mono text-sm text-gray-500">
                                            {item.correctAnswer}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-black transition-colors">
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