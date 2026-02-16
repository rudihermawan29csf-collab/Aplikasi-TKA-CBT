import React, { useState, useEffect, useRef } from 'react';
import { storage, getApiUrl, setApiUrl } from '../../services/storageService';
import { SchoolSettings } from '../../types';
import { GAS_SCRIPT_TEMPLATE } from '../../services/gas_script_template';

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
  const codeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSettings(storage.settings.get());
    setLocalApiUrl(getApiUrl());
  }, []);

  const handleChange = (field: keyof SchoolSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    storage.settings.save(settings);
    // Trim whitespace and ensure valid formatting
    let cleanUrl = apiUrl.trim();
    if(cleanUrl && !cleanUrl.startsWith('http')) {
        alert("URL harus diawali dengan https://");
        return;
    }
    
    setApiUrl(cleanUrl); 
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    // Trigger sync
    if(cleanUrl) {
        setConnectionStatus('checking');
        storage.sync().then(success => {
            if(success) {
                setConnectionStatus('success');
            } else {
                setConnectionStatus('error');
                alert("Gagal terkoneksi! Pastikan:\n1. URL benar (berakhiran /exec)\n2. Deployment Apps Script diatur 'Anyone' (Siapa Saja) sebagai yang memiliki akses.");
            }
        });
    }
  };

  const handleCopyScript = () => {
      navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE).then(() => {
          alert("Kode berhasil disalin ke clipboard! Silakan paste di editor Apps Script.");
      }).catch(() => {
          if(codeRef.current) {
              codeRef.current.select();
              document.execCommand('copy');
              alert("Kode disorot. Silakan tekan Ctrl+C (Cmd+C) untuk menyalin.");
          }
      });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Pengaturan Aplikasi</h2>
        {saved && <span className="text-green-600 font-bold animate-pulse">Perubahan Tersimpan!</span>}
      </div>

      {/* API Connection Section */}
      <div className={`border-l-4 p-6 rounded-lg shadow transition-colors ${
          connectionStatus === 'error' ? 'bg-red-50 border-red-600' :
          connectionStatus === 'success' ? 'bg-green-50 border-green-600' :
          'bg-blue-50 border-blue-600'
      }`}>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              Koneksi Database (Google Apps Script)
              {connectionStatus === 'checking' && <span className="text-sm font-normal animate-pulse">Checking...</span>}
              {connectionStatus === 'success' && <span className="text-sm font-bold text-green-700">✅ Terhubung</span>}
              {connectionStatus === 'error' && <span className="text-sm font-bold text-red-700">❌ Gagal</span>}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
              Masukkan URL Web App dari Google Apps Script agar aplikasi ini bisa online dan menyimpan data ke Spreadsheet.
          </p>
          <div className="mb-4">
             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">URL Web App</label>
             <input 
                type="text" 
                value={apiUrl}
                onChange={e => setLocalApiUrl(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-3 font-mono text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                placeholder="https://script.google.com/macros/s/..../exec"
            />
          </div>

          <details className="group">
              <summary className="cursor-pointer text-sm font-bold text-blue-700 hover:text-blue-800 flex items-center gap-2 p-2 hover:bg-blue-100 rounded">
                  <span>📂</span> Lihat / Salin Kode Apps Script
              </summary>
              <div className="mt-3 bg-white p-4 rounded border border-blue-200 shadow-inner">
                  <div className="flex flex-col gap-2 mb-2">
                      <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200">
                          PENTING: Jangan menyalin "export const GAS_SCRIPT_TEMPLATE = `". <br/>
                          Hanya salin isi kode yang ada di dalam kotak abu-abu di bawah ini.
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500">Klik tombol di kanan untuk menyalin otomatis yang benar.</span>
                        <button onClick={handleCopyScript} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-bold flex items-center gap-1 shadow">
                            📋 Salin Kode
                        </button>
                      </div>
                  </div>
                  <textarea 
                    ref={codeRef}
                    readOnly
                    className="w-full h-80 bg-gray-900 text-green-400 p-4 rounded text-xs font-mono select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={GAS_SCRIPT_TEMPLATE}
                    onClick={(e) => e.currentTarget.select()}
                  />
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
                className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Judul Login</label>
              <input 
                type="text" 
                value={settings.loginTitle}
                onChange={e => handleChange('loginTitle', e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contoh: Try Out TKA 2026"
              />
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