import { Student, Packet, Question, Exam, Result, SchoolSettings, QuestionType } from '../types';

// Keys for LocalStorage
const KEYS = {
  API_URL: 'cbt_api_url',
  CACHE_TIMESTAMP: 'cbt_last_sync',
  CACHE_DATA: 'cbt_full_data_cache' // NEW: Store full data payload
};

// --- KONFIGURASI URL SCRIPT ---
// Ganti string kosong di bawah ini dengan URL Web App Anda jika ingin terkoneksi otomatis
const HARDCODED_API_URL = 'https://script.google.com/macros/s/AKfycbwJiR-CIk5UB_zhsoPxJ-IrAZ53kzhjyFLCxkG1Sdh9a6hHZxdcLuPeEBkrwkVwLsMIFw/exec'; 

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'SMPN 3 Pacet',
  loginTitle: 'CBT Online',
  academicYear: '2025/2026',
  semester: 'Genap',
  adminPassword: 'admin',
  teacherLiterasiPassword: 'guru',
  teacherNumerasiPassword: 'guru'
};

const CACHE = {
  Settings: [] as any[],
  Students: [] as Student[],
  Packets: [] as Packet[],
  Questions: [] as Question[],
  Exams: [] as Exam[],
  Results: [] as Result[]
};

// --- INITIALIZATION: LOAD FROM LOCAL STORAGE IMMEDIATELY ---
try {
    const savedData = localStorage.getItem(KEYS.CACHE_DATA);
    if (savedData) {
        const parsed = JSON.parse(savedData);
        // Hydrate CACHE from saved data
        if (parsed.Settings) CACHE.Settings = parsed.Settings;
        if (parsed.Students) CACHE.Students = parsed.Students;
        if (parsed.Packets) CACHE.Packets = parsed.Packets;
        if (parsed.Questions) CACHE.Questions = parsed.Questions;
        if (parsed.Exams) CACHE.Exams = parsed.Exams;
        if (parsed.Results) CACHE.Results = parsed.Results;
        console.log("Data loaded from Local Cache:", CACHE.Settings[0]?.schoolName);
    }
} catch (e) {
    console.warn("Failed to load local cache", e);
}

// --- MAPPING HELPERS ---
const mapDBTypeToEnum = (dbType: string): QuestionType => {
    const type = dbType?.trim();
    if (type === 'Pilihan Ganda') return QuestionType.MULTIPLE_CHOICE;
    if (type === 'Pilihan Ganda Kompleks') return QuestionType.COMPLEX_MULTIPLE_CHOICE;
    if (type === 'Benar / Salah (Tabel)' || type === 'Benar/Salah' || type === 'Benar Salah') return QuestionType.TRUE_FALSE;
    if (type === 'Menjodohkan') return QuestionType.MATCHING;
    if (type === 'Uraian' || type === 'Isian Singkat') return QuestionType.ESSAY;
    return QuestionType.MULTIPLE_CHOICE;
};

const mapEnumToDBType = (type: QuestionType): string => {
    switch (type) {
        case QuestionType.MULTIPLE_CHOICE: return 'Pilihan Ganda';
        case QuestionType.COMPLEX_MULTIPLE_CHOICE: return 'Pilihan Ganda Kompleks';
        case QuestionType.TRUE_FALSE: return 'Benar / Salah (Tabel)';
        case QuestionType.MATCHING: return 'Menjodohkan';
        case QuestionType.ESSAY: return 'Uraian';
        default: return 'Pilihan Ganda';
    }
};

const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Default URL (Fallback only)
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbwJiR-CIk5UB_zhsoPxJ-IrAZ53kzhjyFLCxkG1Sdh9a6hHZxdcLuPeEBkrwkVwLsMIFw/exec';

export const getApiUrl = () => {
    // Priority: 1. Hardcoded, 2. LocalStorage, 3. Default
    if (HARDCODED_API_URL) return HARDCODED_API_URL;

    let url = localStorage.getItem(KEYS.API_URL) || DEFAULT_API_URL;
    if (url.length > 1 && url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
};

export const setApiUrl = (url: string) => localStorage.setItem(KEYS.API_URL, url.trim());

// Helper to send data to GAS
const sendToApi = async (action: 'create' | 'update' | 'delete', sheet: string, payload: any, id?: string) => {
    const url = getApiUrl();
    if (!url) return; 

    // Deep copy payload to avoid modifying UI state
    let dataToSend = { ...payload };

    if (sheet === 'Questions' && dataToSend.type) {
        dataToSend.type = mapEnumToDBType(dataToSend.type as QuestionType);
    }
    
    if (sheet === 'Exams' && Array.isArray(dataToSend.classTarget)) {
        dataToSend.classTarget = dataToSend.classTarget.join(',');
    }

    try {
        // Optimistic Update: Save to LocalStorage immediately after modification
        localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));

        await fetch(url, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify({ action, sheet, payload: dataToSend, id })
        });
    } catch (e) {
        console.error("API Error (Post)", e);
    }
};

