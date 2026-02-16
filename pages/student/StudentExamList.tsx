import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Exam, Packet } from '../../types';

interface StudentExamListProps {
    username: string;
    onStartExam: (examId: string) => void;
}

const StudentExamList: React.FC<StudentExamListProps> = ({ username, onStartExam }) => {
  const [availableExams, setAvailableExams] = useState<Array<{ exam: Exam, packet?: Packet }>>([]);

  useEffect(() => {
    const allStudents = storage.students.getAll();
    const me = allStudents.find(s => s.name === username);
    
    if (me) {
        const now = new Date();
        const allExams = storage.exams.getAll();
        const allPackets = storage.packets.getAll();
        const allResults = storage.results.getAll();

        const filtered = allExams.filter(e => {
            const isTargetClass = e.classTarget.split(',').includes(me.class);
            const isActive = e.isActive;
            const startDate = new Date(e.scheduledStart);
            const endDate = new Date(e.scheduledEnd);
            const isWithinTime = startDate <= now && endDate >= now;
            
            const isTaken = allResults.some(r => r.examId === e.id && r.studentName === me.name);

            return isTargetClass && isActive && isWithinTime && !isTaken;
        }).map(exam => ({
            exam,
            packet: allPackets.find(p => p.id === exam.packetId)
        }));

        setAvailableExams(filtered);
    }
  }, [username]);

  const formatDateRange = (startStr: string, endStr: string) => {
      const start = new Date(startStr);
      const end = new Date(endStr);
      
      const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
      const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

      if (start.toDateString() === end.toDateString()) {
          return `${start.toLocaleDateString('id-ID', dateOptions)}, ${start.toLocaleTimeString('id-ID', timeOptions)} s.d. ${end.toLocaleTimeString('id-ID', timeOptions)}`;
      }
      return `${start.toLocaleDateString('id-ID', { ...dateOptions, ...timeOptions })} s.d. ${end.toLocaleDateString('id-ID', { ...dateOptions, ...timeOptions })}`;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
       <div className="flex flex-col md:flex-row md:items-center gap-6 border-b border-white/20 pb-6">
           <div className="bg-white/40 p-4 rounded-2xl text-blue-600 shadow-lg backdrop-blur-sm border border-white/40">
                <span className="text-4xl">✍️</span>
           </div>
           <div>
                <h2 className="text-3xl font-extrabold text-gray-800 drop-shadow-sm">Daftar Ujian Aktif</h2>
                <div className="flex gap-2 mt-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold uppercase">Literasi</span>
                    <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded font-bold uppercase">Numerasi</span>
                </div>
                <p className="text-gray-600 text-sm mt-2 font-medium bg-white/30 inline-block px-3 py-1 rounded-full">
                    Silakan kerjakan ujian di bawah ini.
                </p>
           </div>
       </div>
       
       {availableExams.length === 0 ? (
         <div className="bg-white/60 backdrop-blur-xl p-16 rounded-3xl shadow-lg text-center border-2 border-dashed border-white/50">
            <span className="text-6xl block mb-6 opacity-70">🎉</span>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Tidak Ada Ujian Aktif</h3>
            <p className="text-gray-600 max-w-md mx-auto">
                Saat ini tidak ada ujian yang perlu dikerjakan. <br/>
                Silakan cek menu <b>Hasil</b> untuk melihat nilai ujian sebelumnya.
            </p>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {availableExams.map(({ exam, packet }) => (
                <div key={exam.id} className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl hover:shadow-2xl hover:bg-white/80 transition-all duration-300 overflow-hidden border border-white/50 flex flex-col group relative transform hover:-translate-y-1">
                    {/* Glassy Color Bar */}
                    <div className={`h-2 w-full ${packet?.category === 'Numerasi' ? 'bg-orange-500/80' : 'bg-blue-600/80'}`}></div>
                    
                    <div className="p-8 flex-1 flex flex-col relative">
                        {/* Category Badge */}
                        <div className="absolute top-6 right-6">
                             <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md ${
                                 packet?.category === 'Numerasi' 
                                 ? 'bg-orange-100/80 text-orange-800 border border-orange-200' 
                                 : 'bg-blue-100/80 text-blue-800 border border-blue-200'
                             }`}>
                                 {packet?.category || 'Umum'}
                             </span>
                        </div>

                        <div className="mb-6 mt-2">
                             <h4 className="text-2xl font-bold text-gray-800 leading-tight group-hover:text-blue-700 transition-colors">
                                 {exam.title}
                             </h4>
                             <p className="text-xs text-gray-500 mt-2 font-mono uppercase tracking-wide bg-gray-200/50 inline-block px-2 py-1 rounded">
                                 Durasi: {exam.durationMinutes} Menit
                             </p>
                        </div>
                        
                        <div className="mt-auto space-y-4">
                            <div className="bg-white/40 p-4 rounded-2xl border border-white/50 shadow-inner">
                                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-wider">Waktu Pelaksanaan</p>
                                <div className="flex items-start gap-2 text-sm text-gray-800 font-medium">
                                    <span>📅</span> 
                                    <span className="leading-tight">
                                        {formatDateRange(exam.scheduledStart, exam.scheduledEnd)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-gray-600 px-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">📝</span> 
                                    <span className="font-bold">{packet?.totalQuestions || 0} Soal</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => onStartExam(exam.id)}
                            className="mt-8 w-full bg-gray-900/90 text-white py-4 rounded-xl font-bold hover:bg-black hover:shadow-lg transition-all flex justify-center items-center gap-3 backdrop-blur-sm border border-gray-700"
                        >
                            <span>Mulai Mengerjakan</span>
                            <span className="text-xl">→</span>
                        </button>
                    </div>
                </div>
            ))}
         </div>
       )}
    </div>
  );
};

export default StudentExamList;