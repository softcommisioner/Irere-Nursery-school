import { StudentAttendanceRecord } from '../types';

export type NurserySubjectKey =
  | 'language'
  | 'numeracy'
  | 'creative'
  | 'social'
  | 'physical';

export interface NurserySubject {
  key: NurserySubjectKey;
  name: string;
  competency: string;
  maxScore: number;
}

export const NURSERY_SUBJECTS: NurserySubject[] = [
  {
    key: 'language',
    name: 'Language & Communication',
    competency: 'Kinyarwanda & English',
    maxScore: 20
  },
  {
    key: 'numeracy',
    name: 'Numeracy & Mathematics',
    competency: 'Numbers, counting & sorting',
    maxScore: 20
  },
  {
    key: 'creative',
    name: 'Creative Arts & Culture',
    competency: 'Drawing, music & imaginative play',
    maxScore: 20
  },
  {
    key: 'social',
    name: 'Social & Environmental Studies',
    competency: 'Community, nature & citizenship',
    maxScore: 20
  },
  {
    key: 'physical',
    name: 'Physical Development & Hygiene',
    competency: 'Motor skills, health & self-care',
    maxScore: 20
  }
];

export type SubjectMarks = Record<NurserySubjectKey, string>;

export const EMPTY_MARKS: SubjectMarks = {
  language: '',
  numeracy: '',
  creative: '',
  social: '',
  physical: ''
};

export type GradeStatus =
  | 'Excellent'
  | 'Very Good'
  | 'Satisfactory'
  | 'Needs Improvement'
  | 'Incomplete';

export interface ReportCardRecord {
  studentId: string;
  studentName: string;
  studentReg: string;
  classId: string;
  className: string;
  academicYear: string;
  term: string;
  marks: SubjectMarks;
  remarks: string;
  updatedAt: string;
}

export interface SubjectResult {
  key: NurserySubjectKey;
  name: string;
  competency: string;
  maxScore: number;
  score: number | null;
  remark: string;
}

export interface ReportComputation {
  subjects: SubjectResult[];
  total: number;
  maxTotal: number;
  percentage: number;
  average: number;
  status: GradeStatus;
  completed: boolean;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  sick: number;
  excused: number;
  late: number;
  attended: number;
  attendanceRate: number;
}

export function summarizeAttendance(
  records: StudentAttendanceRecord[]
): AttendanceSummary {
  const summary = records.reduce(
    (acc, record) => {
      acc.total += 1;
      switch (record.status) {
        case 'PRESENT':
          acc.present += 1;
          break;
        case 'ABSENT':
          acc.absent += 1;
          break;
        case 'SICK':
          acc.sick += 1;
          break;
        case 'EXCUSED':
          acc.excused += 1;
          break;
        case 'LATE':
          acc.late += 1;
          break;
        default:
          break;
      }
      return acc;
    },
    { total: 0, present: 0, absent: 0, sick: 0, excused: 0, late: 0 }
  );

  const attended = summary.present + summary.late;
  return {
    ...summary,
    attended,
    attendanceRate: summary.total > 0 ? (attended / summary.total) * 100 : 0
  };
}

const STORAGE_KEY = 'irere.reportcards.v1';

type ReportStore = Record<string, ReportCardRecord>;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function recordKey(studentId: string, academicYear: string, term: string): string {
  return `${studentId}::${academicYear}::${term}`;
}

function readStore(): ReportStore {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ReportStore) : {};
  } catch {
    return {};
  }
}

export function normalizeMarks(marks?: Partial<SubjectMarks> | null): SubjectMarks {
  return NURSERY_SUBJECTS.reduce((result, subject) => {
    const value = marks?.[subject.key];
    result[subject.key] = typeof value === 'string' ? value : '';
    return result;
  }, {} as SubjectMarks);
}

export function loadReportCard(
  studentId: string,
  academicYear: string,
  term: string
): ReportCardRecord | null {
  const record = readStore()[recordKey(studentId, academicYear, term)];
  if (!record) return null;
  return { ...record, marks: normalizeMarks(record.marks) };
}

export function saveReportCard(record: ReportCardRecord): void {
  if (!canUseStorage()) return;
  try {
    const store = readStore();
    store[recordKey(record.studentId, record.academicYear, record.term)] = {
      ...record,
      marks: normalizeMarks(record.marks),
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Local persistence is best-effort in this demo.
  }
}

export function parseScore(value: string, maxScore: number): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(maxScore, Math.max(0, parsed));
}

export function statusFromPercentage(percentage: number): GradeStatus {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 70) return 'Very Good';
  if (percentage >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

function subjectRemark(score: number | null, maxScore: number): string {
  if (score === null) return 'Not assessed';
  return statusFromPercentage(maxScore > 0 ? (score / maxScore) * 100 : 0);
}

export function calculateReport(marks: SubjectMarks): ReportComputation {
  const subjects = NURSERY_SUBJECTS.map((subject) => {
    const score = parseScore(marks[subject.key] ?? '', subject.maxScore);
    return {
      ...subject,
      score,
      remark: subjectRemark(score, subject.maxScore)
    };
  });

  const maxTotal = subjects.reduce((sum, subject) => sum + subject.maxScore, 0);
  const total = subjects.reduce((sum, subject) => sum + (subject.score ?? 0), 0);
  const completed = subjects.every((subject) => subject.score !== null);
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const average = subjects.length > 0 ? total / subjects.length : 0;

  return {
    subjects,
    total,
    maxTotal,
    percentage,
    average,
    status: completed ? statusFromPercentage(percentage) : 'Incomplete',
    completed
  };
}
