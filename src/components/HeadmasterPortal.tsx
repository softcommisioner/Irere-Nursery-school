import React, { useMemo, useState } from 'react';
import {
  FeePayment,
  LedgerEntry,
  SchoolClass,
  Student,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  User
} from '../types';
import { CreateClassInput, CreateStaffInput, CreateStudentInput } from '../services/api';
import { ParentRegistrationInput } from '../services/auth';
import { imageFileToDataUrl } from '../utils/images';
import {
  Users,
  UserCog,
  UserPlus,
  UserCheck,
  GraduationCap,
  ImagePlus,
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  CheckCheck,
  X,
  BarChart3,
  Wallet,
  Loader2,
  KeyRound,
  Copy,
  Check,
  Mail,
  AlertCircle,
  Plus,
  ClipboardList
} from 'lucide-react';
import {
  CardActions,
  ConfirmDialog,
  RecordEditModal,
  RecordEditField,
  StudentEditModal,
  StudentEditValues,
  StudentRegisterTable
} from './StudentDialogs';
import { Badge, EmptyState, ProgressBar, SectionCard, StatCard, Tabs, cx } from './ui';

interface HeadmasterPortalProps {
  classes: SchoolClass[];
  students: Student[];
  staff: User[];
  teacherAttendance: TeacherAttendanceRecord[];
  payments: FeePayment[];
  ledger: LedgerEntry[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onCreateStaff: (input: CreateStaffInput) => Promise<User>;
  onRegisterParent: (input: ParentRegistrationInput) => Promise<void>;
  onRegisterStudent: (input: Omit<CreateStudentInput, 'regNumber'>) => Promise<Student>;
  onUpdateStudent: (id: string, values: StudentEditValues) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onCreateClass: (input: CreateClassInput) => Promise<SchoolClass>;
  onUpdateStaff: (
    id: string,
    input: {
      name: string;
      email: string;
      phone?: string;
      role: User['role'];
      title: string;
    }
  ) => Promise<void>;
  onDeleteStaff: (id: string) => Promise<void>;
  onUpdateClass: (id: string, input: CreateClassInput) => Promise<void>;
  onDeleteClass: (id: string) => Promise<void>;
  onUpdateTeacherAttendance: (
    id: string,
    input: {
      date: string;
      checkInTime: string;
      checkOutTime?: string;
      notes?: string;
      status: TeacherAttendanceStatus;
    }
  ) => Promise<void>;
  onDeleteTeacherAttendance: (id: string) => Promise<void>;
  onUpdatePayment: (
    id: string,
    input: {
      amount: number;
      academicTerm: string;
      paymentMethod: FeePayment['paymentMethod'];
      momoTransactionRef?: string;
      payerName: string;
      payerPhone: string;
      paymentDate: string;
      status: FeePayment['status'];
    }
  ) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
}

type Tab =
  | 'OVERVIEW'
  | 'STAFF'
  | 'PARENTS'
  | 'STUDENTS'
  | 'CLASSES'
  | 'ATTENDANCE'
  | 'FINANCE';

const formatRwf = (amount: number) => `${(amount ?? 0).toLocaleString()} RWF`;

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-colors';
const labelCls = 'block text-[11px] font-semibold text-slate-600 mb-1';

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className
}) => (
  <div className={className}>
    <label className={labelCls}>{label}</label>
    {children}
  </div>
);

const Notice: React.FC<{ tone: 'ok' | 'error'; children: React.ReactNode }> = ({
  tone,
  children
}) => (
  <div
    className={
      tone === 'ok'
        ? 'flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-800'
        : 'flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800'
    }
  >
    {tone === 'ok' ? (
      <CheckCircle2 className="w-4 h-4 shrink-0" />
    ) : (
      <AlertCircle className="w-4 h-4 shrink-0" />
    )}
    <span className="flex-1">{children}</span>
  </div>
);

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined
        );
      }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const StatusBadge: React.FC<{ status: TeacherAttendanceStatus }> = ({ status }) => {
  const tone = status === 'APPROVED' ? 'emerald' : status === 'PENDING' ? 'amber' : 'rose';
  return <Badge tone={tone}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
};

const roleLabel: Record<string, string> = {
  HEADMASTER: 'Headmaster',
  ACCOUNTANT: 'Accountant',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  SPONSOR: 'Sponsor'
};

