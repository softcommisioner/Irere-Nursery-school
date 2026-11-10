import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CurriculumMaterial,
  FeePayment,
  LedgerEntry,
  ParentFeedbackMessage,
  SchoolClass,
  Student,
  StudentAttendanceRecord,
  StudentMilestoneEvaluation,
  TeacherAttendanceRecord,
  User,
  UserRole
} from './types';
import { SCHOOL_INFO } from './config/school';
import { HERO_SLIDES, HeroSlide } from './config/heroImages';
import * as api from './services/api';
import * as auth from './services/auth';
import { AuthSession, ROLE_LABELS } from './services/auth';
import { generateRegistrationNumber } from './utils/generators';
import { LandingHero } from './components/LandingHero';
import { AuthPortal } from './components/AuthPortal';
import { HeadmasterPortal } from './components/HeadmasterPortal';
import { AccountantPortal } from './components/AccountantPortal';
import { TeacherPortal } from './components/TeacherPortal';
import { ParentPortal } from './components/ParentPortal';
import { SponsorPortal } from './components/SponsorPortal';
import { ReadOnlyBadge } from './components/ui';
import {
  GraduationCap,
  Home,
  AlertCircle,
  RefreshCw,
  Loader2,
  LogOut
} from 'lucide-react';

type AppView = 'LANDING' | 'AUTH' | 'PORTALS';

