import React, { useState, useEffect } from 'react';
import { UserRole, Student, SchoolSettings } from '../types';
import { storage } from '../services/storageService';

interface LoginProps {
  onLogin: (role: UserRole, username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  // Initialize directly to ensure data is available on first render
  const [settings, setSettings] = useState<SchoolSettings>(storage.settings.get());
  
  // State for Admin
  const [password, setPassword] = useState('');

  // State for Teacher
  const [teacherCategory, setTeacherCategory] = useState<'Literasi' | 'Numerasi'>('Literasi');

  // State for Student
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Initial fetch
    setSettings(storage.settings.get());

    // PERBAIKAN: Polling setiap 1.5 detik untuk cek update dari background sync App.tsx
    // Ini memastikan jika judul/nama sekolah baru saja tersinkron, tampilan langsung berubah
    const settingsInterval = setInterval(() => {
        const freshSettings = storage.settings.get();
        // Cek sederhana apakah ada perubahan, jika mau lebih efisien bisa compare JSON string
        if (freshSettings.schoolName !== settings.schoolName || freshSettings.loginTitle !== settings.loginTitle) {
             setSettings(freshSettings);
        }
    }, 1500);

    if (role === UserRole.STUDENT) {
      loadStudents();
    } else {
      setPassword('');
    }

    return () => clearInterval(settingsInterval);
  }, [role, settings.schoolName, settings.loginTitle]); // Dependencies untuk re-check

  const loadStudents = () => {
      const data = storage.students.getAll();
      setStudents(data);
      const uniqueClasses = Array.from(new Set(data.map(s => s.class))).sort();
      setClasses(uniqueClasses);
      // Jangan reset selectedClass jika user sedang memilih
      if (!selectedClass) setSelectedClass('');
      if (!selectedStudentId) setSelectedStudentId('');
  };

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await storage.sync(); // Force re-sync
      setSettings(storage.settings.get()); // Update settings
      loadStudents(); // Update students
      setIsRefreshing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Refresh settings one last time before checking password
    const currentSettings = storage.settings.get();

    if (role === UserRole.ADMIN) {
      if (password === currentSettings.adminPassword) {
        onLogin(role, 'Administrator');
      } else {
        alert('Password Administrator Salah!');
      }
    } 
    else if (role === UserRole.TEACHER) {
      const pass = password.trim();
      if (teacherCategory === 'Literasi') {
        if (pass === currentSettings.teacherLiterasiPassword) {
            onLogin(role, 'Guru Literasi');
        } else {
            alert('Password Guru Literasi salah!');
        }
      } else if (teacherCategory === 'Numerasi') {
        if (pass === currentSettings.teacherNumerasiPassword) {
            onLogin(role, 'Guru Numerasi');
        } else {
            alert('Password Guru Numerasi salah!');
        }
      }
    } 
    else if (role === UserRole.STUDENT) {
      if (selectedStudentId) {
        const student = students.find(s => s.id === selectedStudentId);
        if (student) {
          onLogin(role, student.name);
        }
      } else {
        alert('Mohon pilih nama siswa.');
      }
    }
  };

  const filteredStudents = selectedClass 
    ? students.filter(s => s.class === selectedClass) 
    : [];

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-900"
      style={{ 
        backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2864&auto=format&fit=crop')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-filter backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl overflow-hidden p-8 text-center ring-1 ring-white/10">
            
            <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md shadow-lg border border-white/20 p-3">
                   <img 
                       src="https://image2url.com/r2/default/images/1769001049680-d981c280-6340-4989-8563-7b08134c189a.png" 
                       alt="Logo Sekolah" 
                       className="w-full h-full object-contain drop-shadow-md"
                   />
                </div>
            </div>

            <h1 className="text-3xl font-extrabold text-white mb-1 drop-shadow-lg tracking-tight">
                {settings.loginTitle || "CBT Online"}
            </h1>
            <p className="text-purple-100 font-medium text-sm mb-8 drop-shadow-md tracking-wide opacity-90">
                {settings.schoolName || "Sekolah"} • {settings.academicYear} {settings.semester}
            </p>

            <div className="bg-black/20 p-1 rounded-xl flex mb-6 backdrop-blur-md border border-white/10">
                {[UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].map((r) => (
                    <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-lg transition-all duration-300 ${
                        role === r
                        ? 'bg-white text-gray-900 shadow-md scale-100'
                        : 'text-white/70 hover:bg-white/10 hover:text-white scale-95'
                    }`}
                    >
                    {r === UserRole.STUDENT ? 'Siswa' : r === UserRole.TEACHER ? 'Guru' : 'Admin'}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-left">
                {role === UserRole.STUDENT ? (
                    <>
                    <div className="space-y-1 group">
                        <div className="flex justify-between items-end">
                            <label className="text-white text-[10px] font-bold ml-1 uppercase tracking-wider opacity-90">Kelas</label>
                            <button 
                                type="button" 
                                onClick={handleManualRefresh}
                                className={`text-[10px] text-blue-300 hover:text-white underline ${isRefreshing ? 'animate-pulse' : ''}`}
                            >
                                {isRefreshing ? 'Memuat...' : '🔄 Refresh Data'}
                            </button>
                        </div>
                        <div className="relative">
                            <select
                                value={selectedClass}
                                onChange={(e) => {
                                    setSelectedClass(e.target.value);
                                    setSelectedStudentId('');
                                }}
                                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-white/50 focus:bg-black/30 outline-none text-white placeholder-white/50 backdrop-blur-sm transition-all appearance-none cursor-pointer hover:bg-black/30 font-medium"
                                required
                            >
                                <option value="" className="text-gray-900 bg-white">Pilih Kelas</option>
                                {classes.map(c => <option key={c} value={c} className="text-gray-900 bg-white">{c}</option>)}
                            </select>
                            <div className="absolute right-4 top-3.5 pointer-events-none text-white/80">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1 group">
                        <label className="text-white text-[10px] font-bold ml-1 uppercase tracking-wider opacity-90">Nama Siswa</label>
                        <div className="relative">
                            <select
                                value={selectedStudentId}
                                onChange={(e) => setSelectedStudentId(e.target.value)}
                                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-white/50 focus:bg-black/30 outline-none text-white placeholder-white/50 backdrop-blur-sm transition-all disabled:opacity-50 appearance-none cursor-pointer hover:bg-black/30 font-medium"
                                disabled={!selectedClass}
                                required
                            >
                                <option value="" className="text-gray-900 bg-white">
                                    {students.length === 0 ? "Data Kosong (Klik Refresh)" : "Pilih Nama"}
                                </option>
                                {filteredStudents.map(s => (
                                    <option key={s.id} value={s.id} className="text-gray-900 bg-white">{s.name} ({s.nis})</option>
                                ))}
                            </select>
                             <div className="absolute right-4 top-3.5 pointer-events-none text-white/80">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    </>
                ) : (
                    <>
                    {role === UserRole.TEACHER && (
                        <div className="space-y-1 group">
                             <label className="text-white text-[10px] font-bold ml-1 uppercase tracking-wider opacity-90">Kategori / Mata Pelajaran</label>
                             <div className="relative">
                                <select
                                    value={teacherCategory}
                                    onChange={(e) => setTeacherCategory(e.target.value as 'Literasi' | 'Numerasi')}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-white/50 focus:bg-black/30 outline-none text-white placeholder-white/50 backdrop-blur-sm transition-all appearance-none cursor-pointer hover:bg-black/30 font-medium"
                                >
                                    <option value="Literasi" className="text-gray-900 bg-white">Guru Literasi</option>
                                    <option value="Numerasi" className="text-gray-900 bg-white">Guru Numerasi</option>
                                </select>
                                <div className="absolute right-4 top-3.5 pointer-events-none text-white/80">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {role === UserRole.ADMIN && (
                        <div className="space-y-1 group">
                            <label className="text-white text-[10px] font-bold ml-1 uppercase tracking-wider opacity-90">Username</label>
                            <input
                                type="text"
                                value="admin"
                                readOnly
                                className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white/50 cursor-not-allowed text-center font-mono tracking-wider font-bold"
                            />
                        </div>
                    )}

                    <div className="space-y-1 group">
                        <label className="text-white text-[10px] font-bold ml-1 uppercase tracking-wider opacity-90">Password</label>
                        <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-white/50 focus:bg-black/30 outline-none text-white placeholder-white/50 backdrop-blur-sm transition-all font-medium"
                        placeholder="••••••••"
                        required
                        />
                    </div>
                    </>
                )}

                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-purple-900/30 backdrop-blur-sm transform hover:scale-[1.02] active:scale-[0.98] transition-all mt-6 border border-white/20"
                >
                    Masuk Aplikasi
                </button>
            </form>
            
            <div className="mt-8 flex items-center justify-center gap-2 text-white/40 text-[10px] font-light uppercase tracking-widest">
                <span>Secured by CBT System</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;