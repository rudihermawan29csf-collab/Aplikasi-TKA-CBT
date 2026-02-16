import React, { useState, useEffect, useRef } from 'react';
import { storage, getApiUrl, setApiUrl } from '../../services/storageService';
import { SchoolSettings } from '../../types';
import { GAS_SCRIPT_TEMPLATE } from '../../services/gas_script_template';
import { MOCK_STUDENTS, MOCK_PACKETS, MOCK_QUESTIONS, MOCK_EXAMS } from '../../services/mockData';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SchoolSettings>({
    schoolName: '',
    loginTitle: '',
    academicYear: '',
    semester: '',
    adminPassword: '',
    teacherLiterasiPassword: '',
    teacherNumerasiPassword: ''
  });
  
  const [apiUrl, setLocalApiUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [dbStatus, setDbStatus] = useState<string>('');
  const codeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSettings(storage.settings.get());
    setLocalApiUrl(getApiUrl());
  }, []);

  const handleChange = (field: keyof SchoolSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const checkConnection = async (url: string) => {
    setConnectionStatus('checking');
    setDbStatus('Memeriksa koneksi...');
    
    const success = await storage.sync();
    
    if(success) {
        setConnectionStatus('success');
        const count = storage.students.getAll().length;
        setDbStatus(`Terhubung! Ditemukan ${count} siswa, ${storage.packets.getAll().length} paket soal.`);
    } else {
        setConnectionStatus('error');
        setDbStatus("Gagal. Pastikan URL benar dan Deployment diatur 'Anyone' (Siapa Saja).");
    }
  };

  const handleSave = () => {
    storage.settings.save(settings);
    
    let cleanUrl = apiUrl.trim();
    if(cleanUrl && !cleanUrl.startsWith('http')) {
        alert("URL harus diawali dengan https://");
        return;
    }
    
    setApiUrl(cleanUrl); 
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    if(cleanUrl) {
        checkConnection(cleanUrl);
    }
  };

  const handleCopyScript = () => {
      navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE).then(() => {
          alert("Kode berhasil disalin! Paste di Apps Script Editor.");
      });
  };

  const handleFixDatabase = async () => {
      const url = getApiUrl();
      if(!url) {
          alert("Simpan URL Web App terlebih dahulu.");
          return;
      }

      if(!confirm("Aksi ini akan memerintahkan Apps Script untuk membuat Sheet dan Header yang hilang. Lanjutkan?")) return;

      setDbStatus("Sedang memperbaiki struktur database...");
      try {
          // Send special 'setup' action
          await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'setup' })
          });
          
          setTimeout(() => {
             alert("Perintah setup dikirim. Tunggu sebentar lalu coba koneksi lagi.");
             checkConnection(url);
          }, 3000);

      } catch (e) {
          alert("Gagal mengirim perintah setup.");
      }
  };

  const handleSeedData = async () => {
       if(!confirm("Isi database dengan data contoh (Siswa, Soal, Jadwal)? Data lama tidak akan dihapus.")) return;
       
       setDbStatus("Sedang mengirim data contoh...");
       
       // Inject mock data sequentially to avoid overloading in no-cors mode
       // Note: In no-cors, we can't wait for real confirmation, so we just fire and forget with slight delays
       
       MOCK_STUDENTS.forEach(s => storage.students.add(s));
       await new Promise(r => setTimeout(r, 1000));
       
       MOCK_PACKETS.forEach(p => storage.packets.add(p));
       await new Promise(r => setTimeout(r, 1000));
       
       MOCK_QUESTIONS.forEach(q => storage.questions.add(q));
       await new Promise(r => setTimeout(r, 1000));
       
       MOCK_EXAMS.forEach(e => storage.exams.add(e));
       
       setTimeout(() => {
           alert("Data contoh dikirim. Silakan refresh halaman atau klik Simpan & Koneksikan.");
           checkConnection(getApiUrl());
       }, 4000);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Pengaturan & Database</h2>
        {saved && <span className="text-green-600 font-bold animate-pulse">Perubahan Tersimpan!</span>}
      </div>

      {/* API Connection Section */}
      <div className={`border-l-4 p-6 rounded-lg shadow transition-colors ${
          connectionStatus === 'error' ? 'bg-red-50 border-red-600' :
          connectionStatus === 'success' ? 'bg-green-50 border-green-600' :
          'bg-blue-50 border-blue-600'
      }`}>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              Koneksi Database (Google Spreadsheet)
              {connectionStatus === 'checking' && <span className="text-sm font-normal animate-pulse">Checking...</span>}
              {connectionStatus === 'success' && <span className="text-sm font-bold text-green-700">✅ Terhubung</span>}
              {connectionStatus === 'error' && <span className="text-sm font-bold text-red-700">❌ Gagal</span>}
          </h3>
          
          <div className="mb-4">
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">URL Web App (Apps Script)</label>
             <div className="flex gap-2">
                <input 
                    type="text" 
                    value={apiUrl}
                    onChange={e => setLocalApiUrl(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-md p-3 font-mono text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                    placeholder="https://script.google.com/macros/s/..../exec"
                />
                <button 
                    onClick={handleSave}
                    className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700"
                >
                    Tes Koneksi
                </button>
             </div>
             <p className="text-xs mt-2 font-mono text-gray-600">{dbStatus}</p>
          </div>

          {/* Database Tools */}
          <div className="flex flex-wrap gap-4 mt-4 border-t border-blue-200 pt-4">
              <button 
                onClick={handleFixDatabase}
                className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded shadow flex items-center gap-2"
                title="Klik jika data kosong padahal URL sudah benar"
              >
                  🛠️ Perbaiki Database (Buat Header & Default)
              </button>
               <button 
                onClick={handleSeedData}
                className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded shadow flex items-center gap-2"
                title="Isi database dengan data dummy untuk testing"
              >
                  🌱 Isi Data Contoh
              </button>
          </div>

          <details className="group mt-4">
              <summary className="cursor-pointer text-sm font-bold text-gray-600 hover:text-blue-800 flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                  <span>📜</span> Update Script (Wajib jika Judul Login tidak tersimpan)
              </summary>
              <div className="mt-3 bg-white p-4 rounded border border-gray-300 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-red-600 font-bold">Pastikan script di Apps Script Editor sesuai dengan kode ini:</span>
                    <button onClick={handleCopyScript} className="text-xs bg-gray-800 text-white px-3 py-1 rounded">Copy</button>
                  </div>
                  <textarea 
                    ref={codeRef}
                    readOnly
                    className="w-full h-40 bg-gray-900 text-green-400 p-2 rounded text-xs font-mono select-all"
                    value={GAS_SCRIPT_TEMPLATE}
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <p className="text-[10px] text-gray-500 mt-2">Versi 1.6: Perbaikan penyimpanan pengaturan (Login Title) dan database.</p>
              </div>
          </details>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identitas Sekolah */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 text-gray-700 border-b pb-2">Identitas Aplikasi</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nama Sekolah</label>
              <input 
                type="text" 
                value={settings.schoolName}
                onChange={e => handleChange('schoolName', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Judul Login</label>
              <input 
                type="text" 
                value={settings.loginTitle}
                onChange={e => handleChange('loginTitle', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2"
              />
              <p className="text-[10px] text-orange-600 mt-1">*Jika gagal tersimpan, silakan Update Script di atas.</p>
            </div>
             <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tahun Pelajaran</label>
                <input 
                  type="text" 
                  value={settings.academicYear}
                  onChange={e => handleChange('academicYear', e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Semester</label>
                <input 
                  type="text" 
                  value={settings.semester}
                  onChange={e => handleChange('semester', e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md p-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Keamanan */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-4 text-red-600 border-b pb-2">Keamanan & Password</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Password Admin</label>
              <input 
                type="text" 
                value={settings.adminPassword}
                onChange={e => handleChange('adminPassword', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password Guru Literasi</label>
              <input 
                type="text" 
                value={settings.teacherLiterasiPassword}
                onChange={e => handleChange('teacherLiterasiPassword', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 font-mono"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700">Password Guru Numerasi</label>
              <input 
                type="text" 
                value={settings.teacherNumerasiPassword}
                onChange={e => handleChange('teacherNumerasiPassword', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 font-mono"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end sticky bottom-0 bg-white/90 backdrop-blur p-4 border-t z-10">
        <button 
          onClick={handleSave} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center gap-2"
        >
          <span>💾</span> Simpan & Koneksikan
        </button>
      </div>
    </div>
  );
};

export default Settings;