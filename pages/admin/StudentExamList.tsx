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

        // Filter Logic:
        // 1. Class Target matches student's class
        // 2. Exam is Active (isActive = true)
        // 3. Current time is within scheduled start and end
        // 4. Student has NOT taken this exam yet (not in Results)
        
        const filtered = allExams.filter(e => {
            const isTargetClass = e.classTarget.split(',').includes(me.class);
            const isActive = e.isActive;
            const startDate = new Date(e.scheduledStart);
            const endDate = new Date(e.scheduledEnd);
            const isWithinTime = startDate <= now && endDate >= now;
            
            // Match result by examId and student name (mock logic)
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

      // If same day
      if (start.toDateString() === end.toDateString()) {
          return `${start.toLocaleDateString('id-ID', dateOptions)}, ${start.toLocaleTimeString('id-ID', timeOptions)} s.d. ${end.toLocaleTimeString('id-ID', timeOptions)}`;
      }
      // Different days
      return `${start.toLocaleDateString('id-ID', { ...dateOptions, ...timeOptions })} s.d. ${end.toLocaleDateString('id-ID', { ...dateOptions, ...timeOptions })}`;
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center gap-4 border-b pb-4">
           <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                <span className="text-3xl">✍️</span>
           </div>
           <div>
                <h2 className="text-2xl font-bold text-gray-800">Daftar Ujian Aktif</h2>
                <p className="text-gray-500 text-sm">Berikut adalah daftar ujian yang tersedia dan <b>belum kamu kerjakan</b>.</p>
           </div>
       </div>
       
       {availableExams.length === 0 ? (
         <div className="bg-white p-16 rounded-xl shadow-sm text-center border-2 border-dashed border-gray-200">
            <span className="text-5xl block mb-4 opacity-50">🎉</span>
            <h3 className="text-xl font-bold text-gray-700 mb-2">Tidak Ada Ujian Aktif</h3>
            <p className="text-gray-500">
                Saat ini tidak ada ujian yang perlu dikerjakan. <br/>
                Silakan cek kembali nanti atau lihat riwayat ujian di Dashboard.
            </p>
         </div>
       ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableExams.map(({ exam, packet }) => (
                <div key={exam.id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col group">
                    {/* Color Bar based on Category */}
                    <div className={`h-2 w-full ${packet?.category === 'Numerasi' ? 'bg-orange-500' : 'bg-blue-600'}`}></div>
                    
                    <div className="p-6 flex-1 flex flex-col relative">
                        {/* Category Badge */}
                        <div className="absolute top-4 right-4">
                             <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                                 packet?.category === 'Numerasi' 
                                 ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                                 : 'bg-blue-100 text-blue-700 border border-blue-200'
                             }`}>
                                 {packet?.category || 'Umum'}
                             </span>
                        </div>

                        <div className="mb-4 mt-2">
                             <h4 className="text-xl font-bold text-gray-800 leading-tight group-hover:text-blue-600 transition-colors">
                                 {exam.title}
                             </h4>
                             <p className="text-xs text-gray-400 mt-1 font-mono uppercase tracking-wide">
                                 Durasi: {exam.durationMinutes} Menit
                             </p>
                        </div>
                        
                        <div className="mt-auto space-y-3">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Waktu Pelaksanaan</p>
                                <div className="flex items-start gap-2 text-sm text-gray-700">
                                    <span>📅</span> 
                                    <span className="leading-tight">
                                        {formatDateRange(exam.scheduledStart, exam.scheduledEnd)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm text-gray-600 px-1">
                                <div className="flex items-center gap-1.5">
                                    <span>📝</span> 
                                    <span className="font-medium">{packet?.totalQuestions || 0} Soal</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => onStartExam(exam.id)}
                            className="mt-6 w-full bg-gray-900 text-white py-3.5 rounded-lg font-bold hover:bg-blue-600 hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"
                        >
                            <span>Mulai Mengerjakan</span>
                            <span className="text-lg">→</span>
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
