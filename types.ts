export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'guru',
  STUDENT = 'siswa',
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'PG',
  COMPLEX_MULTIPLE_CHOICE = 'PGK',
  TRUE_FALSE = 'BS',
  ESSAY = 'ESSAY',
  MATCHING = 'JODOHKAN'
}

export interface SchoolSettings {
  schoolName: string;
  loginTitle: string; // e.g. "Try Out TKA 2026"
  academicYear: string; // e.g. "2025/2026"
  semester: string; // e.g. "Genap"
  adminPassword: string;
  teacherLiterasiPassword: string;
  teacherNumerasiPassword: string;
}

export interface Student {
  id: string;
  no: string;
  name: string;
  class: string;
  nis: string;
  nisn: string;
}

export interface Question {
  id: string;
  packetId: string;
  number: number;
  stimulus: string; // Text or HTML content
  text: string;
  image?: string;
  type: QuestionType;
  options: string; // JSON stringified array for DB. For BS: ["Benar", "Salah"]
  correctAnswerIndex: number; // Used for PG and BS
  correctAnswerIndices?: string; // JSON stringified array of numbers for PGK
  category: string; // Literasi / Numerasi
}

export interface Packet {
  id: string;
  name: string;
  category: string; // Literasi / Numerasi
  totalQuestions: number;
  questionTypes: string; 
}

export interface Exam {
  id: string;
  title: string;
  packetId: string;
  scheduledStart: string; // ISO String
  scheduledEnd: string; // ISO String
  durationMinutes: number;
  classTarget: string; // e.g., "9A,9B"
  questions: string; 
  isActive: boolean;
}

export interface Result {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  score: number;
  literasiScore: number;
  numerasiScore: number;
  answers: string; // JSON stringified mapping {qId: answer}
  timestamp: string;
  violationCount: number;
  isDisqualified: boolean;
}

export interface AppState {
  currentUser: { role: UserRole; name: string; id?: string } | null;
  scriptUrl: string;
}