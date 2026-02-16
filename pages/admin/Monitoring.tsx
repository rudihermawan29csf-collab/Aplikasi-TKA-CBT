import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Exam, Student, Result, UserRole } from '../../types';

interface MonitorRow {
    no: number;
    name: string;
    nis: string;
    nisn: string;
    class: string;
    score: number | string; // Score or 'Mengerjakan'
    status: 'online' | 'offline' | 'done';
    violationCount: number;
}

interface MonitoringProps {
    userRole: UserRole | null;
    username: string;
}

const Monitoring: React.FC<MonitoringProps> = ({ userRole, username }) => {
    const [activeExams, setActiveExams] = useState<Exam[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>('all'); // Filter Status State
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    
    // Data Table
    const [rows, setRows] = useState<MonitorRow[]>([]);
    
    // Determine teacher category
    const teacherCategory = userRole === UserRole.TEACHER 
      ? (username.includes('Literasi') ? 'Literasi' : (username.includes('Numerasi') ? 'Numerasi' : null))
      : null;

    // Auto-refresh simulation
    useEffect(() => {
        const interval = setInterval(() => {
             refreshData();
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedExamId, filterClass, activeExams, filterStatus]); // Added filterStatus dependency

    useEffect(() => {
        let exams = storage.exams.getAll(); 
        
        // Filter based on teacher category
        if (userRole === UserRole.TEACHER && teacherCategory) {
             const packets = storage.packets.getAll();
             const allowedPacketIds = packets.filter(p => p.category === teacherCategory).map(p => p.id);
             exams = exams.filter(e => allowedPacketIds.includes(e.packetId));
        }

        setActiveExams(exams);
        if (exams.length > 0) setSelectedExamId(exams[0].id);
    }, [userRole, username, teacherCategory]);

    const refreshData = () => {
        if (!selectedExamId) return;
        
        const exam = activeExams.find(e => e.id === selectedExamId);
        if (!exam) return;

        const targetClasses = exam.classTarget.split(',');
        setAvailableClasses(targetClasses);

        let enrolledStudents = storage.students.getAll().filter(s => targetClasses.includes(s.class));
        
        // 1. Filter Class First
        if (filterClass) {
            enrolledStudents = enrolledStudents.filter(s => s.class === filterClass);
        }

        const allResults = storage.results.getAll().filter(r => r.examId === selectedExamId);

        // 2. Map All Students to Status
        let tempRows: MonitorRow[] = enrolledStudents.map((s) => {
            // Find ALL attempts for this student
            const studentResults = allResults.filter(r => r.studentName === s.name);
            
            // Get the LATEST attempt (using slice().reverse().find() or grabbing last element)
            // Since getAll() pushes new items, the last one is the latest.
            const matchedResult = studentResults.length > 0 ? studentResults[studentResults.length - 1] : null;

            let status: MonitorRow['status'] = 'offline';
            let score: number | string = 0;
            let violations = 0;

            if (matchedResult) {
                status = 'done';
                score = Math.round(matchedResult.score);
                violations = matchedResult.violationCount;
            } else {
                // Mock Live Status logic (In real app, check via socket/firebase)
                const isLive = Math.random() > 0.8; // Simulation
                if (isLive) {
                    status = 'online';
                    score = 'Sedang Mengerjakan';
                    violations = Math.random() > 0.95 ? Math.floor(Math.random() * 3) + 1 : 0;
                }
            }

            return {
                no: 0, // Placeholder, will assign later
                name: s.name,
                nis: s.nis,
                nisn: s.nisn,
                class: s.class,
                score: score,
                status: status,
                violationCount: violations
            };
        });

        // 3. Filter based on Status
        if (filterStatus === 'done') {
            tempRows = tempRows.filter(r => r.status === 'done');
        } else if (filterStatus === 'not_done') {
            tempRows = tempRows.filter(r => r.status !== 'done');
        }

        // 4. Re-assign Numbering (1 to N based on visible rows)
        const finalRows = tempRows.map((r, idx) => ({ ...r, no: idx + 1 }));

        setRows(finalRows);
    };

    // Initial load when selection changes
    useEffect(() => {
        refreshData();
    }, [selectedExamId, filterClass, filterStatus]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 border-blue-500">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                    <h2 className="text-xl font-bold whitespace-nowrap">Monitoring Ujian</h2>
                    {teacherCategory && <span className="text-xs text-gray-500">Menampilkan ujian kategori: <b>{teacherCategory}</b></span>}
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                     {/* Exam Selector */}
                     <select 
                        className="border p-2 rounded w-full md:w-56 text-sm"
                        value={selectedExamId}
                        onChange={e => { setSelectedExamId(e.target.value); setFilterClass(''); }}
                    >
                        {activeExams.length === 0 && <option>Tidak ada ujian aktif</option>}
                        {activeExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>

                    {/* Class Filter */}
                    <div className="flex items-center gap-2">
                        <select 
                            className="border p-2 rounded text-sm"
                            value={filterClass}
                            onChange={e => setFilterClass(e.target.value)}
                        >
                            <option value="">Semua Kelas</option>
                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <select 
                            className={`border p-2 rounded text-sm font-bold ${
                                filterStatus === 'done' ? 'bg-green-50 text-green-700 border-green-300' :
                                filterStatus === 'not_done' ? 'bg-red-50 text-red-700 border-red-300' :
                                'bg-white text-gray-700'
                            }`}
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Semua Status</option>
                            <option value="done">✅ Sudah Mengerjakan</option>
                            <option value="not_done">⏳ Belum Mengerjakan</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-800 text-white text-sm uppercase">
                            <tr>
                                <th className="p-3 w-12 text-center">No</th>
                                <th className="p-3">Nama Siswa</th>
                                <th className="p-3">NIS</th>
                                <th className="p-3">NISN</th>
                                <th className="p-3 w-20 text-center">Kelas</th>
                                <th className="p-3">Status Pengerjaan</th>
                                <th className="p-3 text-center">Skor</th>
                                <th className="p-3 text-center">Indikasi Kecurangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {rows.length === 0 ? (
                                <tr><td colSpan={8} className="p-6 text-center text-gray-500">Tidak ada data siswa sesuai filter.</td></tr>
                            ) : rows.map((row) => (
                                <tr key={row.no} className="hover:bg-gray-50">
                                    <td className="p-3 text-center font-bold text-gray-500">{row.no}</td>
                                    <td className="p-3 font-medium">{row.name}</td>
                                    <td className="p-3 text-gray-500">{row.nis}</td>
                                    <td className="p-3 text-gray-500">{row.nisn}</td>
                                    <td className="p-3 text-center">
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{row.class}</span>
                                    </td>
                                    <td className="p-3">
                                        {row.status === 'done' && <span className="text-green-600 font-bold">✅ Selesai</span>}
                                        {row.status === 'online' && <span className="text-blue-600 font-bold animate-pulse">🔵 Sedang Aktif</span>}
                                        {row.status === 'offline' && <span className="text-gray-400">⚫ Belum Login/Offline</span>}
                                    </td>
                                    <td className="p-3 text-center font-bold text-lg">
                                        {typeof row.score === 'number' ? row.score : '-'}
                                    </td>
                                    <td className="p-3 text-center">
                                        {row.violationCount === 0 ? (
                                            <span className="text-green-500 text-xs">Aman</span>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className={`px-3 py-1 rounded-full text-white font-bold text-xs ${
                                                    row.violationCount >= 3 ? 'bg-red-600' : 'bg-orange-500'
                                                }`}>
                                                    {row.violationCount}x Pindah Tab
                                                </span>
                                                {row.violationCount >= 3 && <span className="text-[10px] text-red-600 font-bold mt-1">DISQUALIFIED</span>}
                                            </div>
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

export default Monitoring;