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

// Helper for generating IDs safely in all environments
const generateId = (): string => {
    // Try native crypto UUID first (modern browsers, secure context)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers or insecure contexts (http)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const getApiUrl = () => {
    let url = localStorage.getItem(KEYS.API_URL) || '';
    // Basic cleanup ensuring no trailing slash unless it's the only char (unlikely)
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

    try {
        // IMPORTANT: We use mode: 'no-cors' for POST requests.
        // Google Apps Script returns a 302 Redirect for POSTs, which standard fetch follows.
        // However, the redirect target often lacks CORS headers for the browser to read the response.
        // 'no-cors' allows the request to be sent (so the DB updates), but we receive an opaque response.
        // This effectively suppresses "Failed to fetch" errors caused by CORS on the response, 
        // while still executing the server-side script.
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 
                'Content-Type': 'text/plain' 
            }, 
            body: JSON.stringify({ action, sheet, payload, id })
        });
    } catch (e) {
        console.error("API Error (Post)", e);
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
          // For GET, we need the data, so we cannot use 'no-cors'.
          // If this fails, it is likely that the Web App deployment permission is not set to "Anyone".
          const response = await fetch(`${url}?action=sync&t=${Date.now()}`);
          
          if (!response.ok) {
              console.error(`Sync Error: HTTP ${response.status}`);
              return false;
          }

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
      const newItem = { ...item, id: item.id || generateId() };
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
      const newItem = { ...item, id: item.id || generateId() };
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
      const newItem = { ...item, id: item.id || generateId() };
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
      const newItem = { ...item, id: item.id || generateId() };
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
      const newItem = { ...item, id: item.id || generateId() };
      CACHE.Results.push(newItem);
      sendToApi('create', 'Results', newItem);
    }
  }
};