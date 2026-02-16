import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Exam } from '../../types';

interface StudentDashboardProps {
    username: string; // Passed from App to identify student
}

interface DashboardItem {
    exam: Exam;
    category: string;
    isDone: boolean;
    score?: number;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ username }) => {
  const [myExams, setMyExams] = useState<DashboardItem[]>([]);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    // 1. Identify Student
    const allStudents = storage.students.getAll();
    const me = allStudents.find(s => s.name === username);
    setStudentName(username);

    if (me) {
        // 2. Get Exams targeted to my class
        const allExams = storage.exams.getAll();
        const allPackets = storage.packets.getAll();
        const allResults = storage.results.getAll();
        
        const targetedExams = allExams.filter(e => 
            e.classTarget.split(',').includes(me.class)
        );

        // 3. Map to Dashboard items with Category and Status
        let dashboardData: DashboardItem[] = targetedExams.map(exam => {
            const result = allResults.find(r => r.examId === exam.id && r.studentName === me.name);
            const packet = allPackets.find(p => p.id === exam.packetId);
            
            return {
                exam,
                category: packet?.category || 'Umum',
                isDone: !!result,
                score: result?.score
            };
        });

        // 4. FILTER: Show only Active Exams OR Completed Exams
        // Hide inactive exams that haven't been taken
        dashboardData = dashboardData.filter(item => item.exam.isActive || item.isDone);

        // Sort: Active pending first, then Done
        dashboardData.sort((a, b) => {
            if (a.isDone === b.isDone) return 0;
            return a.isDone ? 1 : -1;
        });

        setMyExams(dashboardData);
    }
  }, [username]);

  return (
    <div className="space-y-8 animate-fadeIn">
       {/* Welcome Card - Glass Gradient */}
       <div className="bg-gradient-to-r from-blue-600/90 to-indigo-700/90 backdrop-blur-md p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden border border-white/20">
         <div className="relative z-10">
            <h2 className="text-4xl font-extrabold mb-3 tracking-tight">Selamat Datang, {studentName}! 👋</h2>
            <p className="opacity-90 text-blue-50 font-medium text-lg max-w-2xl">Semoga hasil ujianmu memuaskan. Tetap semangat belajar dan jaga integritas!</p>
         </div>
         {/* Abstract Shape */}
         <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
         <div className="absolute right-20 -top-10 w-40 h-40 bg-blue-400/30 rounded-full blur-2xl"></div>
       </div>

       {/* History Table - Glass Container */}
       <div className="bg-white/70 backdrop-filter backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
           <div className="p-6 border-b border-gray-200/50 flex justify-between items-center bg-white/30">
               <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
                   <span>📋</span> Ujian Aktif & Riwayat Pengerjaan
               </h3>
               <span className="text-xs bg-white/50 px-3 py-1.5 rounded-full text-gray-600 font-medium border border-white/40 shadow-sm">
                   Filter Otomatis
               </span>
           </div>
           
           <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100/50 text-gray-600 uppercase text-xs tracking-wider border-b border-gray-200/50">
                        <tr>
                            <th className="p-5 font-bold">Nama Ujian</th>
                            <th className="p-5 font-bold">Kategori</th>
                            <th className="p-5 font-bold">Jadwal Pelaksanaan</th>
                            <th className="p-5 text-center font-bold">Status</th>
                            <th className="p-5 text-center font-bold">Nilai</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/50">
                        {myExams.length === 0 ? (
                            <tr><td colSpan={5} className="p-10 text-center text-gray-500 italic">Belum ada ujian aktif atau riwayat pengerjaan.</td></tr>
                        ) : myExams.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/40 transition-colors group">
                                <td className="p-5">
                                    <div className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{item.exam.title}</div>
                                    <div className="text-xs text-gray-500 mt-1 font-mono bg-gray-100/50 inline-block px-2 py-0.5 rounded">{item.exam.durationMinutes} Menit</div>
                                </td>
                                <td className="p-5">
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                                        item.category === 'Numerasi' 
                                        ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                        : 'bg-blue-100 text-blue-700 border-blue-200'
                                    }`}>
                                        {item.category}
                                    </span>
                                </td>
                                <td className="p-5 text-sm text-gray-600">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium">Mulai: {new Date(item.exam.scheduledStart).toLocaleString('id-ID')}</span>
                                        <span className="text-gray-400">Selesai: {new Date(item.exam.scheduledEnd).toLocaleString('id-ID')}</span>
                                    </div>
                                </td>
                                <td className="p-5 text-center">
                                    {item.isDone ? (
                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-100/80 text-green-700 rounded-full text-xs font-bold border border-green-200 shadow-sm backdrop-blur-sm">
                                            ✅ Selesai
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-100/80 text-blue-700 rounded-full text-xs font-bold border border-blue-200 shadow-sm backdrop-blur-sm animate-pulse">
                                            ⚡ Aktif
                                        </span>
                                    )}
                                </td>
                                <td className="p-5 text-center">
                                    {item.isDone ? (
                                        <div className="inline-block px-3 py-1 bg-blue-50/50 rounded-lg border border-blue-100">
                                            <span className="text-2xl font-extrabold text-blue-600">{Math.round(item.score || 0)}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-300 font-bold text-xl">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
           </div>
       </div>
    </div>
  );
};

export default StudentDashboard;