export type UserRole = 'HEADMASTER' | 'ACCOUNTANT' | 'TEACHER' | 'PARENT' | 'SPONSOR';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  title: string;
}

export type ClassLevel = 'BABY_CLASS' | 'MIDDLE_CLASS' | 'TOP_CLASS';

export interface SchoolClass {
  id: string;
  code: string;
  name: string;
  kinyarwandaName: string;
  ageRange: string;
  teacherId: string;
  teacherName: string;
  roomNumber: string;
  studentCount: number;
  capacity: number;
}

export interface Student {
  id: string;
  regNumber: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dob: string;
  classId: string;
  className: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  residenceVillage: string; // e.g. "Ngaruyinka", "Gasharu", "Kagugu"
  tuitionFeeTerm: number; // in RWF
  paidAmount: number; // in RWF
  balance: number; // in RWF
  emergencyContact: string;
  medicalNotes?: string;
}

export type TeacherAttendanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // e.g. "07:18 AM"
  checkOutTime?: string;
  status: TeacherAttendanceStatus;
  notes?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
    accuracyMeters: number;
    isWithinCampus: boolean;
  };
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  headmasterRemarks?: string;
}

export type StudentAttendanceState = 'PRESENT' | 'ABSENT' | 'SICK' | 'EXCUSED' | 'LATE';

export interface StudentAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  date: string;
  status: StudentAttendanceState;
  remarks?: string;
  recordedByTeacherId: string;
}

export type PaymentMethod = 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BK_TRANSFER' | 'CASH';

export interface FeePayment {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  studentReg: string;
  classId: string;
  className: string;
  amount: number; // in RWF
  academicTerm: string; // e.g. "Term 1 - 2026"
  paymentMethod: PaymentMethod;
  momoTransactionRef?: string;
  payerName: string;
  payerPhone: string;
  receivedBy: string;
  paymentDate: string;
  status: 'VERIFIED' | 'PENDING' | 'RECONCILED';
}

export type LedgerCategory =
  | 'TUITION_FEE'
  | 'UNIFORM_SALE'
  | 'LUNCH_PROGRAM'
  | 'REGISTRATION_FEE'
  | 'TEACHER_SALARY'
  | 'SUPPORT_STAFF'
  | 'FOOD_SUPPLIES'
  | 'LEARNING_MATERIALS'
  | 'UTILITIES_WASAC_REG'
  | 'FACILITY_MAINTENANCE'
  | 'HYGIENE_HEALTH';

export interface LedgerEntry {
  id: string;
  entryDate: string;
  description: string;
  type: 'INCOME' | 'EXPENSE';
  category: LedgerCategory;
  amount: number; // in RWF
  referenceDocNumber: string;
  recordedBy: string;
  paymentMethod: PaymentMethod;
}

export interface CurriculumMaterial {
  id: string;
  title: string;
  theme: string;
  classLevel: ClassLevel;
  className: string;
  subject: 'Kinyarwanda' | 'English' | 'Early Numeracy' | 'Creative Arts & Music' | 'Social & Environmental' | 'Physical Play';
  fileFormat: 'PDF' | 'IMAGE' | 'AUDIO' | 'DOC';
  fileSize: string;
  downloadUrl: string;
  uploadDate: string;
  weekNumber: number;
  term: string;
  uploadedByTeacherName: string;
  description: string;
}

export interface StudentMilestoneEvaluation {
  id: string;
  studentId: string;
  term: string;
  evaluationDate: string;
  earlyLiteracy: 'EXCELLING' | 'MEETING_STANDARDS' | 'DEVELOPING' | 'NEEDS_SUPPORT';
  numeracySkills: 'EXCELLING' | 'MEETING_STANDARDS' | 'DEVELOPING' | 'NEEDS_SUPPORT';
  fineGrossMotor: 'EXCELLING' | 'MEETING_STANDARDS' | 'DEVELOPING' | 'NEEDS_SUPPORT';
  socialBehavior: 'EXCELLING' | 'MEETING_STANDARDS' | 'DEVELOPING' | 'NEEDS_SUPPORT';
  hygieneSelfCare: 'EXCELLING' | 'MEETING_STANDARDS' | 'DEVELOPING' | 'NEEDS_SUPPORT';
  teacherFeedback: string;
  headmasterEndorsement: boolean;
}

export interface ParentFeedbackMessage {
  id: string;
  parentId: string;
  parentName: string;
  studentName: string;
  studentClass: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'PENDING_REPLY' | 'REPLIED';
  response?: {
    repliedBy: string;
    repliedAt: string;
    message: string;
  };
}
