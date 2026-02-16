import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Packet, Question, QuestionType } from '../../types';
import { generateQuestionFromTopic } from '../../services/geminiService';

// Helper interface for Complex True/False structure
interface BSItem {
    text: string;
    answer: number; // 0 for Column 1, 1 for Column 2
}
interface BSStructure {
    labels: [string, string];
    items: BSItem[];
}

const QuestionBank: React.FC = () => {
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

  // State specific for Complex True/False
  const [bsData, setBsData] = useState<BSStructure>({
      labels: ["Benar", "Salah"],
      items: [
          { text: "", answer: 0 },
          { text: "", answer: 0 },
          { text: "", answer: 0 }
      ]
  });

  useEffect(() => {
    setPackets(storage.packets.getAll());
    if (selectedPacketId) {
      setQuestions(storage.questions.getByPacketId(selectedPacketId));
    }
  }, [selectedPacketId]);

  // --- Packet Handlers ---
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
          setPackets(storage.packets.getAll());
          setIsPacketModalOpen(false);
          setPacketForm({});
      }
  };

  const handleDeletePacket = (id: string) => {
      if (confirm("Hapus paket soal ini? Semua soal di dalamnya akan hilang.")) {
          storage.packets.delete(id);
          const linkedQs = storage.questions.getByPacketId(id);
          linkedQs.forEach(q => storage.questions.delete(q.id));
          
          setPackets(storage.packets.getAll());
          if (selectedPacketId === id) setSelectedPacketId(null);
      }
  };

  // --- Question Handlers ---
  const openAddQuestion = (number?: number) => {
      const existing = number ? questions.find(q => q.number === number) : null;
      
      if (existing) {
          setQuestionForm(existing);
          setStimulusType(existing.stimulus.startsWith('data:image') || existing.stimulus.startsWith('http') ? 'image' : 'text');
          
          if (existing.type === QuestionType.TRUE_FALSE) {
              try {
                  const parsed = JSON.parse(existing.options);
                  if (parsed.labels && parsed.items) {
                      setBsData(parsed);
                  } else {
                      setBsData({ labels: ["Benar", "Salah"], items: [{ text: "Pernyataan", answer: existing.correctAnswerIndex }] });
                  }
              } catch (e) {
                  setBsData({ labels: ["Benar", "Salah"], items: [{ text: "", answer: 0 }, { text: "", answer: 0 }, { text: "", answer: 0 }] });
              }
          }
      } else {
          setQuestionForm({
              packetId: selectedPacketId!,
              number: number || questions.length + 1,
              type: QuestionType.MULTIPLE_CHOICE,
              text: '',
              stimulus: '',
              options: '["", "", "", ""]',
              correctAnswerIndex: 0,
              correctAnswerIndices: '[]',
              category: 'Literasi'
          });
          setStimulusType('text');
          setBsData({
              labels: ["Benar", "Salah"],
              items: [
                  { text: "", answer: 0 },
                  { text: "", answer: 0 },
                  { text: "", answer: 0 }
              ]
          });
      }
      setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = () => {
      if (!questionForm.text) {
          alert("Pertanyaan wajib diisi!");
          return;
      }
      
      let finalOptions = questionForm.options;
      
      if (questionForm.type === QuestionType.TRUE_FALSE) {
          finalOptions = JSON.stringify(bsData);
      }

      if (questionForm.id) {
           storage.questions.delete(questionForm.id);
      }
      
      const qToSave = { 
          ...questionForm, 
          options: finalOptions,
          number: questionForm.number || questions.length + 1,
          id: questionForm.id || crypto.randomUUID()
      } as Question;
      
      storage.questions.add(qToSave);
      
      setQuestions(storage.questions.getByPacketId(selectedPacketId!));
      setIsQuestionModalOpen(false);
  };

  const handleDeleteQuestion = (id: string) => {
      if (confirm("Hapus soal ini?")) {
          storage.questions.delete(id);
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

  const handleDownloadTemplate = () => {
      // Define CSV Headers
      const headers = ["No,Tipe,Stimulus,Pertanyaan,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,Kunci"];
      const exampleRow = ["1,PG,Isi Stimulus,Isi Pertanyaan,Jawaban A,Jawaban B,Jawaban C,Jawaban D,Jawaban E,0"];
      
      const csvContent = "data:text/csv;charset=utf-8," + headers.join("\n") + "\n" + exampleRow.join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "template_soal_cbt.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Simple CSV parsing simulation
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (event) => {
              const text = event.target?.result as string;
              if (text && selectedPacketId) {
                  // Assume CSV format matches template
                  alert("Berhasil membaca file! (Simulasi: Menambahkan soal dummy)");
                  // Here we would actually parse 'text' split by newlines and commas
                  // For now, let's just add a dummy question to show it works
                  const newQ: Question = {
                      id: crypto.randomUUID(),
                      packetId: selectedPacketId,
                      number: questions.length + 1,
                      stimulus: 'Stimulus dari Import',
                      text: 'Pertanyaan dari Import CSV',
                      type: QuestionType.MULTIPLE_CHOICE,
                      options: JSON.stringify(['A', 'B', 'C', 'D']),
                      correctAnswerIndex: 0,
                      category: 'Literasi'
                  };
                  storage.questions.add(newQ);
                  setQuestions(storage.questions.getByPacketId(selectedPacketId));
              }
          };
          reader.readAsText(file);
      }
  };

  // --- UI Helpers ---
  const handleOptionChange = (idx: number, val: string) => {
      const opts = JSON.parse(questionForm.options || '[]');
      opts[idx] = val;
      setQuestionForm({ ...questionForm, options: JSON.stringify(opts) });
  };

  const handlePGKCheck = (idx: number) => {
      const currentIndices = JSON.parse(questionForm.correctAnswerIndices || '[]');
      const newIndices = currentIndices.includes(idx) 
        ? currentIndices.filter((i: number) => i !== idx)
        : [...currentIndices, idx];
      setQuestionForm({ ...questionForm, correctAnswerIndices: JSON.stringify(newIndices) });
  };

  // --- BS Specific Handlers ---
  const handleBsLabelChange = (idx: 0 | 1, val: string) => {
      const newLabels = [...bsData.labels] as [string, string];
      newLabels[idx] = val;
      setBsData({ ...bsData, labels: newLabels });
  };

  const handleBsItemChange = (idx: number, field: 'text' | 'answer', val: string | number) => {
      const newItems = [...bsData.items];
      newItems[idx] = { ...newItems[idx], [field]: val };
      setBsData({ ...bsData, items: newItems });
  };

  const addBsItem = () => {
      setBsData({ ...bsData, items: [...bsData.items, { text: "", answer: 0 }] });
  };

  const removeBsItem = (idx: number) => {
      if (bsData.items.length <= 1) return;
      setBsData({ ...bsData, items: bsData.items.filter((_, i) => i !== idx) });
  };

  const renderQuestionFormInput = () => {
      if (questionForm.type === QuestionType.TRUE_FALSE) {
          return (
              <div className="mt-2 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500">Label Kolom 1 (Kiri)</label>
                          <input 
                              className="w-full border p-2 rounded text-sm"
                              value={bsData.labels[0]}
                              onChange={(e) => handleBsLabelChange(0, e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500">Label Kolom 2 (Kanan)</label>
                          <input 
                              className="w-full border p-2 rounded text-sm"
                              value={bsData.labels[1]}
                              onChange={(e) => handleBsLabelChange(1, e.target.value)}
                          />
                      </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-gray-100 text-gray-600 font-bold">
                              <tr>
                                  <th className="p-3 w-8">#</th>
                                  <th className="p-3">Pernyataan</th>
                                  <th className="p-3 w-40">Kunci Jawaban</th>
                                  <th className="p-3 w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {bsData.items.map((item, idx) => (
                                  <tr key={idx}>
                                      <td className="p-3 text-center">{idx + 1}</td>
                                      <td className="p-3">
                                          <input 
                                              className="w-full border p-1 rounded"
                                              placeholder="Isi pernyataan..."
                                              value={item.text}
                                              onChange={(e) => handleBsItemChange(idx, 'text', e.target.value)}
                                          />
                                      </td>
                                      <td className="p-3">
                                          <select 
                                              className="w-full border p-1 rounded bg-white"
                                              value={item.answer}
                                              onChange={(e) => handleBsItemChange(idx, 'answer', parseInt(e.target.value))}
                                          >
                                              <option value={0}>{bsData.labels[0]}</option>
                                              <option value={1}>{bsData.labels[1]}</option>
                                          </select>
                                      </td>
                                      <td className="p-3 text-center">
                                          <button onClick={() => removeBsItem(idx)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <button onClick={addBsItem} className="text-sm text-blue-600 font-bold hover:underline">+ Tambah Baris Pernyataan</button>
              </div>
          );
      }

      const opts = JSON.parse(questionForm.options || '[]');
      return (
          <div className="space-y-2 mt-2">
              {opts.map((opt: string, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                      {questionForm.type === QuestionType.MULTIPLE_CHOICE ? (
                          <input 
                            type="radio" 
                            name="pg" 
                            checked={questionForm.correctAnswerIndex === idx}
                            onChange={() => setQuestionForm({...questionForm, correctAnswerIndex: idx})}
                          />
                      ) : (
                          <input 
                            type="checkbox" 
                            checked={JSON.parse(questionForm.correctAnswerIndices || '[]').includes(idx)}
                            onChange={() => handlePGKCheck(idx)}
                          />
                      )}
                      <input 
                        className="border p-1 rounded flex-1" 
                        value={opt} 
                        onChange={e => handleOptionChange(idx, e.target.value)} 
                        placeholder={`Opsi ${String.fromCharCode(65+idx)}`}
                      />
                  </div>
              ))}
              <button 
                onClick={() => setQuestionForm({...questionForm, options: JSON.stringify([...opts, ""])})}
                className="text-xs text-blue-600 underline"
              >
                + Tambah Opsi
              </button>
          </div>
      );
  };

  const selectedPacket = packets.find(p => p.id === selectedPacketId);

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar Packets */}
      <div className="col-span-3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-700">Paket Soal</h3>
          <button 
            onClick={() => { setPacketForm({}); setIsPacketModalOpen(true); }}
            className="text-blue-600 text-sm hover:underline"
          >
              + Baru
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {packets.map(p => (
            <div 
              key={p.id} 
              onClick={() => setSelectedPacketId(p.id)}
              className={`p-3 rounded cursor-pointer transition-colors group relative ${selectedPacketId === p.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
            >
              <div className="font-medium text-gray-800">{p.name}</div>
              <div className="text-xs text-gray-500">{p.category} • {p.totalQuestions} Soal</div>
              <div className="absolute right-2 top-2 hidden group-hover:flex gap-1 bg-white shadow-sm p-1 rounded">
                  <button onClick={(e) => { e.stopPropagation(); setPacketForm(p); setIsPacketModalOpen(true); }} className="text-xs text-blue-500 hover:font-bold px-1">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeletePacket(p.id); }} className="text-xs text-red-500 hover:font-bold px-1">Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Questions */}
      <div className="col-span-9 bg-white rounded-lg shadow flex flex-col">
        {selectedPacketId && selectedPacket ? (
          <>
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div>
                  <h3 className="font-bold text-gray-700">{selectedPacket.name}</h3>
                  <p className="text-xs text-gray-500">Total Slot: {selectedPacket.totalQuestions} Soal</p>
              </div>
              <div className="flex gap-2">
                 <button onClick={handleDownloadTemplate} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1">
                    ⬇️ Excel (CSV)
                 </button>
                 <label className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 flex items-center gap-1 cursor-pointer">
                    📂 Import CSV
                    <input type="file" accept=".csv" onChange={handleImportExcel} className="hidden" />
                 </label>
                 <button onClick={() => openAddQuestion()} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">+ Tambah</button>
              </div>
            </div>
            
            {/* Question Toggle Grid */}
            <div className="p-4 bg-gray-100 border-b">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Navigasi / Slot Soal</p>
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: selectedPacket.totalQuestions || 20 }).map((_, i) => {
                        const num = i + 1;
                        const existingQ = questions.find(q => q.number === num);
                        return (
                            <button
                                key={num}
                                onClick={() => openAddQuestion(num)}
                                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors border ${
                                    existingQ 
                                    ? 'bg-green-500 text-white border-green-600 hover:bg-green-600' 
                                    : 'bg-white text-gray-400 border-gray-300 hover:bg-gray-200'
                                }`}
                                title={existingQ ? existingQ.text : "Kosong"}
                            >
                                {num}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {questions.length === 0 && (
                <div className="text-center text-gray-400 mt-10">Belum ada soal dibuat. Klik nomor diatas atau tombol tambah.</div>
              )}
              {questions.sort((a,b) => a.number - b.number).map((q) => (
                <div key={q.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow relative group">
                  <div className="absolute top-4 right-4 hidden group-hover:flex gap-2">
                      <button onClick={() => openAddQuestion(q.number)} className="text-blue-500 hover:font-bold bg-blue-50 px-2 py-1 rounded text-xs">Edit</button>
                      <button onClick={() => setPreviewQuestion(q)} className="text-gray-500 hover:text-blue-600 bg-gray-50 px-2 py-1 rounded text-xs">Preview</button>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded text-xs">Hapus</button>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-blue-600">No. {q.number}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{q.type}</span>
                  </div>
                  {q.stimulus && (
                      <div className="mb-3 text-gray-600 italic border-l-4 border-gray-300 pl-3">
                          {q.stimulus.startsWith('data:image') || q.stimulus.startsWith('http') ? (
                              <img src={q.stimulus} alt="Stimulus" className="h-20 object-contain" />
                          ) : (
                              <p className="line-clamp-2">{q.stimulus}</p>
                          )}
                      </div>
                  )}
                  <div className="mb-4 font-medium text-lg whitespace-pre-wrap">{q.text}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Pilih paket soal di sebelah kiri
          </div>
        )}
      </div>

      {/* Packet Modal & Question Modal Components remain largely the same, skipped for brevity but included in full impl */}
      {isPacketModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg w-96">
                  <h3 className="font-bold text-lg mb-4">{packetForm.id ? 'Edit Paket' : 'Paket Baru'}</h3>
                  <div className="space-y-4">
                      <input className="w-full border p-2 rounded" placeholder="Nama Paket" value={packetForm.name || ''} onChange={e => setPacketForm({...packetForm, name: e.target.value})} />
                      <select className="w-full border p-2 rounded" value={packetForm.category || ''} onChange={e => setPacketForm({...packetForm, category: e.target.value})}>
                          <option value="">Pilih Jenis</option>
                          <option value="Literasi">Literasi</option>
                          <option value="Numerasi">Numerasi</option>
                      </select>
                      <div>
                          <label className="text-xs text-gray-500 block mb-1">Jumlah Soal</label>
                          <input 
                            type="number" 
                            className="w-full border p-2 rounded" 
                            placeholder="Total Soal" 
                            value={packetForm.totalQuestions || ''} 
                            onChange={e => setPacketForm({...packetForm, totalQuestions: parseInt(e.target.value)})} 
                           />
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                      <button onClick={() => setIsPacketModalOpen(false)} className="px-4 py-2 text-gray-600">Batal</button>
                      <button onClick={handleSavePacket} className="px-4 py-2 bg-blue-600 text-white rounded">Simpan</button>
                  </div>
              </div>
          </div>
      )}
      
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg w-[900px] max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">Input Soal No. {questionForm.number}</h3>
                    <button onClick={() => setIsQuestionModalOpen(false)} className="text-gray-500 hover:text-red-500">✕</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Tipe Soal</label>
                              <select className="w-full border p-2 rounded" value={questionForm.type} onChange={e => setQuestionForm({...questionForm, type: e.target.value as QuestionType})}>
                                  <option value={QuestionType.MULTIPLE_CHOICE}>Pilihan Ganda (PG)</option>
                                  <option value={QuestionType.COMPLEX_MULTIPLE_CHOICE}>PG Kompleks</option>
                                  <option value={QuestionType.TRUE_FALSE}>Benar / Salah</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Stimulus</label>
                              <div className="flex gap-2 mb-2">
                                  <button onClick={() => setStimulusType('text')} className={`px-3 py-1 rounded text-xs ${stimulusType === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Teks</button>
                                  <button onClick={() => setStimulusType('image')} className={`px-3 py-1 rounded text-xs ${stimulusType === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Gambar</button>
                              </div>
                              {stimulusType === 'text' ? (
                                  <textarea className="w-full border p-2 rounded h-40 whitespace-pre-wrap" placeholder="Masukkan teks stimulus..." value={questionForm.stimulus || ''} onChange={e => setQuestionForm({...questionForm, stimulus: e.target.value})}/>
                              ) : (
                                  <div className="border-2 border-dashed p-4 rounded text-center">
                                      {questionForm.stimulus && <img src={questionForm.stimulus} alt="Preview" className="max-h-40 mx-auto mb-2" />}
                                      <input type="file" accept="image/*" onChange={handleImageUpload} />
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Pertanyaan</label>
                            <textarea className="w-full border p-2 rounded h-24 font-medium whitespace-pre-wrap" placeholder="Ketik pertanyaan..." value={questionForm.text || ''} onChange={e => setQuestionForm({...questionForm, text: e.target.value})}/>
                          </div>
                          <div className="bg-gray-50 p-4 rounded border">
                              <label className="text-sm font-bold text-gray-500">Opsi Jawaban & Kunci</label>
                              {renderQuestionFormInput()}
                          </div>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2 pt-4 border-t">
                      <button onClick={() => setIsQuestionModalOpen(false)} className="px-4 py-2 text-gray-600">Batal</button>
                      <button onClick={handleSaveQuestion} className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700">Simpan Soal</button>
                  </div>
           </div>
        </div>
      )}

      {/* Preview Modal Logic (Simplified for brevity, same as previous) */}
      {previewQuestion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setPreviewQuestion(null)}>
           {/* Preview Content ... */}
           <div className="bg-white p-8 rounded-lg w-[700px] max-w-full" onClick={e => e.stopPropagation()}>
             <h3 className="font-bold">Preview (Click outside to close)</h3>
             <p>{previewQuestion.text}</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