export default function App() {
  const [view, setView] = useState<AppView>('LANDING');
  const [activeUser, setActiveUser] = useState<AuthSession | null>(() => auth.loadSession());
  const [parentLookupReg, setParentLookupReg] = useState<string | undefined>(
    () => auth.loadSession()?.linkedStudentReg
  );
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(HERO_SLIDES);
  const activeRole: UserRole = activeUser?.role ?? 'HEADMASTER';

  // All data is loaded live from Supabase. Records created or edited in any
  // portal are written directly to the database (INSERT/UPDATE/DELETE) — there
  // is no local fallback, so nothing is lost on refresh or logout.
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<TeacherAttendanceRecord[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<StudentAttendanceRecord[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumMaterial[]>([]);
  const [feedbacks, setFeedbacks] = useState<ParentFeedbackMessage[]>([]);
  const [evaluations, setEvaluations] = useState<StudentMilestoneEvaluation[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        classList,
        studentList,
        staffList,
        teacherAtt,
        studentAtt,
        paymentList,
        ledgerList,
        curriculumList,
        feedbackList,
        evaluationList
      ] = await Promise.all([
        api.getClasses(),
        api.getStudents(),
        api.getStaff(),
        api.getTeacherAttendance(),
        api.getStudentAttendance(),
        api.getFeePayments(),
        api.getLedger(),
        api.getCurriculum(),
        api.getFeedback(),
        api.getEvaluations()
      ]);
      setClasses(classList);
      setStudents(studentList);
      setStaff(staffList);
      setTeacherAttendance(teacherAtt);
      setStudentAttendance(studentAtt);
      setPayments(paymentList);
      setLedger(ledgerList);
      setCurriculum(curriculumList);
      setFeedbacks(feedbackList);
      setEvaluations(evaluationList);
    } catch (err) {
      // Keep whatever was previously loaded on screen and surface the error so
      // the user can retry. No local/demo data is substituted.
      setLoadError(err instanceof Error ? err.message : 'Could not load data from Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const parentStudent = useMemo(() => {
    if (!parentLookupReg) return null;
    const normalized = parentLookupReg.trim().toLowerCase();
    return (
      students.find((student) => student.regNumber.toLowerCase() === normalized) ?? null
    );
  }, [students, parentLookupReg]);

  const selectedStudent: Student | null =
    activeRole === 'PARENT' ? parentStudent : students[0] ?? null;
  const selectedEvaluation =
    evaluations.find((e) => e.studentId === selectedStudent?.id) ?? null;

  const handleAuthenticated = (session: AuthSession) => {
    setActiveUser(session);
    setParentLookupReg(session.linkedStudentReg);
    setView('PORTALS');
    // Fetch the latest live records from Supabase whenever a user signs in to
    // any portal so the session always starts from database truth.
    void loadData();
  };

  const handleLogout = () => {
    auth.clearSession();
    setActiveUser(null);
    setParentLookupReg(undefined);
    setView('AUTH');
  };

  const handleLookupStudent = (registrationNumber: string): boolean => {
    const normalized = registrationNumber.trim().toLowerCase();
    const match = students.find(
      (student) => student.regNumber.toLowerCase() === normalized
    );
    if (!match) return false;

    setParentLookupReg(match.regNumber);
    if (activeUser) {
      const updated = auth.updateLinkedStudent(activeUser.email, match.regNumber);
      if (updated) setActiveUser(updated);
    }
    return true;
  };

  // Hero image management — local file selection with object-URL previews.
  const heroObjectUrlsRef = useRef<string[]>([]);

  const revokeHeroObjectUrls = useCallback(() => {
    heroObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    heroObjectUrlsRef.current = [];
  }, []);

  const handleSelectHeroImages = useCallback(
    (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith('image/'));
      if (images.length === 0) return;
      revokeHeroObjectUrls();
      const urls = images.map((file) => URL.createObjectURL(file));
      heroObjectUrlsRef.current = urls;
      setHeroSlides(
        images.map((file, i) => ({
          id: `hero-${i}-${Date.now()}`,
          url: urls[i],
          alt: file.name,
          title: file.name.replace(/\.[^.]+$/, ''),
          subtitle: 'Loaded from your device'
        }))
      );
    },
    [revokeHeroObjectUrls]
  );

  const handleResetHeroSlides = useCallback(() => {
    revokeHeroObjectUrls();
    setHeroSlides(HERO_SLIDES);
  }, [revokeHeroObjectUrls]);

  useEffect(() => () => revokeHeroObjectUrls(), [revokeHeroObjectUrls]);

  /* ---------------------------------------------------------------------- */
  /* Data mutations — every write goes directly to Supabase. If a write     */
  /* fails, the error is surfaced (and rethrown to the portal form) so the  */
  /* user knows the record was not saved. No local-only fallback exists.    */
  /* ---------------------------------------------------------------------- */

  const today = () => new Date().toISOString().slice(0, 10);

  const failMessage = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

  const nextRegNumber = () => {
    const nums = students
      .map((s) => {
        const match = s.regNumber.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => Number.isFinite(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return generateRegistrationNumber(next, new Date().getFullYear());
  };

  const handleReviewAttendance = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionError(null);
    try {
      const updated = await api.reviewTeacherAttendance(id, {
        status,
        reviewedBy: activeUser?.name ?? 'Headmaster',
        headmasterRemarks:
          status === 'APPROVED' ? 'Attendance verified and approved.' : undefined,
        rejectionReason:
          status === 'REJECTED' ? 'Check-in details could not be verified.' : undefined
      });
      setTeacherAttendance((prev) =>
        prev.map((rec) => (rec.id === id ? { ...rec, ...updated } : rec))
      );
    } catch (err) {
      setActionError(failMessage(err, 'Could not review the attendance request.'));
    }
  };

  const handleTeacherCheckIn = async (notes: string) => {
    setActionError(null);
    try {
      const created = await api.createTeacherCheckIn({
        teacherId: activeUser?.id ?? 'current-teacher',
        teacherName: activeUser?.name ?? 'Teacher',
        date: today(),
        checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: notes || undefined
      });
      setTeacherAttendance((prev) => [created, ...prev]);
    } catch (err) {
      setActionError(failMessage(err, 'Could not submit the check-in.'));
      throw err;
    }
  };

  const handleSaveStudentAttendance = async (
    records: Omit<StudentAttendanceRecord, 'id'>[]
  ) => {
    setActionError(null);
    try {
      const saved = await api.saveStudentAttendance(records);
      setStudentAttendance((prev) => {
        const remaining = prev.filter(
          (r) => !saved.some((s) => s.studentId === r.studentId && s.date === r.date)
        );
        return [...saved, ...remaining];
      });
    } catch (err) {
      setActionError(failMessage(err, 'Could not save the attendance.'));
      throw err;
    }
  };

  const handleUploadCurriculum = async (input: api.CurriculumUploadInput) => {
    setActionError(null);
    try {
      const created = await api.uploadCurriculum(input);
      setCurriculum((prev) => [created, ...prev]);
    } catch (err) {
      setActionError(failMessage(err, 'Could not upload the material.'));
      throw err;
    }
  };

  const handleSubmitFeedback = async (subject: string, message: string) => {
    if (!selectedStudent) return;
    setActionError(null);
    try {
      const created = await api.submitFeedback({
        parentId: selectedStudent.parentEmail || selectedStudent.id,
        parentName: selectedStudent.parentName,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        studentClass: selectedStudent.className,
        subject,
        message
      });
      setFeedbacks((prev) => [created, ...prev]);
    } catch (err) {
      setActionError(failMessage(err, 'Could not send the message.'));
      throw err;
    }
  };

  const handleRecordPayment = async (input: api.RecordPaymentInput) => {
    setActionError(null);
    try {
      const created = await api.recordPayment(input);
      setPayments((prev) => [created, ...prev]);

      // Persist the student's new balance and the matching ledger entry so
      // the payment survives refresh and logout.
      const student = students.find((s) => s.id === created.studentId);
      const paid = (student?.paidAmount ?? 0) + created.amount;
      const balance = Math.max(0, (student?.tuitionFeeTerm ?? 0) - paid);

      try {
        const [updatedStudent, ledgerCreated] = await Promise.all([
          api.updateStudentPaymentStatus(created.studentId, {
            paidAmount: paid,
            balance
          }),
          api.createLedgerEntry({
            entryDate: created.paymentDate,
            description: `Tuition payment: ${created.studentName} (${created.studentReg})`,
            type: 'INCOME',
            category: 'TUITION_FEE',
            amount: created.amount,
            referenceDocNumber: created.receiptNumber,
            recordedBy: created.receivedBy,
            paymentMethod: created.paymentMethod
          })
        ]);
        setStudents((prev) =>
          prev.map((s) => (s.id === updatedStudent.id ? { ...s, ...updatedStudent } : s))
        );
        setLedger((prev) => [ledgerCreated, ...prev]);
      } catch (err) {
        setActionError(
          `Payment saved, but the balance or ledger update failed: ${failMessage(
            err,
            'please reload to resync.'
          )}`
        );
      }
    } catch (err) {
      setActionError(failMessage(err, 'Could not record the payment.'));
      throw err;
    }
  };

  const handleAddLedgerEntry = async (input: api.LedgerEntryInput) => {
    setActionError(null);
    try {
      const created = await api.createLedgerEntry(input);
      setLedger((prev) => [created, ...prev]);
    } catch (err) {
      setActionError(failMessage(err, 'Could not add the ledger entry.'));
      throw err;
    }
  };

  /* ------------------------- Headmaster management ---------------------- */

  const handleCreateStaff = async (input: api.CreateStaffInput): Promise<User> => {
    setActionError(null);
    try {
      // Create the login first so we never end up with a staff record that
      // cannot sign in.
      const provisioned = await auth.provisionStaffAuth({
        name: input.name,
        email: input.email,
        password: input.password,
        role: input.role,
        title: input.title,
        phone: input.phone
      });
      if (!provisioned.ok) {
        throw new Error(provisioned.error);
      }

      const created = await api.createStaff(input);
      setStaff((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setActionError(failMessage(err, 'Could not create the staff account.'));
      throw err;
    }
  };

  const handleRegisterParent = async (
    input: auth.ParentRegistrationInput
  ): Promise<void> => {
    setActionError(null);
    const result = await auth.provisionParentAccount(input);
    if (!result.ok) {
      const error = new Error(result.error);
      setActionError(result.error);
      throw error;
    }
  };

  const handleRegisterStudent = async (
    input: Omit<api.CreateStudentInput, 'regNumber'>
  ): Promise<Student> => {
    setActionError(null);
    const regNumber = nextRegNumber();
    try {
      const created = await api.createStudent({ ...input, regNumber });
      setStudents((prev) => [...prev, created]);
      setClasses((prev) =>
        prev.map((c) =>
          c.id === created.classId ? { ...c, studentCount: c.studentCount + 1 } : c
        )
      );
      return created;
    } catch (err) {
      setActionError(failMessage(err, 'Could not register the student.'));
      throw err;
    }
  };

  const handleCreateClass = async (input: api.CreateClassInput): Promise<SchoolClass> => {
    setActionError(null);
    try {
      const created = await api.createClass(input);
      setClasses((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setActionError(failMessage(err, 'Could not create the class.'));
      throw err;
    }
  };

  const handleUpdateStudent = async (
    id: string,
    input: api.UpdateStudentInput
  ): Promise<void> => {
    setActionError(null);
    try {
      const updated = await api.updateStudent(id, input);
      setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    } catch (err) {
      setActionError(failMessage(err, 'Could not update the student.'));
      throw err;
    }
  };

  const handleDeleteStudent = async (id: string): Promise<void> => {
    setActionError(null);
    try {
      await api.deleteStudent(id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setActionError(failMessage(err, 'Could not delete the student.'));
      throw err;
    }
  };

  /* ---------------------------------------------------------------------- */

  if (view === 'LANDING') {
    return (
      <LandingHero
        slides={heroSlides}
        onEnter={() => setView(activeUser ? 'PORTALS' : 'AUTH')}
        onSelectFiles={handleSelectHeroImages}
        onResetSlides={handleResetHeroSlides}
      />
    );
  }

  if (view === 'AUTH' || !activeUser) {
    return (
      <AuthPortal
        onAuthenticated={handleAuthenticated}
        onBack={() => setView('LANDING')}
        knownStudents={students}
      />
    );
  }

  const renderPortal = () => {
    switch (activeRole) {
      case 'HEADMASTER':
        return (
          <HeadmasterPortal
            classes={classes}
            students={students}
            staff={staff}
            teacherAttendance={teacherAttendance}
            payments={payments}
            ledger={ledger}
            onApprove={(id) => handleReviewAttendance(id, 'APPROVED')}
            onReject={(id) => handleReviewAttendance(id, 'REJECTED')}
            onCreateStaff={handleCreateStaff}
            onRegisterParent={handleRegisterParent}
            onRegisterStudent={handleRegisterStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onCreateClass={handleCreateClass}
          />
        );
      case 'ACCOUNTANT':
        return (
          <AccountantPortal
            classes={classes}
            students={students}
            payments={payments}
            ledger={ledger}
            currentUserName={activeUser.name}
            onRecordPayment={handleRecordPayment}
            onAddLedgerEntry={handleAddLedgerEntry}
          />
        );
      case 'TEACHER':
        return (
          <TeacherPortal
            teacherId={activeUser?.id ?? 'current-teacher'}
            teacherName={activeUser?.name ?? 'Teacher'}
            classes={classes}
            students={students}
            teacherAttendance={teacherAttendance}
            studentAttendance={studentAttendance}
            curriculum={curriculum}
            onCheckIn={handleTeacherCheckIn}
            onSaveStudentAttendance={handleSaveStudentAttendance}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onUploadCurriculum={handleUploadCurriculum}
          />
        );
      case 'PARENT':
        return (
          <ParentPortal
            student={selectedStudent}
            curriculum={curriculum}
            feedbacks={feedbacks}
            evaluation={selectedEvaluation}
            onSubmitFeedback={handleSubmitFeedback}
            onLookupStudent={handleLookupStudent}
          />
        );
      case 'SPONSOR':
        return (
          <SponsorPortal
            classes={classes}
            students={students}
            staff={staff}
            teacherAttendance={teacherAttendance}
            studentAttendance={studentAttendance}
            payments={payments}
            ledger={ledger}
            curriculum={curriculum}
            evaluations={evaluations}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
                <GraduationCap className="w-6 h-6 text-white" />
              </span>
              <div className="leading-tight min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">{SCHOOL_INFO.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {SCHOOL_INFO.district} · {SCHOOL_INFO.city}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeRole === 'SPONSOR' && (
                <span className="hidden lg:inline-flex">
                  <ReadOnlyBadge />
                </span>
              )}
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <span className="w-7 h-7 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {activeUser.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div className="leading-tight min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate max-w-[140px]">
                    {activeUser.name}
                  </p>
                  <p className="text-[10px] text-slate-500">{ROLE_LABELS[activeRole]}</p>
                </div>
              </div>
              <button
                onClick={() => setView('LANDING')}
                aria-label="Back to home"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Home</span>
              </button>
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
        </div>

        <div className="md:hidden border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-[11px]">
            <span className="font-bold text-slate-700 truncate">{activeUser.name}</span>
            <span className="inline-flex items-center gap-1.5 text-slate-500 shrink-0">
              {ROLE_LABELS[activeRole]}
              {activeRole === 'SPONSOR' && <ReadOnlyBadge />}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {actionError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="font-semibold text-rose-700 hover:text-rose-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm">Loading school data…</p>
          </div>
        ) : (
          <div className="space-y-4">
            {loadError && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-bold">Could not load live data from Supabase.</span>{' '}
                    {loadError}. Any records you add are written directly to the database —
                    nothing is stored only in this browser. Use the button to retry loading.
                  </span>
                </div>
                <button
                  onClick={loadData}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            )}

            {activeRole === 'SPONSOR' && (
              <div className="sm:hidden">
                <ReadOnlyBadge />
              </div>
            )}
            {renderPortal()}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">{SCHOOL_INFO.name}</span>
          <span>
            {SCHOOL_INFO.village}, {SCHOOL_INFO.sector}, {SCHOOL_INFO.district}
          </span>
        </div>
      </footer>
    </div>
  );
}
