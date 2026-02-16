import React, { useState } from 'react';
import { UserRole } from './types';
import { storage } from './services/storageService'; // Import storage
import Login from './pages/Login';
import Layout from './components/Layout';
import StudentData from './pages/admin/StudentData';
import QuestionBank from './pages/admin/QuestionBank';
import ExamSchedule from './pages/admin/ExamSchedule';
import Analysis from './pages/admin/Analysis';
import Settings from './pages/admin/Settings';
import Monitoring from './pages/admin/Monitoring';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentExamList from './pages/student/StudentExamList'; // Import new component
import ExamInterface from './pages/student/ExamInterface';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string>('');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeExamId, setActiveExamId] = useState<string | null>(null);

  const handleLogin = (selectedRole: UserRole, user: string) => {
    setRole(selectedRole);
    setUsername(user);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setRole(null);
    setUsername('');
    setActiveExamId(null);
  };

  const renderContent = () => {
    // Pass username to ExamInterface so results are saved correctly
    if (activeExamId && role === UserRole.STUDENT) {
        return <ExamInterface examId={activeExamId} username={username} onFinish={() => { setActiveExamId(null); setCurrentPage('dashboard'); }} />;
    }

    if (role === UserRole.STUDENT) {
        // Student Routes
        switch(currentPage) {
            case 'dashboard': return <StudentDashboard username={username} />;
            case 'exam_list': return <StudentExamList username={username} onStartExam={setActiveExamId} />;
            case 'results': return <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-white/40 shadow-xl">Halaman Hasil Ujian (Lihat Dashboard untuk ringkasan)</div>;
            default: return <StudentDashboard username={username} />;
        }
    }

    // Admin & Teacher Routes
    switch (currentPage) {
      case 'dashboard':
        // Calculate Real Stats
        const studentCount = storage.students.getAll().length;
        const activeExamsCount = storage.exams.getAll().filter(e => e.isActive).length;
        const packets = storage.packets.getAll();
        const literasiCount = packets.filter(p => p.category === 'Literasi').length;
        const numerasiCount = packets.filter(p => p.category === 'Numerasi').length;

        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-800 drop-shadow-sm mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Total Siswa */}
                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/50 flex items-center justify-between hover:transform hover:scale-[1.02] transition-all duration-300 group">
                <div>
                    <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider">Total Siswa</h3>
                    <p className="text-4xl font-extrabold mt-2 text-gray-800 group-hover:text-blue-600 transition-colors">{studentCount}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Data siswa terdaftar</p>
                </div>
                <div className="w-16 h-16 bg-blue-100/50 rounded-2xl flex items-center justify-center text-4xl shadow-inner text-blue-600">👥</div>
                </div>

                {/* Card 2: Ujian Aktif */}
                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/50 flex items-center justify-between hover:transform hover:scale-[1.02] transition-all duration-300 group">
                <div>
                    <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider">Ujian Aktif</h3>
                    <p className="text-4xl font-extrabold mt-2 text-gray-800 group-hover:text-green-600 transition-colors">{activeExamsCount}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">Sesuai jadwal ujian</p>
                </div>
                <div className="w-16 h-16 bg-green-100/50 rounded-2xl flex items-center justify-center text-4xl shadow-inner text-green-600">📅</div>
                </div>

                {/* Card 3: Paket Soal (Literasi & Numerasi) */}
                <div className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/50 hover:transform hover:scale-[1.02] transition-all duration-300">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-gray-500 font-bold uppercase text-xs tracking-wider">Paket Soal</h3>
                    <div className="text-2xl opacity-50">📚</div>
                </div>
                <div className="flex items-center gap-4 mt-4">
                    <div className="flex-1 bg-purple-100/60 p-3 rounded-xl border border-purple-200/50 text-center shadow-sm">
                        <span className="block text-2xl font-bold text-purple-700">{literasiCount}</span>
                        <span className="text-[10px] text-purple-900/60 uppercase font-bold tracking-wider">Literasi</span>
                    </div>
                    <div className="flex-1 bg-orange-100/60 p-3 rounded-xl border border-orange-200/50 text-center shadow-sm">
                        <span className="block text-2xl font-bold text-orange-700">{numerasiCount}</span>
                        <span className="text-[10px] text-orange-900/60 uppercase font-bold tracking-wider">Numerasi</span>
                    </div>
                </div>
                </div>
            </div>
          </div>
        );
      case 'students':
        return role === UserRole.ADMIN ? <StudentData /> : <div>Access Denied</div>;
      case 'bank_soal':
        return <QuestionBank />;
      case 'schedule':
        return <ExamSchedule />;
      case 'analysis':
        return <Analysis />;
      case 'settings':
        return role === UserRole.ADMIN ? <Settings /> : <div>Access Denied</div>;
      case 'monitoring':
        return <Monitoring />;
      default:
        return <div>Page not found</div>;
    }
  };

  if (!role) {
    return <Login onLogin={handleLogin} />;
  }

  // If taking exam, render without layout wrapper to maximize screen
  if (activeExamId && role === UserRole.STUDENT) {
      return renderContent();
  }

  return (
    <Layout 
      role={role} 
      user={{ name: username }} 
      onLogout={handleLogout}
      currentPage={currentPage}
      onNavigate={setCurrentPage}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
