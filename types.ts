export interface ChapterScores {
  f1: string | number;
  f2: string | number;
  f3: string | number;
  f4: string | number;
  f5: string | number;
  sum: string | number;
  [key: string]: string | number;
}

export interface Student {
  id: number;
  name: string;
  chapters: ChapterScores[];
  sts: string | number;
  sas: string | number;
  [key: string]: any;
}

export interface Assignment {
  date: string;
  bab: string;
  type: string;
  desc: string;
  createdBy?: string;
  createdAt?: string;
}

export interface AssignmentsMap {
  [key: string]: Assignment;
}

export interface SchoolConfig {
  year: string;
  semester: string;
  principalName: string;
  principalNIP: string;
  teacherName: string;
  teacherNIP: string;
  city: string;
}

export interface ClassConfig {
  chapterCount: number;
}

export interface ClassConfigMap {
  [className: string]: ClassConfig;
}

export interface MonitoringFilter {
  bab: string;
  type: string;
}

export interface InputForm {
  date: string;
  bab: string;
  type: string;
  desc: string;
}

export type Role = 'admin' | 'student' | null;
export type SyncStatus = 'idle' | 'syncing' | 'error';
