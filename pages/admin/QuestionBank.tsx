import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Packet, Question, QuestionType, UserRole } from '../../types';

// Data Structure Helpers
interface BSItem {
    left: string;
    right: string; // 'a' = Option 1 (Benar), 'b' = Option 2 (Salah)
}

interface QuestionBankProps {
    userRole: UserRole | null;
    username: string;
}

const QuestionBank: React.FC<QuestionBankProps> = ({ userRole, username }) => {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<string | null>(null);
  
  // Modal States
  const [isPacketModalOpen, setIsPacketModalOpen] = useState(false);
  const [packetForm, setPacketForm] = useState<Partial<Packet>>({});
  
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState<Partial<Question>>({ 
      type: QuestionType.MULTIPLE_CHOICE, 
      options: '[]', 
      correctAnswerIndex: 0 
  });
  
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [stimulusType, setStimulusType] = useState<'text' | 'image'>('text');

  // Specific state for True/False (Benar/Salah Tabel)
  const [bsOptions, setBsOptions] = useState<string[]>(["Benar", "Salah"]);
  const [bsItems, setBsItems] = useState<BSItem[]>([{ left: "", right: "a" }]);

  // Determine teacher category based on login name
  const teacherCategory = userRole === UserRole.TEACHER 
    ? (username.includes('Literasi') ? 'Literasi' : (username.includes('Numerasi') ? 'Numerasi' : null))
    : null;

  useEffect(() => {
    let allPackets = storage.packets.getAll();
    
    // Filter packets if Teacher
    if (userRole === UserRole.TEACHER && teacherCategory) {
        allPackets = allPackets.filter(p => p.category === teacherCategory);
    }
    
    setPackets(allPackets);

    if (selectedPacketId) {
      setQuestions(storage.questions.getByPacketId(selectedPacketId));
    }
  }, [selectedPacketId, userRole, username]);

  // --- Helper to Auto Update Packet Metadata (Total & Types) ---
  const updatePacketMetadata = (packetId: string) => {
      const packetQuestions = storage.questions.getByPacketId(packetId);
      
      // 1. Calculate Total Questions (Based on highest number)
      const maxNumber = packetQuestions.length > 0 
          ? Math.max(...packetQuestions.map(q => q.number)) 
          : 0;
      
      // 2. Calculate Question Types Summary (e.g. "PG: 10, BS: 5")
      const typeCounts: Record<string, number> = {};
      packetQuestions.forEach(q => {
          const typeLabel = q.type; // Uses values from Enum (PG, PGK, BS, etc)
          typeCounts[typeLabel] = (typeCounts[typeLabel] || 0) + 1;
      });

      const typeString = Object.entries(typeCounts)
          .map(([type, count]) => `${type}:${count}`)
          .join(', ');

      const currentPacket = storage.packets.getAll().find(p => p.id === packetId);
      
      // Update if data changed
      if (currentPacket) {
          if (currentPacket.totalQuestions !== maxNumber || currentPacket.questionTypes !== typeString) {
              const updatedPacket = { 
                  ...currentPacket, 
                  totalQuestions: maxNumber,
                  questionTypes: typeString 
              };
              storage.packets.update(packetId, updatedPacket);
              
              // Update local state immediately
              setPackets(prev => prev.map(p => p.id === packetId ? updatedPacket : p));
          }
      }
  };

  // --- Packet Handlers ---
  const handleOpenPacketModal = () => {
      // Setup for NEW packet
      setPacketForm({
          category: teacherCategory || '',
          totalQuestions: 0 // Default value
      });
      setIsPacketModalOpen(true);
  };

  const handleEditPacket = () => {
      // Setup for EXISTING packet
      const current = packets.find(p => p.id === selectedPacketId);
      if (current) {
          setPacketForm(current);
          setIsPacketModalOpen(true);
      }
  };

  const handleSavePacket = () => {
      if (packetForm.name && packetForm.category) {
          if (packetForm.id) {
              storage.packets.update(packetForm.id, packetForm);
          } else {
              storage.packets.add({ 
                  ...packetForm,
                  totalQuestions: packetForm.totalQuestions || 0, 
                  questionTypes: '' 
              } as Packet);
          }
          
          // Refresh list with filters
          let allPackets = storage.packets.getAll();
          if (userRole === UserRole.TEACHER && teacherCategory) {
              allPackets = allPackets.filter(p => p.category === teacherCategory);
          }
          setPackets(allPackets);
          
          setIsPacketModalOpen(false);
          setPacketForm({});
      } else {
          alert("Nama dan Kategori wajib diisi");
      }
  };

  const handleDeletePacket = (id: string) => {
      if (confirm("Hapus paket soal ini beserta seluruh soal di dalamnya?")) {
          // 1. Delete the packet
          storage.packets.delete(id);
          
          // 2. Delete all questions associated with this packet
          const packetQuestions = storage.questions.getByPacketId(id);
          packetQuestions.forEach(q => storage.questions.delete(q.id));

          // Refresh State
          let allPackets = storage.packets.getAll();
          if (userRole === UserRole.TEACHER && teacherCategory) {
              allPackets = allPackets.filter(p => p.category === teacherCategory);
          }
          setPackets(allPackets);
          
          if (selectedPacketId === id) setSelectedPacketId(null);
      }
  };

  // --- Question Handlers ---
  const openAddQuestion = (number?: number) => {
      const existing = number ? questions.find(q => q.number === number) : null;
      
      if (existing) {
          setQuestionForm(existing);
          // Check if stimulus is URL/Base64 or text
          const isImg = existing.stimulus.startsWith('data:image') || existing.stimulus.startsWith('http');
          // But priority check if 'image' field is filled
          if(existing.image) {
               setStimulusType('image');
          } else {
               setStimulusType(isImg ? 'image' : 'text');
          }

          if (existing.type === QuestionType.TRUE_FALSE) {
              try {
                  const opts = JSON.parse(existing.options || '["Benar", "Salah"]');
                  setBsOptions(opts);
                  const pairs = JSON.parse(existing.matchingPairs || '[]');
                  if (pairs.length > 0) setBsItems(pairs);
                  else setBsItems([{ left: "", right: "a" }]);
              } catch (e) {
                  setBsOptions(["Benar", "Salah"]);
                  setBsItems([{ left: "", right: "a" }]);
              }
          }
      } else {
          // If creating a new question (not editing), find the next available number if not provided
          const nextNumber = number || (questions.length > 0 ? Math.max(...questions.map(q=>q.number)) + 1 : 1);

          setQuestionForm({
              packetId: selectedPacketId!,
              number: nextNumber,
              type: QuestionType.MULTIPLE_CHOICE,
              text: '',
              stimulus: '',
              image: '',
              options: '["", "", "", ""]',
              correctAnswerIndex: 0,
              correctAnswerIndices: '[]',
              matchingPairs: '[]',
              category: teacherCategory || 'Literasi'
          });
          setStimulusType('text');
          setBsOptions(["Benar", "Salah"]);
          setBsItems([{ left: "", right: "a" }]);
      }
      setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = () => {
      if (!questionForm.text) {
          alert("Pertanyaan wajib diisi!");
          return;
      }
      
      let finalOptions = questionForm.options;
      let finalPairs = questionForm.matchingPairs;

      if (questionForm.type === QuestionType.TRUE_FALSE) {
          finalOptions = JSON.stringify(bsOptions);
          finalPairs = JSON.stringify(bsItems);
      }

      const qToSave = { 
          ...questionForm, 
          options: finalOptions,
          matchingPairs: finalPairs,
          number: questionForm.number,
          id: questionForm.id || crypto.randomUUID()
      } as Question;
      
      if (questionForm.id) {
           storage.questions.delete(questionForm.id); // Remove old to update
      }
      storage.questions.add(qToSave);
      
      // AUTO UPDATE PACKET METADATA (Total & Types)
      if (selectedPacketId) {
          updatePacketMetadata(selectedPacketId);
      }

      setQuestions(storage.questions.getByPacketId(selectedPacketId!));
      setIsQuestionModalOpen(false);
  };

  const handleDeleteQuestion = (id: string) => {
      if (confirm("Hapus soal ini?")) {
          storage.questions.delete(id);
          
          // AUTO UPDATE PACKET METADATA (Total & Types)
          if (selectedPacketId) {
              updatePacketMetadata(selectedPacketId);
          }
          
          setQuestions(storage.questions.getByPacketId(selectedPacketId!));
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setQuestionForm({ ...questionForm, stimulus: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  // --- BS Handlers ---
  const addBsRow = () => setBsItems([...bsItems, { left: "", right: "a" }]);
  const removeBsRow = (idx: number) => setBsItems(bsItems.filter((_, i) => i !== idx));
  const updateBsRow = (idx: number, field: 'left'|'right', val: string) => {
      const newItems = [...bsItems];
      newItems[idx] = { ...newItems[idx], [field]: val };
      setBsItems(newItems);
  };

  const renderQuestionFormInput = () => {
      if (questionForm.type === QuestionType.TRUE_FALSE) {
          return (
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500">Label Opsi 1 (a)</label>
                          <input className="w-full border p-2 rounded" value={bsOptions[0]} onChange={e => { const n = [...bsOptions]; n[0] = e.target.value; setBsOptions(n); }} />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Label Opsi 2 (b)</label>
                          <input className="w-full border p-2 rounded" value={bsOptions[1]} onChange={e => { const n = [...bsOptions]; n[1] = e.target.value; setBsOptions(n); }} />
                      </div>
                  </div>
                  <table className="w-full text-sm border">
                      <thead className="bg-gray-100">
                          <tr>
                              <th className="p-2">Pernyataan</th>
                              <th className="p-2 w-32">Kunci</th>
                              <th className="p-2 w-10"></th>
                          </tr>
                      </thead>
                      <tbody>
                          {bsItems.map((item, idx) => (
                              <tr key={idx} className="border-t">
                                  <td className="p-2"><input className="w-full border p-1" value={item.left} onChange={e => updateBsRow(idx, 'left', e.target.value)} /></td>
                                  <td className="p-2">
                                      <select className="w-full border p-1" value={item.right} onChange={e => updateBsRow(idx, 'right', e.target.value)}>
                                          <option value="a">{bsOptions[0]}</option>
                                          <option value="b">{bsOptions[1]}</option>
                                      </select>
                                  </td>
                                  <td className="p-2 text-center"><button onClick={() => removeBsRow(idx)} className="text-red-500">x</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  <button onClick={addBsRow} className="text-sm text-blue-600 font-bold">+ Tambah Baris</button>
              </div>
          );
      }
      
      const opts = JSON.parse(questionForm.options || '[]');
      return (
          <div className="space-y-2 mt-2">
              {opts.map((opt: string, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                      {questionForm.type === QuestionType.MULTIPLE_CHOICE ? (
                          <input type="radio" name="pg" checked={questionForm.correctAnswerIndex === idx} onChange={() => setQuestionForm({...questionForm, correctAnswerIndex: idx})} />
                      ) : (
                          <input type="checkbox" checked={JSON.parse(questionForm.correctAnswerIndices || '[]').includes(idx)} onChange={() => {
                              const cur = JSON.parse(questionForm.correctAnswerIndices || '[]');
                              const next = cur.includes(idx) ? cur.filter((i:number) => i!==idx) : [...cur, idx];
                              setQuestionForm({...questionForm, correctAnswerIndices: JSON.stringify(next)});
                          }} />
                      )}
                      <input className="border p-1 rounded flex-1" value={opt} onChange={e => {
                          const n = [...opts]; n[idx] = e.target.value;
                          setQuestionForm({...questionForm, options: JSON.stringify(n)});
                      }} />
                  </div>
              ))}
              <button onClick={() => setQuestionForm({...questionForm, options: JSON.stringify([...opts, ""])})} className="text-xs text-blue-600 underline">+ Opsi</button>
          </div>
      );
  };

  const renderPreviewOptions = (q: Question) => {
    try {
        if (q.type === QuestionType.TRUE_FALSE) {
             const opts = JSON.parse(q.options || '["Benar","Salah"]');
             const pairs: BSItem[] = JSON.parse(q.matchingPairs || '[]');
             return (
                 <table className="w-full text-left text-sm border mt-2">
                     <thead>
                         <tr className="bg-gray-100">
                             <th className="p-2 border">Pernyataan</th>
                             <th className="p-2 border text-center w-24">{opts[0]}</th>
                             <th className="p-2 border text-center w-24">{opts[1]}</th>
                         </tr>
                     </thead>
                     <tbody>
                         {pairs.map((item, idx) => (
                             <tr key={idx} className="border-b">
                                 <td className="p-2">{item.left}</td>
                                 <td className="p-2 text-center border-l">{item.right === 'a' ? '✓' : ''}</td>
                                 <td className="p-2 text-center border-l">{item.right === 'b' ? '✓' : ''}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             );
        }
        const opts = JSON.parse(q.options);
        const correctIndices = JSON.parse(q.correctAnswerIndices || '[]');
        return (
            <div className="space-y-2 mt-2">
                {opts.map((opt: string, idx: number) => (
                    <div key={idx} className={`p-3 border rounded-lg flex items-center gap-3 ${
                        (q.correctAnswerIndex === idx || correctIndices.includes(idx)) ? 'bg-green-50 border-green-500' : 'bg-white'
                    }`}>
                        <div className="font-bold">{String.fromCharCode(65 + idx)}.</div>
                        <span>{opt}</span>
                        {(q.correctAnswerIndex === idx || correctIndices.includes(idx)) && <span className="text-green-600 font-bold ml-auto">KUNCI</span>}
                    </div>
                ))}
            </div>
        );
    } catch (e) {
        return <div className="text-red-500">Error rendering options</div>;
    }
  };

  // Logic for Dynamic Question Toggles
  const currentPacket = packets.find(p => p.id === selectedPacketId);
  const maxQuestionNumber = questions.length > 0 ? Math.max(...questions.map(q => q.number)) : 0;
  // Show toggles based on max of (Packet Settings OR Actual Question Count)
  const toggleCount = Math.max(currentPacket?.totalQuestions || 0, maxQuestionNumber);

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      <div className="col-span-3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between bg-gray-50 items-center">
          <h3 className="font-bold text-gray-800">Paket Soal</h3>
          <button onClick={handleOpenPacketModal} className="text-blue-600 text-sm font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">+ Baru</button>
        </div>
        
        {/* Category Indicator */}
        {teacherCategory && (
            <div className={`text-[10px] text-center py-1 font-bold text-white uppercase ${teacherCategory === 'Numerasi' ? 'bg-orange-500' : 'bg-blue-600'}`}>
                Mode Guru: {teacherCategory}
            </div>
        )}

        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {packets.length === 0 && <div className="text-center text-gray-400 text-xs py-4">Belum ada paket soal.</div>}
          {packets.map(p => (
            <div key={p.id} onClick={() => setSelectedPacketId(p.id)} className={`p-3 rounded cursor-pointer border transition-colors ${selectedPacketId === p.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-gray-50 border-transparent'}`}>
              <div className="font-medium text-gray-800">{p.name}</div>
              <div className="text-xs text-gray-500 flex justify-between mt-1">
                  <span>{p.category}</span>
                  <span>{p.totalQuestions} Soal</span>
              </div>
              {p.questionTypes && <div className="text-[10px] text-gray-400 mt-1 truncate">{p.questionTypes}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-9 bg-white rounded-lg shadow flex flex-col">
        {selectedPacketId ? (
          <>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                  <h3 className="font-bold text-gray-800 text-lg">{packets.find(p => p.id === selectedPacketId)?.name}</h3>
                  <div className="flex gap-2 items-center">
                     <span className={`text-[10px] px-2 py-0.5 rounded text-white font-bold ${packets.find(p => p.id === selectedPacketId)?.category === 'Numerasi' ? 'bg-orange-500' : 'bg-blue-600'}`}>
                        {packets.find(p => p.id === selectedPacketId)?.category}
                     </span>
                     <span className="text-xs text-gray-500 font-medium">ID: {selectedPacketId.substring(0,6)}...</span>
                  </div>
              </div>
              <div className="flex gap-2">
                  <button onClick={handleEditPacket} className="bg-yellow-500 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-yellow-600 shadow-sm flex items-center gap-1">
                      ✏️ Edit Paket
                  </button>
                  <button onClick={() => handleDeletePacket(selectedPacketId)} className="bg-red-500 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-red-600 shadow-sm flex items-center gap-1">
                      🗑️ Hapus Paket
                  </button>
                  <div className="w-px bg-gray-300 mx-1 h-8 self-center"></div>
                  <button onClick={() => openAddQuestion()} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 shadow-md flex items-center gap-1">
                      + Tambah Soal
                  </button>
              </div>
            </div>

            {/* Questions Toggle Area */}
            <div className="p-4 bg-gray-100 border-b">
                 <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                     {Array.from({ length: toggleCount }).map((_, i) => {
                            const num = i + 1;
                            const hasQ = questions.find(q => q.number === num);
                            return (
                                <button 
                                    key={num} 
                                    onClick={() => openAddQuestion(num)} 
                                    className={`w-9 h-9 rounded-lg border font-bold text-sm transition-all shadow-sm ${
                                        hasQ 
                                        ? 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50' 
                                        : 'bg-gray-200 text-gray-400 border-gray-300 hover:bg-gray-300'
                                    }`}
                                    title={hasQ ? "Edit Soal" : "Buat Soal Baru"}
                                >
                                    {num}
                                </button>
                            )
                     })}
                     {/* Add button at the end of toggle list */}
                     <button onClick={() => openAddQuestion()} className="w-9 h-9 rounded-lg border border-dashed border-blue-400 text-blue-600 bg-blue-50 font-bold hover:bg-blue-100" title="Tambah Nomor Baru">+</button>
                 </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
              {questions.length === 0 && <div className="text-center text-gray-400 py-10 italic">Belum ada butir soal. Silakan klik nomor atau tambah soal.</div>}
              {questions.sort((a,b)=>a.number-b.number).map(q => (
                <div key={q.id} className="border rounded-xl p-6 bg-white shadow-sm relative group hover:shadow-md transition-shadow">
                  <div className="absolute top-4 right-4 hidden group-hover:flex gap-2">
                      <button onClick={() => openAddQuestion(q.number)} className="text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded font-bold hover:bg-blue-100">Edit</button>
                      <button onClick={() => setPreviewQuestion(q)} className="text-gray-600 text-xs bg-gray-100 px-2 py-1 rounded font-bold hover:bg-gray-200">Preview</button>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-600 text-xs bg-red-50 px-2 py-1 rounded font-bold hover:bg-red-100">Hapus</button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                      <span className="bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-full font-bold shadow-sm">{q.number}</span>
                      <span className="bg-gray-100 text-xs px-2 py-1 rounded text-gray-600 font-medium border">{q.type}</span>
                  </div>
                  <div className="whitespace-pre-wrap text-gray-800">{q.text}</div>
                </div>
              ))}
            </div>
          </>
        ) : <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-2">
            <span className="text-4xl">👈</span>
            <span>Pilih paket soal di sebelah kiri</span>
        </div>}
      </div>

      {isPacketModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl w-96 space-y-4 shadow-2xl">
                  <h3 className="font-bold text-lg text-gray-800 border-b pb-2">{packetForm.id ? 'Edit Paket Soal' : 'Buat Paket Soal Baru'}</h3>
                  <div>
                      <label className="text-xs font-bold text-gray-500">Nama Paket</label>
                      <input className="w-full border p-2 rounded mt-1" placeholder="Contoh: UTS Bahasa Indonesia" value={packetForm.name||''} onChange={e=>setPacketForm({...packetForm, name:e.target.value})} />
                  </div>
                  <div>
                       <label className="text-xs font-bold text-gray-500">Kategori</label>
                       <select 
                            className="w-full border p-2 rounded mt-1 bg-gray-50" 
                            value={packetForm.category||''} 
                            onChange={e=>setPacketForm({...packetForm, category:e.target.value})}
                            disabled={!!teacherCategory} // Disable if teacher
                       >
                            <option value="">Pilih Kategori</option>
                            <option value="Literasi">Literasi</option>
                            <option value="Numerasi">Numerasi</option>
                       </select>
                       {teacherCategory && <p className="text-[10px] text-blue-600 mt-1">* Kategori dikunci untuk akun Guru {teacherCategory}</p>}
                  </div>
                  <div>
                      <label className="text-xs font-bold text-gray-500">Jumlah Soal (Otomatis)</label>
                      <input 
                        type="number" 
                        className="w-full border p-2 rounded mt-1 bg-gray-100 text-gray-500 cursor-not-allowed" 
                        placeholder="Total nomor" 
                        value={packetForm.totalQuestions||0} 
                        readOnly 
                      />
                      <p className="text-[10px] text-blue-600 mt-1">* Jumlah soal akan otomatis terupdate saat Anda menambahkan soal.</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={()=>setIsPacketModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                      <button onClick={handleSavePacket} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow">Simpan</button>
                  </div>
              </div>
          </div>
      )}

      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg w-[900px] h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between mb-4 border-b pb-2"><h3 className="font-bold text-lg">Edit Soal No. {questionForm.number}</h3><button onClick={()=>setIsQuestionModalOpen(false)} className="text-gray-400 hover:text-gray-800 font-bold">✕</button></div>
              <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">Tipe Soal</label>
                          <select className="w-full border p-2 rounded" value={questionForm.type} onChange={e=>setQuestionForm({...questionForm, type:e.target.value as QuestionType})}>
                            <option value={QuestionType.MULTIPLE_CHOICE}>Pilihan Ganda</option>
                            <option value={QuestionType.COMPLEX_MULTIPLE_CHOICE}>Pilihan Ganda Kompleks</option>
                            <option value={QuestionType.TRUE_FALSE}>Benar / Salah (Tabel)</option>
                          </select>
                      </div>
                      <div>
                          <div className="flex gap-2 mb-2 items-center">
                              <label className="text-xs font-bold text-gray-500">Stimulus (Teks/Gambar)</label>
                              <div className="flex bg-gray-100 rounded p-0.5">
                                  <button onClick={()=>setStimulusType('text')} className={`text-xs px-2 py-0.5 rounded ${stimulusType==='text'?'bg-white shadow text-blue-600 font-bold':''}`}>Teks</button>
                                  <button onClick={()=>setStimulusType('image')} className={`text-xs px-2 py-0.5 rounded ${stimulusType==='image'?'bg-white shadow text-blue-600 font-bold':''}`}>Gambar</button>
                              </div>
                          </div>
                          {stimulusType==='text' ? <textarea className="w-full border p-2 h-40 rounded" placeholder="Tulis wacana atau konteks soal di sini..." value={questionForm.stimulus||''} onChange={e=>setQuestionForm({...questionForm, stimulus:e.target.value})} /> : 
                          <div className="border-2 border-dashed p-6 text-center rounded bg-gray-50">
                              <input type="file" onChange={handleImageUpload} accept="image/*" className="text-xs" />
                              {questionForm.stimulus && <img src={questionForm.stimulus} className="max-h-32 mx-auto mt-4 rounded shadow" />}
                          </div>}
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">Pertanyaan</label>
                          <textarea className="w-full border p-2 h-24 rounded" placeholder="Tulis pertanyaan..." value={questionForm.text||''} onChange={e=>setQuestionForm({...questionForm, text:e.target.value})} />
                      </div>
                      <div className="bg-gray-50 p-4 border rounded-xl">
                          <label className="text-xs font-bold text-gray-500 block mb-2 uppercase tracking-wider">Opsi Jawaban & Kunci</label>
                          {renderQuestionFormInput()}
                      </div>
                  </div>
              </div>
              <div className="mt-6 pt-4 border-t flex justify-end gap-2">
                  <button onClick={()=>setIsQuestionModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                  <button onClick={handleSaveQuestion} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 shadow">Simpan Soal</button>
              </div>
           </div>
        </div>
      )}

      {previewQuestion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setPreviewQuestion(null)}>
           <div className="bg-white rounded-xl w-[800px] max-h-[90vh] overflow-y-auto p-8" onClick={e => e.stopPropagation()}>
               <div className="mb-6 font-bold text-lg border-b pb-2 flex justify-between">
                   <span>Preview Soal No. {previewQuestion.number}</span>
                   <button onClick={() => setPreviewQuestion(null)} className="text-gray-400 hover:text-black">✕</button>
               </div>
               {previewQuestion.stimulus && (
                   <div className="mb-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
                       {(previewQuestion.stimulus.startsWith('http') || previewQuestion.stimulus.startsWith('data:')) ? <img src={previewQuestion.stimulus} className="max-w-full mx-auto rounded" /> : <div className="whitespace-pre-wrap leading-relaxed">{previewQuestion.stimulus}</div>}
                   </div>
               )}
               <div className="mb-6 font-medium text-xl text-gray-800 whitespace-pre-wrap">{previewQuestion.text}</div>
               <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">{renderPreviewOptions(previewQuestion)}</div>
               <div className="mt-6 flex justify-end">
                   <button onClick={() => setPreviewQuestion(null)} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-black">Tutup Preview</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
};
export default QuestionBank;