export const storage = {
  sync: async (): Promise<boolean> => {
      const url = getApiUrl();
      if (!url) return false; 

      try {
          const response = await fetch(`${url}?action=sync&t=${Date.now()}`);
          if (!response.ok) return false;

          const json = await response.json();
          
          if (json.status === 'success' && json.data) {
              
              CACHE.Students = json.data.Students || [];
              
              // Normalize Packets
              CACHE.Packets = json.data.Packets || [];

              // Normalize Questions (Convert String Type to Enum)
              CACHE.Questions = (json.data.Questions || []).map((q: any) => ({
                  ...q,
                  type: mapDBTypeToEnum(q.type),
                  options: q.options || '[]',
                  correctAnswerIndices: q.correctAnswerIndices || '[]',
                  matchingPairs: q.matchingPairs || '[]'
              }));

              // Normalize Exams (Handle classTarget formats)
              CACHE.Exams = (json.data.Exams || []).map((e: any) => {
                  let classes = e.classTarget;
                  if (typeof classes === 'string' && classes.trim().startsWith('[')) {
                      try {
                          const parsed = JSON.parse(classes);
                          if (Array.isArray(parsed)) classes = parsed.join(',');
                      } catch(err) {}
                  }
                  return { ...e, classTarget: classes };
              });

              CACHE.Results = json.data.Results || [];
              
              const settingsArr = json.data.Settings || [];
              const mergedSettings = { ...DEFAULT_SETTINGS };
              settingsArr.forEach((row: any) => {
                  if (row.Key && row.Value) mergedSettings[row.Key as keyof SchoolSettings] = row.Value;
              });
              CACHE.Settings = [mergedSettings];
              
              // CRITICAL: Save synchronized data to Local Storage
              localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
              localStorage.setItem(KEYS.CACHE_TIMESTAMP, Date.now().toString());

              return true;
          }
      } catch (e) {
          console.error("Sync Failed", e);
      }
      return false;
  },

  settings: {
    get: (): SchoolSettings => CACHE.Settings[0] || DEFAULT_SETTINGS,
    save: (settings: SchoolSettings) => {
      CACHE.Settings = [settings];
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE)); // Save locally immediately
      
      // FIX: Send requests SEQUENTIALLY to prevent GAS LockService collisions/timeouts
      (async () => {
          for (const key of Object.keys(settings)) {
              await sendToApi('update', 'Settings', { Key: key, Value: settings[key as keyof SchoolSettings] }, key);
              // Small delay to be polite to GAS quotas
              await new Promise(resolve => setTimeout(resolve, 150)); 
          }
      })();
    }
  },
  students: {
    getAll: () => CACHE.Students,
    add: (item: Student) => {
      const newItem = { ...item, id: item.id || generateId() };
      CACHE.Students.push(newItem);
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
      sendToApi('create', 'Students', newItem);
    },
    update: (id: string, updates: Partial<Student>) => {
      const idx = CACHE.Students.findIndex(i => i.id === id);
      if (idx !== -1) {
        CACHE.Students[idx] = { ...CACHE.Students[idx], ...updates };
        localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
        sendToApi('update', 'Students', CACHE.Students[idx], id);
      }
    },
    delete: (id: string) => {
      CACHE.Students = CACHE.Students.filter(i => i.id !== id);
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
      sendToApi('delete', 'Students', {}, id);
    }
  },
  packets: {
    getAll: () => CACHE.Packets,
    add: (item: Packet) => {
      const newItem = { ...item, id: item.id || generateId() };
      CACHE.Packets.push(newItem);
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
      sendToApi('create', 'Packets', newItem);
    },
    update: (id: string, updates: Partial<Packet>) => {
      const idx = CACHE.Packets.findIndex(i => i.id === id);
      if (idx !== -1) {
        CACHE.Packets[idx] = { ...CACHE.Packets[idx], ...updates };
        localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
        sendToApi('update', 'Packets', CACHE.Packets[idx], id);
      }
    },
    delete: (id: string) => {
        CACHE.Packets = CACHE.Packets.filter(i => i.id !== id);
        localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
        sendToApi('delete', 'Packets', {}, id);
    }
  },
  questions: {
    getAll: () => CACHE.Questions,
    add: (item: Question) => {
      const newItem = { ...item, id: item.id || generateId() };
      CACHE.Questions.push(newItem);
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
      sendToApi('create', 'Questions', newItem);
    },
    getByPacketId: (packetId: string) => CACHE.Questions.filter(q => q.packetId === packetId),
    delete: (id: string) => {
        CACHE.Questions = CACHE.Questions.filter(i => i.id !== id);
        localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
        sendToApi('delete', 'Questions', {}, id);
    }
  },
  exams: {
    getAll: () => CACHE.Exams,
    add: (item: Exam) => {
      const newItem = { ...item, id: item.id || generateId() };
      CACHE.Exams.push(newItem);
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
      sendToApi('create', 'Exams', newItem);
    },
    update: (id: string, updates: Partial<Exam>) => {
       const idx = CACHE.Exams.findIndex(e => e.id === id);
       if (idx !== -1) {
         CACHE.Exams[idx] = { ...CACHE.Exams[idx], ...updates };
         localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
         sendToApi('update', 'Exams', CACHE.Exams[idx], id);
       }
    },
    delete: (id: string) => {
        CACHE.Exams = CACHE.Exams.filter(i => i.id !== id);
        localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
        sendToApi('delete', 'Exams', {}, id);
    }
  },
  results: {
    getAll: () => CACHE.Results,
    add: (item: Result) => {
      const newItem = { ...item, id: item.id || generateId() };
      CACHE.Results.push(newItem);
      localStorage.setItem(KEYS.CACHE_DATA, JSON.stringify(CACHE));
      sendToApi('create', 'Results', newItem);
    }
  }
};