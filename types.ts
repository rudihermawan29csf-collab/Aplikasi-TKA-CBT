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
  loginTitle: string; 
  academicYear: string; 
  semester: string; 
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
  stimulus: string; // Text content
  text: string;
  image?: string; // Explicit image column
  type: QuestionType;
  options: string; // JSON string
  correctAnswerIndex: number; 
  correctAnswerIndices?: string; // JSON string for PGK
  matchingPairs?: string; // JSON string for JODOHKAN/BS rows
  category: string; 
}

export interface Packet {
  id: string;
  name: string;
  category: string; 
  totalQuestions: number;
  questionTypes: string; 
}

export interface Exam {
  id: string;
  title: string;
  packetId: string;
  scheduledStart: string; 
  scheduledEnd: string; 
  durationMinutes: number;
  classTarget: string; // Comma separated string or JSON string array
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
  answers: string; 
  timestamp: string;
  violationCount: number;
  isDisqualified: boolean;
}

export interface AppState {
  currentUser: { role: UserRole; name: string; id?: string } | null;
  scriptUrl: string;
}