export const HeadmasterPortal: React.FC<HeadmasterPortalProps> = ({
  classes,
  students,
  staff,
  teacherAttendance,
  payments,
  ledger,
  onApprove,
  onReject,
  onCreateStaff,
  onRegisterParent,
  onRegisterStudent,
  onUpdateStudent,
  onDeleteStudent,
  onCreateClass,
  onUpdateStaff,
  onDeleteStaff,
  onUpdateClass,
  onDeleteClass,
  onUpdateTeacherAttendance,
  onDeleteTeacherAttendance,
  onUpdatePayment,
  onDeletePayment
}) => {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [busyId, setBusyId] = useState<string | null>(null);

  /* ----------------------------- Staff department ----------------------- */
  const [staffForm, setStaffForm] = useState<{
    name: string;
    role: CreateStaffInput['role'];
    title: string;
    email: string;
    phone: string;
    password: string;
  }>({
    name: '',
    role: 'TEACHER',
    title: 'Lead Teacher',
    email: '',
    phone: '',
    password: ''
  });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    role: string;
  } | null>(null);

  /* --------------------------- Parent department ------------------------ */
  const [parentForm, setParentForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    linkedStudentReg: '',
    linkedStudentName: ''
  });
  const [parentBusy, setParentBusy] = useState(false);
  const [parentMsg, setParentMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [parentCredentials, setParentCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    student: string;
  } | null>(null);

  /* --------------------------- Student department ----------------------- */
  const [studentForm, setStudentForm] = useState({
    firstName: '',
    lastName: '',
    gender: 'F' as 'M' | 'F',
    dob: '',
    classId: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    residenceVillage: 'Ngaruyinka',
    photoUrl: '',
    tuitionFeeTerm: 180000
  });
  const [studentBusy, setStudentBusy] = useState(false);
  const [studentPhotoBusy, setStudentPhotoBusy] = useState(false);
  const [studentMsg, setStudentMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ---------------------------- Class department ------------------------ */
  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    kinyarwandaName: '',
    ageRange: '',
    teacherName: '',
    roomNumber: '',
    capacity: 30
  });
  const [classBusy, setClassBusy] = useState(false);
  const [classMsg, setClassMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  /* ------------------------- Card edit / delete state ------------------- */
  const [staffAction, setStaffAction] = useState<{
    mode: 'edit' | 'delete';
    member: User;
  } | null>(null);
  const [staffActionBusy, setStaffActionBusy] = useState(false);
  const [staffActionError, setStaffActionError] = useState<string | null>(null);

  const [classAction, setClassAction] = useState<{
    mode: 'edit' | 'delete';
    item: SchoolClass;
  } | null>(null);
  const [classActionBusy, setClassActionBusy] = useState(false);
  const [classActionError, setClassActionError] = useState<string | null>(null);

  const [attendanceAction, setAttendanceAction] = useState<{
    mode: 'edit' | 'delete';
    record: TeacherAttendanceRecord;
  } | null>(null);
  const [attendanceActionBusy, setAttendanceActionBusy] = useState(false);
  const [attendanceActionError, setAttendanceActionError] = useState<string | null>(null);

  const [paymentAction, setPaymentAction] = useState<{
    mode: 'edit' | 'delete';
    payment: FeePayment;
  } | null>(null);
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);
  const [paymentActionError, setPaymentActionError] = useState<string | null>(null);

  /* ------------------------------- Derived ------------------------------ */
  const pending = teacherAttendance.filter((r) => r.status === 'PENDING');
  const approved = teacherAttendance.filter((r) => r.status === 'APPROVED');

  const parentDirectory = useMemo(() => {
    const map = new Map<
      string,
      { name: string; email: string; phone: string; children: string[] }
    >();
    students.forEach((student) => {
      const email = (student.parentEmail ?? '').trim();
      if (!email) return;
      const key = email.toLowerCase();
      const existing = map.get(key);
      const child = `${student.firstName} ${student.lastName} (${student.regNumber})`;
      if (existing) {
        existing.children.push(child);
      } else {
        map.set(key, {
          name: student.parentName || 'Parent / Guardian',
          email,
          phone: student.parentPhone ?? '',
          children: [child]
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const totalBilled = students.reduce((a, s) => a + (s.tuitionFeeTerm ?? 0), 0);
  const totalCollected = students.reduce((a, s) => a + (s.paidAmount ?? 0), 0);
  const totalOutstanding = students.reduce((a, s) => a + (s.balance ?? 0), 0);
  const totalIncome = ledger.filter((e) => e.type === 'INCOME').reduce((a, e) => a + e.amount, 0);
  const totalExpense = ledger.filter((e) => e.type === 'EXPENSE').reduce((a, e) => a + e.amount, 0);
  const net = totalIncome - totalExpense;

  const sorted = [...teacherAttendance].sort((a, b) => {
    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
    return b.date.localeCompare(a.date);
  });

  const handleReview = async (id: string, action: (id: string) => Promise<void>) => {
    setBusyId(id);
    try {
      await action(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffMsg(null);
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      setStaffMsg({ tone: 'error', text: 'Full name and work email are required.' });
      return;
    }
    if (staffForm.password.length < 8) {
      setStaffMsg({
        tone: 'error',
        text: 'Assign a password with at least 8 characters.'
      });
      return;
    }
    const password = staffForm.password;
    setStaffBusy(true);
    try {
      const created = await onCreateStaff({
        name: staffForm.name.trim(),
        email: staffForm.email.trim(),
        phone: staffForm.phone.trim() || undefined,
        role: staffForm.role,
        title: staffForm.title.trim() || (staffForm.role === 'ACCOUNTANT' ? 'Accountant' : 'Teacher'),
        password
      });
      setCredentials({
        name: created.name,
        email: created.email,
        password,
        role: roleLabel[created.role] ?? created.role
      });
      setStaffMsg({
        tone: 'ok',
        text: `${created.name} was added as ${roleLabel[created.role] ?? created.role}.`
      });
      setStaffForm({
        name: '',
        role: 'TEACHER',
        title: 'Lead Teacher',
        email: '',
        phone: '',
        password: ''
      });
    } catch (err) {
      setStaffMsg({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not create the staff account.'
      });
    } finally {
      setStaffBusy(false);
    }
  };

  const handleRegisterParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentMsg(null);

    if (!parentForm.name.trim()) {
      setParentMsg({ tone: 'error', text: 'Parent / guardian full name is required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentForm.email.trim())) {
      setParentMsg({ tone: 'error', text: 'Enter a valid parent email address.' });
      return;
    }
    if (parentForm.password.length < 8) {
      setParentMsg({
        tone: 'error',
        text: 'Assign a password with at least 8 characters.'
      });
      return;
    }
    if (!parentForm.linkedStudentReg.trim()) {
      setParentMsg({
        tone: 'error',
        text: 'Enter the registration number of the child this parent should access.'
      });
      return;
    }

    const linkedStudent = students.find(
      (student) =>
        student.regNumber.toLowerCase() ===
        parentForm.linkedStudentReg.trim().toLowerCase()
    );
    const password = parentForm.password;
    setParentBusy(true);
    try {
      await onRegisterParent({
        name: parentForm.name.trim(),
        email: parentForm.email.trim(),
        phone: parentForm.phone.trim() || undefined,
        password,
        linkedStudentReg: linkedStudent?.regNumber ?? parentForm.linkedStudentReg.trim(),
        linkedStudentName:
          parentForm.linkedStudentName.trim() ||
          (linkedStudent
            ? `${linkedStudent.firstName} ${linkedStudent.lastName}`
            : undefined)
      });
      setParentCredentials({
        name: parentForm.name.trim(),
        email: parentForm.email.trim(),
        password,
        student: linkedStudent
          ? `${linkedStudent.firstName} ${linkedStudent.lastName} (${linkedStudent.regNumber})`
          : parentForm.linkedStudentReg.trim().toUpperCase()
      });
      setParentMsg({
        tone: 'ok',
        text: `${parentForm.name.trim()} can now log in to the Parent portal.`
      });
      setParentForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        linkedStudentReg: '',
        linkedStudentName: ''
      });
    } catch (err) {
      setParentMsg({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not create the parent account.'
      });
    } finally {
      setParentBusy(false);
    }
  };

  const handleStudentPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setStudentMsg(null);
    setStudentPhotoBusy(true);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      setStudentForm((f) => ({ ...f, photoUrl: dataUrl }));
    } catch (err) {
      setStudentMsg({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not process the student photo.'
      });
    } finally {
      setStudentPhotoBusy(false);
    }
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentMsg(null);
    const cls = classes.find((c) => c.id === studentForm.classId);
    if (!studentForm.firstName.trim() || !studentForm.lastName.trim()) {
      setStudentMsg({ tone: 'error', text: 'Student first and last name are required.' });
      return;
    }
    if (!cls) {
      setStudentMsg({ tone: 'error', text: 'Please choose a class for the new student.' });
      return;
    }
    setStudentBusy(true);
    try {
      const created = await onRegisterStudent({
        firstName: studentForm.firstName.trim(),
        lastName: studentForm.lastName.trim(),
        gender: studentForm.gender,
        dob: studentForm.dob,
        classId: cls.id,
        className: cls.name,
        parentName: studentForm.parentName.trim(),
        parentPhone: studentForm.parentPhone.trim(),
        parentEmail: studentForm.parentEmail.trim(),
        residenceVillage: studentForm.residenceVillage.trim(),
        photoUrl: studentForm.photoUrl || undefined,
        tuitionFeeTerm: Number(studentForm.tuitionFeeTerm) || 0
      });
      setStudentMsg({
        tone: 'ok',
        text: `${created.firstName} ${created.lastName} registered — ID ${created.regNumber} (${created.className}).`
      });
      setStudentForm({
        firstName: '',
        lastName: '',
        gender: 'F',
        dob: '',
        classId: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        residenceVillage: 'Ngaruyinka',
        photoUrl: '',
        tuitionFeeTerm: 180000
      });
    } catch (err) {
      setStudentMsg({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not register the student.'
      });
    } finally {
      setStudentBusy(false);
    }
  };

  const handleSaveStudentEdit = async (id: string, values: StudentEditValues) => {
    setEditBusy(true);
    setEditError(null);
    try {
      await onUpdateStudent(id, values);
      setStudentMsg({
        tone: 'ok',
        text: `${values.firstName} ${values.lastName} was updated successfully.`
      });
      setEditingStudent(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not update the student.');
    } finally {
      setEditBusy(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDeleteStudent(deletingStudent.id);
      setStudentMsg({
        tone: 'ok',
        text: `${deletingStudent.firstName} ${deletingStudent.lastName} was removed from the register.`
      });
      setDeletingStudent(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the student.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassMsg(null);
    if (!classForm.name.trim()) {
      setClassMsg({ tone: 'error', text: 'Class name is required.' });
      return;
    }
    setClassBusy(true);
    try {
      const created = await onCreateClass({
        code: classForm.code.trim() || `IRR-${classForm.name.trim().slice(0, 4).toUpperCase()}`,
        name: classForm.name.trim(),
        kinyarwandaName: classForm.kinyarwandaName.trim(),
        ageRange: classForm.ageRange.trim() || '3–6 yrs',
        teacherId: '',
        teacherName: classForm.teacherName.trim() || 'Unassigned',
        roomNumber: classForm.roomNumber.trim() || 'TBD',
        capacity: Number(classForm.capacity) || 30
      });
      setClassMsg({ tone: 'ok', text: `${created.name} is now active at the school.` });
      setClassForm({
        name: '',
        code: '',
        kinyarwandaName: '',
        ageRange: '',
        teacherName: '',
        roomNumber: '',
        capacity: 30
      });
    } catch (err) {
      setClassMsg({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not create the class.'
      });
    } finally {
      setClassBusy(false);
    }
  };

  const handleSaveStaffEdit = async (values: Record<string, string>) => {
    if (!staffAction || staffAction.mode !== 'edit') return;
    setStaffActionBusy(true);
    setStaffActionError(null);
    try {
      await onUpdateStaff(staffAction.member.id, {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        role: staffAction.member.role,
        title: values.title.trim()
      });
      setStaffAction(null);
    } catch (err) {
      setStaffActionError(err instanceof Error ? err.message : 'Could not update the staff account.');
    } finally {
      setStaffActionBusy(false);
    }
  };

  const handleConfirmStaffDelete = async () => {
    if (!staffAction || staffAction.mode !== 'delete') return;
    setStaffActionBusy(true);
    setStaffActionError(null);
    try {
      await onDeleteStaff(staffAction.member.id);
      setStaffAction(null);
    } catch (err) {
      setStaffActionError(err instanceof Error ? err.message : 'Could not delete the staff account.');
    } finally {
      setStaffActionBusy(false);
    }
  };

  const handleSaveClassEdit = async (values: Record<string, string>) => {
    if (!classAction || classAction.mode !== 'edit') return;
    setClassActionBusy(true);
    setClassActionError(null);
    try {
      await onUpdateClass(classAction.item.id, {
        code: values.code.trim(),
        name: values.name.trim(),
        kinyarwandaName: values.kinyarwandaName.trim(),
        ageRange: values.ageRange.trim(),
        teacherId: classAction.item.teacherId,
        teacherName: values.teacherName.trim() || 'Unassigned',
        roomNumber: values.roomNumber.trim() || 'TBD',
        capacity: Number(values.capacity) || 0
      });
      setClassAction(null);
    } catch (err) {
      setClassActionError(err instanceof Error ? err.message : 'Could not update the class.');
    } finally {
      setClassActionBusy(false);
    }
  };

  const handleConfirmClassDelete = async () => {
    if (!classAction || classAction.mode !== 'delete') return;
    setClassActionBusy(true);
    setClassActionError(null);
    try {
      await onDeleteClass(classAction.item.id);
      setClassAction(null);
    } catch (err) {
      setClassActionError(err instanceof Error ? err.message : 'Could not delete the class.');
    } finally {
      setClassActionBusy(false);
    }
  };

  const handleSaveAttendanceEdit = async (values: Record<string, string>) => {
    if (!attendanceAction || attendanceAction.mode !== 'edit') return;
    setAttendanceActionBusy(true);
    setAttendanceActionError(null);
    try {
      await onUpdateTeacherAttendance(attendanceAction.record.id, {
        date: values.date,
        checkInTime: values.checkInTime.trim(),
        checkOutTime: values.checkOutTime.trim() || undefined,
        notes: values.notes.trim() || undefined,
        status: values.status as TeacherAttendanceStatus
      });
      setAttendanceAction(null);
    } catch (err) {
      setAttendanceActionError(
        err instanceof Error ? err.message : 'Could not update the attendance record.'
      );
    } finally {
      setAttendanceActionBusy(false);
    }
  };

  const handleConfirmAttendanceDelete = async () => {
    if (!attendanceAction || attendanceAction.mode !== 'delete') return;
    setAttendanceActionBusy(true);
    setAttendanceActionError(null);
    try {
      await onDeleteTeacherAttendance(attendanceAction.record.id);
      setAttendanceAction(null);
    } catch (err) {
      setAttendanceActionError(
        err instanceof Error ? err.message : 'Could not delete the attendance record.'
      );
    } finally {
      setAttendanceActionBusy(false);
    }
  };

  const handleSavePaymentEdit = async (values: Record<string, string>) => {
    if (!paymentAction || paymentAction.mode !== 'edit') return;
    setPaymentActionBusy(true);
    setPaymentActionError(null);
    try {
      await onUpdatePayment(paymentAction.payment.id, {
        amount: Number(values.amount) || 0,
        academicTerm: values.academicTerm.trim(),
        paymentMethod: values.paymentMethod as FeePayment['paymentMethod'],
        momoTransactionRef: values.momoTransactionRef.trim() || undefined,
        payerName: values.payerName.trim(),
        payerPhone: values.payerPhone.trim(),
        paymentDate: values.paymentDate,
        status: values.status as FeePayment['status']
      });
      setPaymentAction(null);
    } catch (err) {
      setPaymentActionError(err instanceof Error ? err.message : 'Could not update the payment.');
    } finally {
      setPaymentActionBusy(false);
    }
  };

  const handleConfirmPaymentDelete = async () => {
    if (!paymentAction || paymentAction.mode !== 'delete') return;
    setPaymentActionBusy(true);
    setPaymentActionError(null);
    try {
      await onDeletePayment(paymentAction.payment.id);
      setPaymentAction(null);
    } catch (err) {
      setPaymentActionError(err instanceof Error ? err.message : 'Could not delete the payment.');
    } finally {
      setPaymentActionBusy(false);
    }
  };

  const staffEditFields: RecordEditField[] = [
    { key: 'name', label: 'Full name', required: true },
    { key: 'title', label: 'Title', required: true },
    { key: 'email', label: 'Email address', type: 'email', required: true },
    { key: 'phone', label: 'Phone' }
  ];

  const classEditFields: RecordEditField[] = [
    { key: 'name', label: 'Class name', required: true },
    { key: 'code', label: 'Class code' },
    { key: 'kinyarwandaName', label: 'Kinyarwanda name' },
    { key: 'ageRange', label: 'Age range' },
    { key: 'teacherName', label: 'Lead teacher' },
    { key: 'roomNumber', label: 'Classroom' },
    { key: 'capacity', label: 'Capacity', type: 'number', min: 0 }
  ];

  const attendanceEditFields: RecordEditField[] = [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'checkInTime', label: 'Check-in time', required: true },
    { key: 'checkOutTime', label: 'Check-out time' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' }
      ]
    },
    { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true }
  ];

  const paymentEditFields: RecordEditField[] = [
    { key: 'amount', label: 'Amount (RWF)', type: 'number', min: 0, required: true },
    { key: 'paymentDate', label: 'Payment date', type: 'date', required: true },
    {
      key: 'paymentMethod',
      label: 'Payment method',
      type: 'select',
      options: [
        { value: 'MTN_MOMO', label: 'MTN MoMo' },
        { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
        { value: 'BK_TRANSFER', label: 'BK Transfer' },
        { value: 'CASH', label: 'Cash' }
      ]
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'VERIFIED', label: 'Verified' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'RECONCILED', label: 'Reconciled' }
      ]
    },
    { key: 'payerName', label: 'Payer name' },
    { key: 'payerPhone', label: 'Payer phone' },
    { key: 'academicTerm', label: 'Academic term' },
    { key: 'momoTransactionRef', label: 'Transaction reference' }
  ];

  const renderAttendanceActions = (rec: TeacherAttendanceRecord) => {
    if (rec.status !== 'PENDING') {
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-slate-400">Reviewed</span>
          <CardActions
            onEdit={() => {
              setAttendanceActionError(null);
              setAttendanceAction({ mode: 'edit', record: rec });
            }}
            onDelete={() => {
              setAttendanceActionError(null);
              setAttendanceAction({ mode: 'delete', record: rec });
            }}
            editLabel="Edit attendance record"
            deleteLabel="Delete attendance record"
          />
        </div>
      );
    }
    const busy = busyId === rec.id;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleReview(rec.id, onApprove)}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCheck className="w-3.5 h-3.5" />
          )}
          Approve
        </button>
        <button
          onClick={() => handleReview(rec.id, onReject)}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Reject
        </button>
        <CardActions
          onEdit={() => {
            setAttendanceActionError(null);
            setAttendanceAction({ mode: 'edit', record: rec });
          }}
          onDelete={() => {
            setAttendanceActionError(null);
            setAttendanceAction({ mode: 'delete', record: rec });
          }}
          editLabel="Edit attendance record"
          deleteLabel="Delete attendance record"
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Headmaster Portal</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage staff accounts, student registration, classes, and review attendance &amp; finance.
        </p>
      </div>

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: 'OVERVIEW', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'STAFF', label: 'Staff', icon: <UserCog className="w-3.5 h-3.5" /> },
          { id: 'PARENTS', label: 'Parents', icon: <UserCheck className="w-3.5 h-3.5" /> },
          { id: 'STUDENTS', label: 'Students', icon: <UserPlus className="w-3.5 h-3.5" /> },
          { id: 'CLASSES', label: 'Classes', icon: <Layers className="w-3.5 h-3.5" /> },
          {
            id: 'ATTENDANCE',
            label: `Attendance${pending.length ? ` (${pending.length})` : ''}`,
            icon: <ClipboardList className="w-3.5 h-3.5" />
          },
          { id: 'FINANCE', label: 'Finance', icon: <Wallet className="w-3.5 h-3.5" /> }
        ]}
      />

      {/* ------------------------------- OVERVIEW ------------------------------ */}
      {tab === 'OVERVIEW' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              label="Total Students"
              value={students.length}
              sub="Enrolled this term"
              icon={<Users className="w-5 h-5" />}
              tone="orange"
            />
            <StatCard
              label="Staff Members"
              value={staff.filter((s) => s.role !== 'HEADMASTER').length}
              sub={`${staff.length} accounts total`}
              icon={<UserCog className="w-5 h-5" />}
              tone="blue"
            />
            <StatCard
              label="Active Classes"
              value={classes.length}
              sub="Baby · Middle · Top"
              icon={<Layers className="w-5 h-5" />}
              tone="orange"
            />
            <StatCard
              label="Pending Approvals"
              value={pending.length}
              sub={`${approved.length} approved`}
              icon={<Clock className="w-5 h-5" />}
              tone="amber"
            />
            <StatCard
              label="Fees Collected"
              value={formatRwf(totalCollected)}
              sub={`of ${formatRwf(totalBilled)}`}
              icon={<Wallet className="w-5 h-5" />}
              tone="emerald"
            />
            <StatCard
              label="Outstanding"
              value={formatRwf(totalOutstanding)}
              sub="Unpaid balances"
              icon={<XCircle className="w-5 h-5" />}
              tone="rose"
            />
          </div>

          <SectionCard
            title="Class Enrollment"
            subtitle="Pupils per class against capacity"
            icon={<GraduationCap className="w-5 h-5" />}
          >
            {classes.length === 0 ? (
              <EmptyState title="No classes yet" message="Add a class in the Classes tab." />
            ) : (
              <div className="p-4 sm:p-5 space-y-4">
                {classes.map((cls) => {
                  const enrolled = students.filter((s) => s.classId === cls.id).length;
                  const percent = cls.capacity > 0 ? (enrolled / cls.capacity) * 100 : 0;
                  return (
                    <div key={cls.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">{cls.name}</span>
                        <span className="text-slate-500">
                          {enrolled} / {cls.capacity}
                        </span>
                      </div>
                      <ProgressBar percent={percent} />
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* -------------------------------- STAFF -------------------------------- */}
      {tab === 'STAFF' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard
            title="Create staff account"
            subtitle="Accountant & teacher logins"
            icon={<UserCog className="w-5 h-5" />}
            className="lg:col-span-1"
            bodyClassName="p-4 sm:p-5"
          >
            <form onSubmit={handleCreateStaff} className="space-y-3">
              <Field label="Full name">
                <input
                  className={inputCls}
                  placeholder="e.g. Uwimana Aline"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Role">
                <select
                  className={inputCls}
                  value={staffForm.role}
                  onChange={(e) => {
                    const role = e.target.value as CreateStaffInput['role'];
                    setStaffForm((f) => ({
                      ...f,
                      role,
                      title: role === 'ACCOUNTANT' ? 'School Accountant' : 'Lead Teacher'
                    }));
                  }}
                >
                  <option value="TEACHER">Teacher</option>
                  <option value="ACCOUNTANT">Accountant</option>
                </select>
              </Field>
              <Field label="Title">
                <input
                  className={inputCls}
                  placeholder="e.g. Lead Teacher · Baby Class"
                  value={staffForm.title}
                  onChange={(e) => setStaffForm((f) => ({ ...f, title: e.target.value }))}
                />
              </Field>
              <Field label="Official work email">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="name@irerenursery.rw"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label="Phone (optional)">
                <input
                  className={inputCls}
                  placeholder="+250 7xx xxx xxx"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
              <Field label="Account password">
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputCls}
                  placeholder="At least 8 characters"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
              <button
                type="submit"
                disabled={staffBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {staffBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create account
              </button>
              {staffMsg && <Notice tone={staffMsg.tone}>{staffMsg.text}</Notice>}
            </form>
          </SectionCard>

          <div className="lg:col-span-2 space-y-4">
            {credentials && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-orange-600" />
                  <p className="text-sm font-bold text-orange-900">Share these login credentials</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Email</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-slate-800 break-all">{credentials.email}</span>
                      <CopyButton value={credentials.email} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">
                      Assigned password
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-slate-800 break-all">
                        {credentials.password}
                      </span>
                      <CopyButton value={credentials.password} />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-orange-800">
                  {credentials.name} · {credentials.role}. Shown once — store it securely. If your
                  Supabase project requires email confirmation, confirm the address before the
                  first login.
                </p>
              </div>
            )}

            <SectionCard
              title="Staff directory"
              subtitle={`${staff.length} accounts`}
              icon={<Users className="w-5 h-5" />}
            >
              {staff.length === 0 ? (
                <EmptyState title="No staff accounts yet" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {staff.map((member) => (
                    <div key={member.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 shrink-0 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                          {member.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {member.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{member.title}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                          <Badge tone={member.role === 'ACCOUNTANT' ? 'blue' : 'orange'}>
                            {roleLabel[member.role] ?? member.role}
                          </Badge>
                          <CardActions
                            onEdit={() => {
                              setStaffActionError(null);
                              setStaffAction({ mode: 'edit', member });
                            }}
                            onDelete={() => {
                              setStaffActionError(null);
                              setStaffAction({ mode: 'delete', member });
                            }}
                            editLabel={`Edit ${member.name}`}
                            deleteLabel={`Delete ${member.name}`}
                          />
                        </div>
                        <p className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[140px]">{member.email}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ------------------------------- PARENTS ------------------------------- */}
      {tab === 'PARENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard
            title="Create parent account"
            subtitle="Linked to a pupil"
            icon={<UserCheck className="w-5 h-5" />}
            className="lg:col-span-1"
            bodyClassName="p-4 sm:p-5"
          >
            <form onSubmit={handleRegisterParent} className="space-y-3">
              <Field label="Full name">
                <input
                  className={inputCls}
                  placeholder="e.g. Mugisha Diane"
                  value={parentForm.name}
                  onChange={(e) => setParentForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="parent@example.com"
                  value={parentForm.email}
                  onChange={(e) => setParentForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label="Phone (optional)">
                <input
                  className={inputCls}
                  placeholder="+250 7xx xxx xxx"
                  value={parentForm.phone}
                  onChange={(e) => setParentForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </Field>
              <Field label="Account password">
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputCls}
                  placeholder="At least 8 characters"
                  value={parentForm.password}
                  onChange={(e) => setParentForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
              <Field label="Child registration number">
                <input
                  className={`${inputCls} font-mono uppercase`}
                  placeholder="IRR-2026-001"
                  list="parent-student-regs"
                  value={parentForm.linkedStudentReg}
                  onChange={(e) =>
                    setParentForm((f) => ({ ...f, linkedStudentReg: e.target.value }))
                  }
                />
                <datalist id="parent-student-regs">
                  {students.map((student) => (
                    <option key={student.id} value={student.regNumber}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Child full name (optional)">
                <input
                  className={inputCls}
                  placeholder="e.g. Mugisha Kevin"
                  value={parentForm.linkedStudentName}
                  onChange={(e) =>
                    setParentForm((f) => ({ ...f, linkedStudentName: e.target.value }))
                  }
                />
              </Field>
              <button
                type="submit"
                disabled={parentBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {parentBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Create parent account
              </button>
              {parentMsg && <Notice tone={parentMsg.tone}>{parentMsg.text}</Notice>}
            </form>
          </SectionCard>

          <div className="lg:col-span-2 space-y-4">
            {parentCredentials && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-orange-600" />
                  <p className="text-sm font-bold text-orange-900">Share these login credentials</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Email</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-slate-800 break-all">
                        {parentCredentials.email}
                      </span>
                      <CopyButton value={parentCredentials.email} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white border border-orange-200 p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">
                      Assigned password
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-slate-800 break-all">
                        {parentCredentials.password}
                      </span>
                      <CopyButton value={parentCredentials.password} />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-orange-800">
                  {parentCredentials.name} · linked to {parentCredentials.student}. Shown once —
                  store it securely. If your Supabase project requires email confirmation, confirm
                  the address before the first login.
                </p>
              </div>
            )}

            <SectionCard
              title="Parent contacts"
              subtitle={`${parentDirectory.length} guardians on record`}
              icon={<Users className="w-5 h-5" />}
            >
              {parentDirectory.length === 0 ? (
                <EmptyState
                  title="No parents on record"
                  message="Register a student with parent contact details or create a parent account on the left."
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {parentDirectory.map((parent) => (
                    <div
                      key={parent.email}
                      className="p-4 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-9 h-9 shrink-0 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">
                          {parent.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {parent.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{parent.email}</p>
                          {parent.phone && (
                            <p className="text-[10px] text-slate-400">{parent.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 max-w-[45%]">
                        <Badge tone="orange">
                          {parent.children.length} {parent.children.length === 1 ? 'child' : 'children'}
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">
                          {parent.children.join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ------------------------------- STUDENTS ------------------------------ */}
      {tab === 'STUDENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard
            title="Register new student"
            subtitle="Auto-generated registration number"
            icon={<UserPlus className="w-5 h-5" />}
            className="lg:col-span-1"
            bodyClassName="p-4 sm:p-5"
          >
            <form onSubmit={handleRegisterStudent} className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  {studentForm.photoUrl ? (
                    <img
                      src={studentForm.photoUrl}
                      alt="New student preview"
                      className="w-14 h-[4.5rem] shrink-0 rounded-lg border-2 border-orange-200 object-cover bg-white"
                    />
                  ) : (
                    <span className="w-14 h-[4.5rem] shrink-0 rounded-lg border-2 border-dashed border-slate-300 bg-white text-slate-400 flex items-center justify-center">
                      <ImagePlus className="w-5 h-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">Student photo</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Attach a clear portrait for the profile and bulletin.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label
                        className={cx(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 transition-colors',
                          studentPhotoBusy || studentBusy
                            ? 'opacity-60 cursor-wait'
                            : 'cursor-pointer hover:bg-orange-50 hover:text-orange-700'
                        )}
                      >
                        {studentPhotoBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        {studentForm.photoUrl ? 'Change photo' : 'Upload photo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={studentPhotoBusy || studentBusy}
                          onChange={(event) => void handleStudentPhotoChange(event)}
                        />
                      </label>
                      {studentForm.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setStudentForm((f) => ({ ...f, photoUrl: '' }))}
                          disabled={studentPhotoBusy || studentBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name">
                  <input
                    className={inputCls}
                    value={studentForm.firstName}
                    onChange={(e) =>
                      setStudentForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className={inputCls}
                    value={studentForm.lastName}
                    onChange={(e) => setStudentForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender">
                  <select
                    className={inputCls}
                    value={studentForm.gender}
                    onChange={(e) =>
                      setStudentForm((f) => ({ ...f, gender: e.target.value as 'M' | 'F' }))
                    }
                  >
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                  </select>
                </Field>
                <Field label="Date of birth">
                  <input
                    type="date"
                    className={inputCls}
                    value={studentForm.dob}
                    onChange={(e) => setStudentForm((f) => ({ ...f, dob: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Class">
                <select
                  className={inputCls}
                  value={studentForm.classId}
                  onChange={(e) => {
                    const classId = e.target.value;
                    const cls = classes.find((c) => c.id === classId);
                    const lower = cls?.name.toLowerCase() ?? '';
                    const tuition = lower.includes('baby')
                      ? 180000
                      : lower.includes('middle')
                        ? 200000
                        : lower.includes('top')
                          ? 220000
                          : studentForm.tuitionFeeTerm;
                    setStudentForm((f) => ({ ...f, classId, tuitionFeeTerm: tuition }));
                  }}
                >
                  <option value="">Select a class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Term tuition fee (RWF)">
                <input
                  type="number"
                  className={inputCls}
                  value={studentForm.tuitionFeeTerm}
                  onChange={(e) =>
                    setStudentForm((f) => ({ ...f, tuitionFeeTerm: Number(e.target.value) }))
                  }
                />
              </Field>
              <Field label="Parent / guardian name">
                <input
                  className={inputCls}
                  value={studentForm.parentName}
                  onChange={(e) => setStudentForm((f) => ({ ...f, parentName: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Parent phone">
                  <input
                    className={inputCls}
                    value={studentForm.parentPhone}
                    onChange={(e) =>
                      setStudentForm((f) => ({ ...f, parentPhone: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Residence village">
                  <input
                    className={inputCls}
                    value={studentForm.residenceVillage}
                    onChange={(e) =>
                      setStudentForm((f) => ({ ...f, residenceVillage: e.target.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="Parent email">
                <input
                  type="email"
                  className={inputCls}
                  value={studentForm.parentEmail}
                  onChange={(e) => setStudentForm((f) => ({ ...f, parentEmail: e.target.value }))}
                />
              </Field>
              <button
                type="submit"
                disabled={studentBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {studentBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Register student
              </button>
              {studentMsg && <Notice tone={studentMsg.tone}>{studentMsg.text}</Notice>}
            </form>
          </SectionCard>

          <SectionCard
            title="Student register"
            subtitle={`${students.length} pupils enrolled`}
            icon={<Users className="w-5 h-5" />}
            className="lg:col-span-2"
          >
            {students.length === 0 ? (
              <EmptyState title="No students registered yet" />
            ) : (
              <StudentRegisterTable
                students={students}
                busyId={deleteBusy ? deletingStudent?.id ?? null : null}
                onEdit={(student) => {
                  setEditError(null);
                  setEditingStudent(student);
                }}
                onDelete={(student) => {
                  setDeleteError(null);
                  setDeletingStudent(student);
                }}
              />
            )}
          </SectionCard>
        </div>
      )}

      {/* -------------------------------- CLASSES ------------------------------ */}
      {tab === 'CLASSES' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard
            title="Add a class"
            subtitle="Baby · Middle · Top"
            icon={<Layers className="w-5 h-5" />}
            className="lg:col-span-1"
            bodyClassName="p-4 sm:p-5"
          >
            <form onSubmit={handleCreateClass} className="space-y-3">
              <Field label="Class name">
                <input
                  className={inputCls}
                  placeholder="e.g. Top Class"
                  value={classForm.name}
                  onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
              <Field label="Kinyarwanda name">
                <input
                  className={inputCls}
                  placeholder="e.g. Urwunge rwa Hejuru"
                  value={classForm.kinyarwandaName}
                  onChange={(e) =>
                    setClassForm((f) => ({ ...f, kinyarwandaName: e.target.value }))
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Class code">
                  <input
                    className={inputCls}
                    placeholder="IRR-TOP"
                    value={classForm.code}
                    onChange={(e) => setClassForm((f) => ({ ...f, code: e.target.value }))}
                  />
                </Field>
                <Field label="Age range">
                  <input
                    className={inputCls}
                    placeholder="5–6 yrs"
                    value={classForm.ageRange}
                    onChange={(e) => setClassForm((f) => ({ ...f, ageRange: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Lead teacher">
                <input
                  className={inputCls}
                  placeholder="Teacher name"
                  value={classForm.teacherName}
                  onChange={(e) => setClassForm((f) => ({ ...f, teacherName: e.target.value }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Classroom">
                  <input
                    className={inputCls}
                    placeholder="Block B · Rm 1"
                    value={classForm.roomNumber}
                    onChange={(e) => setClassForm((f) => ({ ...f, roomNumber: e.target.value }))}
                  />
                </Field>
                <Field label="Capacity">
                  <input
                    type="number"
                    className={inputCls}
                    value={classForm.capacity}
                    onChange={(e) =>
                      setClassForm((f) => ({ ...f, capacity: Number(e.target.value) }))
                    }
                  />
                </Field>
              </div>
              <button
                type="submit"
                disabled={classBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {classBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add class
              </button>
              {classMsg && <Notice tone={classMsg.tone}>{classMsg.text}</Notice>}
            </form>
          </SectionCard>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {classes.length === 0 ? (
              <div className="sm:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                <EmptyState title="No classes yet" message="Add the first class on the left." />
              </div>
            ) : (
              classes.map((cls) => {
                const enrolled = students.filter((s) => s.classId === cls.id).length;
                const collected = students
                  .filter((s) => s.classId === cls.id)
                  .reduce((a, s) => a + (s.paidAmount ?? 0), 0);
                return (
                  <div
                    key={cls.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500">{cls.code}</span>
                      <div className="flex items-center gap-2">
                        <Badge tone="slate">{cls.ageRange}</Badge>
                        <CardActions
                          onEdit={() => {
                            setClassActionError(null);
                            setClassAction({ mode: 'edit', item: cls });
                          }}
                          onDelete={() => {
                            setClassActionError(null);
                            setClassAction({ mode: 'delete', item: cls });
                          }}
                          editLabel={`Edit ${cls.name}`}
                          deleteLabel={`Delete ${cls.name}`}
                        />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{cls.name}</h3>
                      <p className="text-xs text-slate-500">{cls.kinyarwandaName}</p>
                    </div>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Lead Teacher</span>
                        <span className="font-semibold text-slate-800">{cls.teacherName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Classroom</span>
                        <span className="text-slate-700">{cls.roomNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Enrolled</span>
                        <span className="font-semibold text-slate-800">
                          {enrolled} / {cls.capacity}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs flex justify-between">
                      <span className="text-slate-500">Fees collected</span>
                      <span className="font-semibold text-emerald-600">{formatRwf(collected)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ ATTENDANCE ----------------------------- */}
      {tab === 'ATTENDANCE' && (
        <SectionCard
          title="Staff attendance review"
          subtitle="Approve or reject daily check-in requests"
          icon={<ClipboardList className="w-5 h-5" />}
        >
          {sorted.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-9 h-9" />}
              title="No attendance requests"
              message="Teacher check-in requests will appear here once submitted."
            />
          ) : (
            <>
              <div className="sm:hidden divide-y divide-slate-100">
                {sorted.map((rec) => (
                  <div key={rec.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{rec.teacherName}</p>
                        <p className="text-[11px] text-slate-500">
                          {rec.date} · Check-in {rec.checkInTime}
                        </p>
                      </div>
                      <StatusBadge status={rec.status} />
                    </div>
                    {rec.notes && (
                      <p className="text-[11px] text-slate-500 italic">"{rec.notes}"</p>
                    )}
                    {renderAttendanceActions(rec)}
                  </div>
                ))}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Teacher</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Check-in</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{rec.teacherName}</p>
                          {rec.gpsLocation?.isWithinCampus && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 mt-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              On campus
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{rec.date}</td>
                        <td className="py-3 px-4 text-slate-600">{rec.checkInTime}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end">{renderAttendanceActions(rec)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* ------------------------------- FINANCE ------------------------------- */}
      {tab === 'FINANCE' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Billed (Term)"
              value={formatRwf(totalBilled)}
              icon={<Wallet className="w-5 h-5" />}
              tone="orange"
            />
            <StatCard
              label="Collected"
              value={formatRwf(totalCollected)}
              icon={<CheckCircle2 className="w-5 h-5" />}
              tone="emerald"
            />
            <StatCard
              label="Outstanding"
              value={formatRwf(totalOutstanding)}
              icon={<XCircle className="w-5 h-5" />}
              tone="rose"
            />
            <StatCard
              label="Net (Income − Expense)"
              value={formatRwf(net)}
              icon={<BarChart3 className="w-5 h-5" />}
              tone="blue"
            />
          </div>

          <SectionCard
            title="Fee summary by class"
            subtitle="Collected vs. outstanding per class"
            icon={<GraduationCap className="w-5 h-5" />}
          >
            {classes.length === 0 ? (
              <EmptyState title="No classes to summarise" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Class</th>
                      <th className="py-3 px-4 font-semibold">Students</th>
                      <th className="py-3 px-4 font-semibold">Billed</th>
                      <th className="py-3 px-4 font-semibold">Collected</th>
                      <th className="py-3 px-4 font-semibold">Outstanding</th>
                      <th className="py-3 px-4 font-semibold">Collection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((cls) => {
                      const list = students.filter((s) => s.classId === cls.id);
                      const billed = list.reduce((a, s) => a + (s.tuitionFeeTerm ?? 0), 0);
                      const collected = list.reduce((a, s) => a + (s.paidAmount ?? 0), 0);
                      const outstanding = Math.max(0, billed - collected);
                      const percent = billed > 0 ? (collected / billed) * 100 : 0;
                      return (
                        <tr key={cls.id}>
                          <td className="py-3 px-4 font-semibold text-slate-800">{cls.name}</td>
                          <td className="py-3 px-4 text-slate-600">{list.length}</td>
                          <td className="py-3 px-4 text-slate-600">{formatRwf(billed)}</td>
                          <td className="py-3 px-4 text-emerald-600 font-semibold">
                            {formatRwf(collected)}
                          </td>
                          <td className="py-3 px-4 text-rose-600 font-semibold">
                            {formatRwf(outstanding)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-28">
                              <ProgressBar percent={percent} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard
              title="Recent fee payments"
              subtitle={`${payments.length} records`}
              icon={<Wallet className="w-5 h-5" />}
            >
              {payments.length === 0 ? (
                <EmptyState title="No payments recorded" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.slice(0, 6).map((p) => (
                    <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {p.studentName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {p.receiptNumber} · {p.paymentMethod.replace(/_/g, ' ')} · {p.paymentDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-emerald-600">
                          {formatRwf(p.amount)}
                        </span>
                        <CardActions
                          onEdit={() => {
                            setPaymentActionError(null);
                            setPaymentAction({ mode: 'edit', payment: p });
                          }}
                          onDelete={() => {
                            setPaymentActionError(null);
                            setPaymentAction({ mode: 'delete', payment: p });
                          }}
                          editLabel={`Edit payment ${p.receiptNumber}`}
                          deleteLabel={`Delete payment ${p.receiptNumber}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Ledger summary"
              subtitle={`${ledger.length} entries`}
              icon={<BarChart3 className="w-5 h-5" />}
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <span className="text-xs font-semibold text-emerald-800">Total income</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {formatRwf(totalIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-rose-50 border border-rose-100 px-3 py-2.5">
                  <span className="text-xs font-semibold text-rose-800">Total expenses</span>
                  <span className="text-sm font-bold text-rose-700">{formatRwf(totalExpense)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <span className="text-xs font-semibold text-slate-700">Net position</span>
                  <span
                    className={`text-sm font-bold ${
                      net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatRwf(net)}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {editingStudent && (
        <StudentEditModal
          student={editingStudent}
          classes={classes}
          busy={editBusy}
          error={editError}
          onClose={() => {
            setEditingStudent(null);
            setEditError(null);
          }}
          onSave={handleSaveStudentEdit}
        />
      )}

      {deletingStudent && (
        <ConfirmDialog
          title="Delete student"
          message={
            <>
              Are you sure you want to delete this student?{' '}
              <strong>
                {deletingStudent.firstName} {deletingStudent.lastName} (
                {deletingStudent.regNumber})
              </strong>{' '}
              will be permanently removed from the register.
            </>
          }
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            setDeletingStudent(null);
            setDeleteError(null);
          }}
          onConfirm={handleConfirmDeleteStudent}
        />
      )}

      {staffAction?.mode === 'edit' && (
        <RecordEditModal
          key={staffAction.member.id}
          title="Edit staff account"
          subtitle={`${staffAction.member.name} · ${roleLabel[staffAction.member.role] ?? staffAction.member.role}`}
          fields={staffEditFields}
          initialValues={{
            name: staffAction.member.name,
            title: staffAction.member.title,
            email: staffAction.member.email,
            phone: staffAction.member.phone
          }}
          busy={staffActionBusy}
          error={staffActionError}
          onClose={() => {
            setStaffAction(null);
            setStaffActionError(null);
          }}
          onSave={handleSaveStaffEdit}
        />
      )}

      {staffAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete staff account"
          message={
            <>
              Remove <strong>{staffAction.member.name}</strong> from the staff directory? Their
              profile record will be deleted permanently.
            </>
          }
          busy={staffActionBusy}
          error={staffActionError}
          onCancel={() => {
            setStaffAction(null);
            setStaffActionError(null);
          }}
          onConfirm={handleConfirmStaffDelete}
        />
      )}

      {classAction?.mode === 'edit' && (
        <RecordEditModal
          key={classAction.item.id}
          title="Edit class"
          subtitle={`${classAction.item.name} · ${classAction.item.code}`}
          fields={classEditFields}
          initialValues={{
            name: classAction.item.name,
            code: classAction.item.code,
            kinyarwandaName: classAction.item.kinyarwandaName,
            ageRange: classAction.item.ageRange,
            teacherName: classAction.item.teacherName,
            roomNumber: classAction.item.roomNumber,
            capacity: classAction.item.capacity
          }}
          busy={classActionBusy}
          error={classActionError}
          onClose={() => {
            setClassAction(null);
            setClassActionError(null);
          }}
          onSave={handleSaveClassEdit}
        />
      )}

      {classAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete class"
          message={
            <>
              Delete <strong>{classAction.item.name}</strong>? Students currently assigned to this
              class will remain in the register but will need to be reassigned.
            </>
          }
          busy={classActionBusy}
          error={classActionError}
          onCancel={() => {
            setClassAction(null);
            setClassActionError(null);
          }}
          onConfirm={handleConfirmClassDelete}
        />
      )}

      {attendanceAction?.mode === 'edit' && (
        <RecordEditModal
          key={attendanceAction.record.id}
          title="Edit attendance record"
          subtitle={`${attendanceAction.record.teacherName} · ${attendanceAction.record.date}`}
          fields={attendanceEditFields}
          initialValues={{
            date: attendanceAction.record.date,
            checkInTime: attendanceAction.record.checkInTime,
            checkOutTime: attendanceAction.record.checkOutTime,
            status: attendanceAction.record.status,
            notes: attendanceAction.record.notes
          }}
          busy={attendanceActionBusy}
          error={attendanceActionError}
          onClose={() => {
            setAttendanceAction(null);
            setAttendanceActionError(null);
          }}
          onSave={handleSaveAttendanceEdit}
        />
      )}

      {attendanceAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete attendance record"
          message={
            <>
              Delete the check-in record for{' '}
              <strong>{attendanceAction.record.teacherName}</strong> on{' '}
              {attendanceAction.record.date}? This cannot be undone.
            </>
          }
          busy={attendanceActionBusy}
          error={attendanceActionError}
          onCancel={() => {
            setAttendanceAction(null);
            setAttendanceActionError(null);
          }}
          onConfirm={handleConfirmAttendanceDelete}
        />
      )}

      {paymentAction?.mode === 'edit' && (
        <RecordEditModal
          key={paymentAction.payment.id}
          title="Edit fee payment"
          subtitle={`${paymentAction.payment.studentName} · ${paymentAction.payment.receiptNumber}`}
          fields={paymentEditFields}
          initialValues={{
            amount: paymentAction.payment.amount,
            paymentDate: paymentAction.payment.paymentDate,
            paymentMethod: paymentAction.payment.paymentMethod,
            status: paymentAction.payment.status,
            payerName: paymentAction.payment.payerName,
            payerPhone: paymentAction.payment.payerPhone,
            academicTerm: paymentAction.payment.academicTerm,
            momoTransactionRef: paymentAction.payment.momoTransactionRef
          }}
          busy={paymentActionBusy}
          error={paymentActionError}
          onClose={() => {
            setPaymentAction(null);
            setPaymentActionError(null);
          }}
          onSave={handleSavePaymentEdit}
        />
      )}

      {paymentAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete fee payment"
          message={
            <>
              Delete the <strong>{formatRwf(paymentAction.payment.amount)}</strong> payment from{' '}
              {paymentAction.payment.studentName}? The student's paid total and balance will be
              adjusted automatically.
            </>
          }
          busy={paymentActionBusy}
          error={paymentActionError}
          onCancel={() => {
            setPaymentAction(null);
            setPaymentActionError(null);
          }}
          onConfirm={handleConfirmPaymentDelete}
        />
      )}
    </div>
  );
};
