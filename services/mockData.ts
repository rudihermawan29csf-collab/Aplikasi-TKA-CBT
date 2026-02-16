import { Student, Packet, Question, Exam, QuestionType, Result } from '../types';

export const MOCK_STUDENTS: Student[] = [
  { id: '1', no: '1', name: 'Ahmad Siswa', class: '9A', nis: '1001', nisn: '0012345678' },
  { id: '2', no: '2', name: 'Budi Santoso', class: '9A', nis: '1002', nisn: '0012345679' },
  { id: '3', no: '3', name: 'Citra Dewi', class: '9B', nis: '1003', nisn: '0012345680' },
];

export const MOCK_PACKETS: Packet[] = [
  { id: 'p1', name: 'Paket IPA 9', category: 'Sains', totalQuestions: 2, questionTypes: 'PG:2' },
];

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 'q1',
    packetId: 'p1',
    number: 1,
    stimulus: 'Perhatikan gambar rantai makanan berikut.',
    text: 'Organisme yang berperan sebagai produsen adalah...',
    type: QuestionType.MULTIPLE_CHOICE,
    options: JSON.stringify(['Rumput', 'Belalang', 'Katak', 'Ular']),
    correctAnswerIndex: 0,
    category: 'Literasi'
  },
  {
    id: 'q2',
    packetId: 'p1',
    number: 2,
    stimulus: 'Sebuah mobil bergerak dengan kecepatan 60 km/jam.',
    text: 'Berapa jarak yang ditempuh dalam 2 jam?',
    type: QuestionType.MULTIPLE_CHOICE,
    options: JSON.stringify(['100 km', '120 km', '140 km', '60 km']),
    correctAnswerIndex: 1,
    category: 'Numerasi'
  }
];

export const MOCK_EXAMS: Exam[] = [
  {
    id: 'e1',
    title: 'Ujian Tengah Semester IPA',
    packetId: 'p1',
    scheduledStart: new Date(Date.now() - 3600000).toISOString(), // Started 1 hour ago
    scheduledEnd: new Date(Date.now() + 3600000 * 24).toISOString(), // Ends tomorrow
    durationMinutes: 60,
    classTarget: '9A,9B',
    questions: JSON.stringify(['q1', 'q2']),
    isActive: true
  }
];

export const MOCK_RESULTS: Result[] = [];
