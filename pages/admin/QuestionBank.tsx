import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storageService';
import { Packet, Question, QuestionType } from '../../types';

// Data Structure Helpers
interface BSItem {
    left: string;
    right: string; // 'a' = Option 1 (Benar), 'b' = Option 2 (Salah)
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

  // Specific state for True/False (Benar/Salah Tabel)
  const [bsOptions, setBsOptions] = useState<string[]>(["Benar", "Salah"]);
  const [bsItems, setBsItems] = useState<BSItem[]>([{ left: "", right: "a" }]);

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
      if (confirm("Hapus paket soal ini?")) {
          storage.packets.delete(id);
          setPackets(storage.packets.getAll());
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
               // If image field exists, we can use it, but current UI binds to stimulus. 
               // Ideally modify UI to handle separate image field.
               // For now, assume stimulus holds the content to display.
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
          setQuestionForm({
              packetId: selectedPacketId!,
              number: number || questions.length + 1,
              type: QuestionType.MULTIPLE_CHOICE,
              text: '',
              stimulus: '',
              image: '',
              options: '["", "", "", ""]',
              correctAnswerIndex: 0,
              correctAnswerIndices: '[]',
              matchingPairs: '[]',
              category: 'Literasi'
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
          number: questionForm.number || questions.length + 1,
          id: questionForm.id || crypto.randomUUID()
      } as Question;
      
      if (questionForm.id) {
           storage.questions.delete(questionForm.id); // Remove old to update
      }
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

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      <div className="col-span-3 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between bg-gray-50">
          <h3 className="font-bold">Paket Soal</h3>
          <button onClick={() => { setPacketForm({}); setIsPacketModalOpen(true); }} className="text-blue-600 text-sm">+ Baru</button>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {packets.map(p => (
            <div key={p.id} onClick={() => setSelectedPacketId(p.id)} className={`p-3 rounded cursor-pointer border ${selectedPacketId === p.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{p.category} • {p.totalQuestions} Soal</div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-9 bg-white rounded-lg shadow flex flex-col">
        {selectedPacketId ? (
          <>
            <div className="p-4 border-b flex justify-between">
              <h3 className="font-bold">Daftar Soal</h3>
              <button onClick={() => openAddQuestion()} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">+ Tambah Soal</button>
            </div>
            <div className="p-4 bg-gray-100 border-b flex flex-wrap gap-2">
                 {Array.from({ length: packets.find(p=>p.id===selectedPacketId)?.totalQuestions || 20 }).map((_, i) => {
                        const num = i + 1;
                        const hasQ = questions.find(q => q.number === num);
                        return <button key={num} onClick={() => openAddQuestion(num)} className={`w-8 h-8 rounded border ${hasQ ? 'bg-green-500 text-white' : 'bg-white text-gray-400'}`}>{num}</button>
                 })}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {questions.sort((a,b)=>a.number-b.number).map(q => (
                <div key={q.id} className="border rounded p-4 relative group">
                  <div className="absolute top-2 right-2 hidden group-hover:flex gap-2">
                      <button onClick={() => openAddQuestion(q.number)} className="text-blue-500 text-xs bg-blue-50 p-1 rounded">Edit</button>
                      <button onClick={() => setPreviewQuestion(q)} className="text-gray-500 text-xs bg-gray-50 p-1 rounded">Preview</button>
                      <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-500 text-xs bg-red-50 p-1 rounded">Del</button>
                  </div>
                  <div className="flex gap-2 mb-2"><span className="font-bold text-blue-600">No. {q.number}</span><span className="bg-gray-100 text-xs px-2 py-0.5 rounded">{q.type}</span></div>
                  <div className="whitespace-pre-wrap">{q.text}</div>
                </div>
              ))}
            </div>
          </>
        ) : <div className="p-10 text-center text-gray-400">Pilih paket soal</div>}
      </div>

      {isPacketModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded w-96 space-y-4">
                  <h3 className="font-bold">Paket Soal</h3>
                  <input className="w-full border p-2 rounded" placeholder="Nama" value={packetForm.name||''} onChange={e=>setPacketForm({...packetForm, name:e.target.value})} />
                  <select className="w-full border p-2 rounded" value={packetForm.category||''} onChange={e=>setPacketForm({...packetForm, category:e.target.value})}><option value="">Pilih Kategori</option><option value="Literasi">Literasi</option><option value="Numerasi">Numerasi</option></select>
                  <input type="number" className="w-full border p-2 rounded" placeholder="Jml Soal" value={packetForm.totalQuestions||''} onChange={e=>setPacketForm({...packetForm, totalQuestions:parseInt(e.target.value)})} />
                  <div className="flex justify-end gap-2"><button onClick={()=>setIsPacketModalOpen(false)}>Batal</button><button onClick={handleSavePacket} className="bg-blue-600 text-white px-4 py-2 rounded">Simpan</button></div>
              </div>
          </div>
      )}

      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg w-[900px] h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between mb-4"><h3 className="font-bold">Edit Soal {questionForm.number}</h3><button onClick={()=>setIsQuestionModalOpen(false)}>x</button></div>
              <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <select className="w-full border p-2 rounded" value={questionForm.type} onChange={e=>setQuestionForm({...questionForm, type:e.target.value as QuestionType})}>
                          <option value={QuestionType.MULTIPLE_CHOICE}>Pilihan Ganda</option>
                          <option value={QuestionType.COMPLEX_MULTIPLE_CHOICE}>Pilihan Ganda Kompleks</option>
                          <option value={QuestionType.TRUE_FALSE}>Benar / Salah (Tabel)</option>
                      </select>
                      <div>
                          <div className="flex gap-2 mb-1"><button onClick={()=>setStimulusType('text')} className={`text-xs p-1 ${stimulusType==='text'?'bg-blue-600 text-white':''}`}>Teks</button><button onClick={()=>setStimulusType('image')} className={`text-xs p-1 ${stimulusType==='image'?'bg-blue-600 text-white':''}`}>Gambar</button></div>
                          {stimulusType==='text' ? <textarea className="w-full border p-2 h-40" placeholder="Stimulus" value={questionForm.stimulus||''} onChange={e=>setQuestionForm({...questionForm, stimulus:e.target.value})} /> : 
                          <div className="border p-4 text-center"><input type="file" onChange={handleImageUpload} />{questionForm.stimulus && <img src={questionForm.stimulus} className="h-20 mx-auto mt-2" />}</div>}
                      </div>
                  </div>
                  <div className="space-y-4">
                      <textarea className="w-full border p-2 h-24" placeholder="Pertanyaan" value={questionForm.text||''} onChange={e=>setQuestionForm({...questionForm, text:e.target.value})} />
                      <div className="bg-gray-50 p-4 border rounded">{renderQuestionFormInput()}</div>
                  </div>
              </div>
              <div className="mt-4 flex justify-end"><button onClick={handleSaveQuestion} className="bg-blue-600 text-white px-6 py-2 rounded">Simpan</button></div>
           </div>
        </div>
      )}

      {previewQuestion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setPreviewQuestion(null)}>
           <div className="bg-white rounded-xl w-[800px] max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
               <div className="mb-4 font-bold text-lg">Preview Soal No. {previewQuestion.number}</div>
               {previewQuestion.stimulus && (
                   <div className="mb-4 bg-gray-50 p-4 rounded border">
                       {(previewQuestion.stimulus.startsWith('http') || previewQuestion.stimulus.startsWith('data:')) ? <img src={previewQuestion.stimulus} className="max-w-full" /> : <div className="whitespace-pre-wrap">{previewQuestion.stimulus}</div>}
                   </div>
               )}
               <div className="mb-4 font-medium">{previewQuestion.text}</div>
               <div className="bg-gray-100 p-4 rounded">{renderPreviewOptions(previewQuestion)}</div>
               <button onClick={() => setPreviewQuestion(null)} className="mt-4 bg-gray-800 text-white px-4 py-2 rounded">Tutup</button>
           </div>
        </div>
      )}
    </div>
  );
};
export default QuestionBank;