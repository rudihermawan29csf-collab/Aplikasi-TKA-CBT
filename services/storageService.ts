import { Student, Packet, Question, Exam, Result, SchoolSettings } from '../types';

// Keys for LocalStorage (Only for config/cache fallback)
const KEYS = {
  API_URL: 'cbt_api_url',
  CACHE_TIMESTAMP: 'cbt_last_sync'
};

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'SMPN 3 Pacet',
  loginTitle: 'CBT Online',
  academicYear: '2025/2026',
  semester: 'Genap',
  adminPassword: 'admin',
  teacherLiterasiPassword: 'guru',
  teacherNumerasiPassword: 'guru'
};

// In-Memory Cache to support synchronous 'getAll' calls in components
const CACHE = {
  Settings: [] as any[],
  Students: [] as Student[],
  Packets: [] as Packet[],
  Questions: [] as Question[],
  Exams: [] as Exam[],
  Results: [] as Result[]
};

export const getApiUrl = () => localStorage.getItem(KEYS.API_URL) || '';
export const setApiUrl = (url: string) => localStorage.setItem(KEYS.API_URL, url);

// Helper to send data to GAS
// We use 'text/plain' to avoid CORS Preflight (OPTIONS) requests which GAS doesn't handle well.
const sendToApi = async (action: 'create' | 'update' | 'delete', sheet: string, payload: any, id?: string) => {
    const url = getApiUrl();
    if (!url) return; 

    try {
        await fetch(url, {
            method: 'POST',
            // By using text/plain, we skip the Preflight check. GAS will still parse it as string.
            // We parse it back to JSON inside GAS doPost(e).postData.contents
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify({ action, sheet, payload, id })
        });
    } catch (e) {
        console.error("API Error", e);
    }
};

export const storage = {
  // Sync function: Called by App.tsx on mount
  sync: async (): Promise<boolean> => {
      const url = getApiUrl();
      if (!url) {
          return false; 
      }

      try {
          const response = await fetch(`${url}?action=sync`);
          const json = await response.json();
          
          if (json.status === 'success' && json.data) {
              // Update Cache
              CACHE.Students = json.data.Students || [];
              CACHE.Packets = json.data.Packets || [];
              CACHE.Questions = json.data.Questions || [];
              CACHE.Exams = json.data.Exams || [];
              CACHE.Results = json.data.Results || [];
              
              // Handle Settings
              const settingsArr = json.data.Settings || [];
              const mergedSettings = { ...DEFAULT_SETTINGS };
              settingsArr.forEach((row: any) => {
                  if (row.Key && row.Value) mergedSettings[row.Key as keyof SchoolSettings] = row.Value;
              });
              CACHE.Settings = [mergedSettings];
              
              return true;
          }
      } catch (e) {
          console.error("Sync Failed", e);
      }
      return false;
  },

  settings: {
    get: (): SchoolSettings => {
      return CACHE.Settings[0] || DEFAULT_SETTINGS;
    },
    save: (settings: SchoolSettings) => {
      CACHE.Settings = [settings];
      Object.keys(settings).forEach(key => {
          sendToApi('update', 'Settings', { Key: key, Value: settings[key as keyof SchoolSettings] }, key);
      });
    }
  },
  students: {
    getAll: () => CACHE.Students,
    add: (item: Student) => {
      const newItem = { ...item, id: item.id || crypto.randomUUID() };
      CACHE.Students.push(newItem);
      sendToApi('create', 'Students', newItem);
    },
    update: (id: string, updates: Partial<Student>) => {
      const idx = CACHE.Students.findIndex(i => i.id === id);
      if (idx !== -1) {
        CACHE.Students[idx] = { ...CACHE.Students[idx], ...updates };
        sendToApi('update', 'Students', CACHE.Students[idx], id);
      }
    },
    delete: (id: string) => {
      CACHE.Students = CACHE.Students.filter(i => i.id !== id);
      sendToApi('delete', 'Students', {}, id);
    }
  },
  packets: {
    getAll: () => CACHE.Packets,
    add: (item: Packet) => {
      const newItem = { ...item, id: item.id || crypto.randomUUID() };
      CACHE.Packets.push(newItem);
      sendToApi('create', 'Packets', newItem);
    },
    update: (id: string, updates: Partial<Packet>) => {
      const idx = CACHE.Packets.findIndex(i => i.id === id);
      if (idx !== -1) {
        CACHE.Packets[idx] = { ...CACHE.Packets[idx], ...updates };
        sendToApi('update', 'Packets', CACHE.Packets[idx], id);
      }
    },
    delete: (id: string) => {
        CACHE.Packets = CACHE.Packets.filter(i => i.id !== id);
        sendToApi('delete', 'Packets', {}, id);
    }
  },
  questions: {
    getAll: () => CACHE.Questions,
    add: (item: Question) => {
      const newItem = { ...item, id: item.id || crypto.randomUUID() };
      CACHE.Questions.push(newItem);
      sendToApi('create', 'Questions', newItem);
    },
    getByPacketId: (packetId: string) => {
      return CACHE.Questions.filter(q => q.packetId === packetId);
    },
    delete: (id: string) => {
        CACHE.Questions = CACHE.Questions.filter(i => i.id !== id);
        sendToApi('delete', 'Questions', {}, id);
    }
  },
  exams: {
    getAll: () => CACHE.Exams,
    add: (item: Exam) => {
      const newItem = { ...item, id: item.id || crypto.randomUUID() };
      CACHE.Exams.push(newItem);
      sendToApi('create', 'Exams', newItem);
    },
    update: (id: string, updates: Partial<Exam>) => {
       const idx = CACHE.Exams.findIndex(e => e.id === id);
       if (idx !== -1) {
         CACHE.Exams[idx] = { ...CACHE.Exams[idx], ...updates };
         sendToApi('update', 'Exams', CACHE.Exams[idx], id);
       }
    },
    delete: (id: string) => {
        CACHE.Exams = CACHE.Exams.filter(i => i.id !== id);
        sendToApi('delete', 'Exams', {}, id);
    }
  },
  results: {
    getAll: () => CACHE.Results,
    add: (item: Result) => {
      const newItem = { ...item, id: item.id || crypto.randomUUID() };
      CACHE.Results.push(newItem);
      sendToApi('create', 'Results', newItem);
    }
  }
};
