import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Exam, Student, Result } from '../../types';

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

const Monitoring: React.FC = () => {
    const [activeExams, setActiveExams] = useState<Exam[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [filterClass, setFilterClass] = useState<string>('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    
    // Data Table
    const [rows, setRows] = useState<MonitorRow[]>([]);
    
    // Auto-refresh simulation
    useEffect(() => {
        const interval = setInterval(() => {
             refreshData();
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedExamId, filterClass]);

    useEffect(() => {
        const exams = storage.exams.getAll(); // Show all exams, not just active, so we can monitor finished ones too if needed
        setActiveExams(exams);
        if (exams.length > 0) setSelectedExamId(exams[0].id);
    }, []);

    const refreshData = () => {
        if (!selectedExamId) return;
        
        const exam = activeExams.find(e => e.id === selectedExamId);
        if (!exam) return;

        const targetClasses = exam.classTarget.split(',');
        setAvailableClasses(targetClasses);

        let enrolledStudents = storage.students.getAll().filter(s => targetClasses.includes(s.class));
        
        if (filterClass) {
            enrolledStudents = enrolledStudents.filter(s => s.class === filterClass);
        }

        const allResults = storage.results.getAll().filter(r => r.examId === selectedExamId);

        const newRows: MonitorRow[] = enrolledStudents.map((s, idx) => {
            const res = allResults.find(r => r.studentId === 'demo-student-id' && r.studentClass === s.class); // In real app, match by ID
            // Mocking matching logic since mock data doesn't have consistent IDs
            // We'll try to match results loosely for demo
            const matchedResult = allResults.find(r => r.studentName === s.name) || null;

            let status: MonitorRow['status'] = 'offline';
            let score: number | string = 0;
            let violations = 0;

            if (matchedResult) {
                status = 'done';
                score = matchedResult.score;
                violations = matchedResult.violationCount;
            } else {
                // Mock Live Status logic
                const isLive = Math.random() > 0.7; // Simulation
                if (isLive) {
                    status = 'online';
                    score = 'Sedang Mengerjakan';
                    // Randomly assign violations for demo
                    violations = Math.random() > 0.9 ? Math.floor(Math.random() * 3) + 1 : 0;
                }
            }

            return {
                no: idx + 1,
                name: s.name,
                nis: s.nis,
                nisn: s.nisn,
                class: s.class,
                score: score,
                status: status,
                violationCount: violations
            };
        });

        setRows(newRows);
    };

    // Initial load
    useEffect(() => {
        refreshData();
    }, [selectedExamId, filterClass]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <h2 className="text-xl font-bold whitespace-nowrap">Monitoring Ujian</h2>
                    <select 
                        className="border p-2 rounded w-full md:w-64"
                        value={selectedExamId}
                        onChange={e => { setSelectedExamId(e.target.value); setFilterClass(''); }}
                    >
                        {activeExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-500">Filter Kelas:</span>
                    <select 
                        className="border p-2 rounded"
                        value={filterClass}
                        onChange={e => setFilterClass(e.target.value)}
                    >
                        <option value="">Semua Kelas</option>
                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
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
                                <tr><td colSpan={8} className="p-6 text-center text-gray-500">Tidak ada data siswa.</td></tr>
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
