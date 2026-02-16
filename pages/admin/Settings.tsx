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
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setSettings(storage.settings.get());
    setLocalApiUrl(getApiUrl());
  }, []);

  const handleChange = (field: keyof SchoolSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    storage.settings.save(settings);
    // Trim whitespace from URL just in case
    const cleanUrl = apiUrl.trim();
    setApiUrl(cleanUrl); 
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    
    // Trigger sync to verify connection immediately (optional)
    if(cleanUrl) {
        storage.sync().then(success => {
            if(success) alert("Koneksi ke Database Berhasil!");
            else alert("Pengaturan tersimpan, namun Gagal terkoneksi ke URL tersebut. Pastikan URL benar dan Deployment sudah 'Anyone' (Siapa Saja).");
        });
    }
  };

  const handleCopyScript = () => {
      navigator.clipboard.writeText(GAS_SCRIPT_TEMPLATE).then(() => {
          alert("Kode berhasil disalin ke clipboard! Silakan paste di editor Apps Script.");
      }).catch(() => {
          // Fallback if clipboard API fails
          if(codeRef.current) {
              const range = document.createRange();
              range.selectNode(codeRef.current);
              window.getSelection()?.removeAllRanges();
              window.getSelection()?.addRange(range);
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
      <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold mb-2 text-blue-800">Koneksi Database (Google Apps Script)</h3>
          <p className="text-sm text-gray-600 mb-4">
              Masukkan URL Web App dari Google Apps Script agar aplikasi ini bisa online dan menyimpan data ke Spreadsheet.
          </p>
          <div className="mb-4">
             <label className="text-xs font-bold text-blue-800 uppercase block mb-1">URL Web App</label>
             <input 
                type="text" 
                value={apiUrl}
                onChange={e => setLocalApiUrl(e.target.value)}
                className="w-full border border-blue-300 rounded-md p-3 font-mono text-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                placeholder="https://script.google.com/macros/s/..../exec"
            />
          </div>

          <details className="group">
              <summary className="cursor-pointer text-sm font-bold text-blue-700 hover:text-blue-800 flex items-center gap-2 p-2 hover:bg-blue-100 rounded">
                  <span>📂</span> Lihat / Salin Kode Apps Script
              </summary>
              <div className="mt-3 bg-white p-4 rounded border border-blue-200 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                      <p className="text-xs text-gray-500 font-medium">1. Salin semua kode di bawah. <br/>2. Paste di <b>script.google.com</b>. <br/>3. Simpan & Deploy sebagai Web App.</p>
                      <button onClick={handleCopyScript} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-bold flex items-center gap-1 shadow">
                          📋 Salin Semua Kode
                      </button>
                  </div>
                  <pre 
                    ref={codeRef}
                    className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto max-h-80 font-mono select-all whitespace-pre-wrap break-all"
                  >
                      {GAS_SCRIPT_TEMPLATE}
                  </pre>
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