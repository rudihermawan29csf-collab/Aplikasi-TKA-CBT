import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Student } from '../../types';

const StudentData: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [filterClass, setFilterClass] = useState<string>('');
  const [uniqueClasses, setUniqueClasses] = useState<string[]>([]);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const loadData = () => {
    const data = storage.students.getAll();
    setStudents(data);
    setUniqueClasses(Array.from(new Set(data.map(s => s.class))).sort());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = () => {
    if (formData.name && formData.class) {
      if (formData.id) {
        storage.students.update(formData.id, formData);
      } else {
        storage.students.add(formData as Student);
      }
      loadData();
      setIsModalOpen(false);
      setFormData({});
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus siswa ini?')) {
      storage.students.delete(id);
      loadData();
    }
  };

  const handleEdit = (student: Student) => {
    setFormData(student);
    setIsModalOpen(true);
  };

  const handleImport = () => {
      alert("Simulasi Import Excel: Membaca file dan menambahkan siswa...");
      // Mock importing data
      const newMock: Student = {
          id: '',
          no: (students.length + 1).toString(),
          name: 'Siswa Import Excel',
          class: '9Z',
          nis: '9999',
          nisn: '00000000'
      };
      storage.students.add(newMock);
      loadData();
      setFileInputKey(Date.now()); // Reset input
  };

  const handleDownloadTemplate = () => {
      alert("Mengunduh Template Excel (Simulasi)...");
  };

  const filteredStudents = filterClass 
    ? students.filter(s => s.class === filterClass)
    : students;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-2">
            <select 
                className="border p-2 rounded w-48 bg-white"
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
            >
                <option value="">Semua Kelas</option>
                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={handleDownloadTemplate}
                className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm flex items-center gap-1"
            >
                ⬇️ Template
            </button>
            <label className="bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700 text-sm flex items-center gap-1 cursor-pointer">
                📂 Import Excel
                <input 
                    key={fileInputKey}
                    type="file" 
                    accept=".xlsx, .xls" 
                    className="hidden" 
                    onChange={handleImport}
                />
            </label>
            <button
            onClick={() => { setFormData({}); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
            <span>+ Tambah Siswa</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">No</th>
              <th className="px-6 py-3">Nama</th>
              <th className="px-6 py-3">Kelas</th>
              <th className="px-6 py-3">NIS</th>
              <th className="px-6 py-3">NISN</th>
              <th className="px-6 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.length === 0 ? (
                <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">Tidak ada data siswa.</td>
                </tr>
            ) : filteredStudents.map((student, idx) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-500">{idx + 1}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{student.name}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                    {student.class}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{student.nis}</td>
                <td className="px-6 py-4 text-gray-500">{student.nisn}</td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                   <button onClick={() => handleEdit(student)} className="text-blue-600 hover:text-blue-900 text-sm font-medium">Edit</button>
                   <button onClick={() => handleDelete(student.id)} className="text-red-600 hover:text-red-900 text-sm font-medium">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h3 className="text-lg font-bold mb-4">{formData.id ? 'Edit Siswa' : 'Tambah Siswa'}</h3>
            <div className="space-y-3">
              <input className="w-full border p-2 rounded" placeholder="Nama Lengkap" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              <input className="w-full border p-2 rounded" placeholder="Kelas" value={formData.class || ''} onChange={e => setFormData({...formData, class: e.target.value})} />
              <input className="w-full border p-2 rounded" placeholder="NIS" value={formData.nis || ''} onChange={e => setFormData({...formData, nis: e.target.value})} />
              <input className="w-full border p-2 rounded" placeholder="NISN" value={formData.nisn || ''} onChange={e => setFormData({...formData, nisn: e.target.value})} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentData;
