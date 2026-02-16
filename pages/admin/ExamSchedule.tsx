import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Exam, Packet } from '../../types';

const ExamSchedule: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newExam, setNewExam] = useState<Partial<Exam>>({});
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    setExams(storage.exams.getAll());
    setPackets(storage.packets.getAll());
    
    const students = storage.students.getAll();
    const classes = Array.from(new Set(students.map(s => s.class))).sort();
    setAvailableClasses(classes);
  }, []);

  useEffect(() => {
      if (newExam.classTarget) {
          setSelectedClasses(newExam.classTarget.split(',').filter(Boolean));
      } else {
          setSelectedClasses([]);
      }
  }, [newExam.id]); // Reset when editing different exam or new

  const handleAddExam = () => {
    if (newExam.title && newExam.packetId && selectedClasses.length > 0) {
      const examData = {
          ...newExam,
          classTarget: selectedClasses.join(','),
          isActive: newExam.id ? newExam.isActive : true,
          questions: '[]'
      };

      if (newExam.id) {
          storage.exams.update(newExam.id, examData);
      } else {
          storage.exams.add(examData as Exam);
      }
      setExams(storage.exams.getAll());
      setShowModal(false);
      setNewExam({});
      setSelectedClasses([]);
    } else {
        alert("Mohon lengkapi data dan pilih minimal satu kelas.");
    }
  };

  const handleDeleteExam = (id: string) => {
      if(confirm("Hapus jadwal ujian ini?")) {
          storage.exams.delete(id);
          setExams(storage.exams.getAll());
      }
  };

  const handleEditExam = (exam: Exam) => {
      setNewExam(exam);
      setSelectedClasses(exam.classTarget.split(','));
      setShowModal(true);
  };

  const toggleStatus = (id: string, currentStatus: boolean) => {
    storage.exams.update(id, { isActive: !currentStatus });
    setExams(storage.exams.getAll());
  };

  const handleClassSelection = (cls: string) => {
      if (selectedClasses.includes(cls)) {
          setSelectedClasses(selectedClasses.filter(c => c !== cls));
      } else {
          setSelectedClasses([...selectedClasses, cls]);
      }
  };

  const handleSelectAllClasses = () => {
      if (selectedClasses.length === availableClasses.length) {
          setSelectedClasses([]);
      } else {
          setSelectedClasses([...availableClasses]);
      }
  };

  const getPacketName = (id: string) => packets.find(p => p.id === id)?.name || "Paket Tidak Ditemukan";
  const getPacketCount = (id: string) => packets.find(p => p.id === id)?.totalQuestions || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Jadwal Ujian</h2>
        <button 
          onClick={() => { setNewExam({}); setSelectedClasses([]); setShowModal(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          + Jadwalkan Ujian
        </button>
      </div>

      <div className="grid gap-4">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500 flex flex-col md:flex-row justify-between items-start md:items-center group gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800">{exam.title}</h3>
              <p className="text-sm font-semibold text-blue-600 mt-1">
                  📦 {getPacketName(exam.packetId)} • {getPacketCount(exam.packetId)} Soal
              </p>
              <div className="text-sm text-gray-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <span>🗓️ Mulai: {new Date(exam.scheduledStart).toLocaleString('id-ID')}</span>
                <span>🏁 Selesai: {new Date(exam.scheduledEnd).toLocaleString('id-ID')}</span>
                <span>⏱️ Durasi: {exam.durationMinutes} Menit</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                  {exam.classTarget.split(',').map(c => (
                      <span key={c} className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600 border">{c}</span>
                  ))}
              </div>
            </div>
            <div className="flex items-center gap-4 self-end md:self-center">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${exam.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {exam.isActive ? 'Aktif' : 'Non-Aktif'}
              </span>
              <button 
                onClick={() => toggleStatus(exam.id, exam.isActive)}
                className="text-sm underline text-blue-600"
              >
                {exam.isActive ? 'Matikan' : 'Aktifkan'}
              </button>
              <div className="border-l pl-4 flex gap-2">
                  <button onClick={() => handleEditExam(exam)} className="text-gray-500 hover:text-blue-600">✏️</button>
                  <button onClick={() => handleDeleteExam(exam.id)} className="text-gray-500 hover:text-red-600">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-[600px] max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">{newExam.id ? 'Edit Jadwal' : 'Buat Jadwal Baru'}</h3>
            <div className="space-y-4">
              <input 
                className="w-full border p-2 rounded" 
                placeholder="Judul Ujian"
                value={newExam.title || ''}
                onChange={e => setNewExam({...newExam, title: e.target.value})}
              />
              <select 
                className="w-full border p-2 rounded"
                value={newExam.packetId || ''}
                onChange={e => setNewExam({...newExam, packetId: e.target.value})}
              >
                <option value="">Pilih Paket Soal</option>
                {packets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.totalQuestions} Soal)</option>)}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs text-gray-500">Mulai</label>
                   <input 
                    type="datetime-local" 
                    className="w-full border p-2 rounded" 
                    value={newExam.scheduledStart ? new Date(newExam.scheduledStart).toISOString().slice(0, 16) : ''}
                    onChange={e => setNewExam({...newExam, scheduledStart: e.target.value})} 
                   />
                </div>
                <div>
                   <label className="text-xs text-gray-500">Selesai</label>
                   <input 
                    type="datetime-local" 
                    className="w-full border p-2 rounded" 
                    value={newExam.scheduledEnd ? new Date(newExam.scheduledEnd).toISOString().slice(0, 16) : ''}
                    onChange={e => setNewExam({...newExam, scheduledEnd: e.target.value})} 
                   />
                </div>
              </div>
              <input 
                className="w-full border p-2 rounded" 
                placeholder="Durasi (menit)"
                type="number"
                value={newExam.durationMinutes || ''}
                onChange={e => setNewExam({...newExam, durationMinutes: Number(e.target.value)})}
              />
              
              <div className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Kelas Target</label>
                    <button onClick={handleSelectAllClasses} className="text-xs text-blue-600 hover:underline">
                        {selectedClasses.length === availableClasses.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                      {availableClasses.map(cls => (
                          <label key={cls} className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border hover:border-blue-400">
                              <input 
                                type="checkbox" 
                                checked={selectedClasses.includes(cls)}
                                onChange={() => handleClassSelection(cls)}
                                className="accent-blue-600"
                              />
                              <span className="text-sm font-medium">{cls}</span>
                          </label>
                      ))}
                  </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600">Batal</button>
              <button onClick={handleAddExam} className="px-4 py-2 bg-blue-600 text-white rounded">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamSchedule;
