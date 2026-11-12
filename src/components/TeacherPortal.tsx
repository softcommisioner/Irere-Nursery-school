import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CurriculumMaterial,
  SchoolClass,
  Student,
  StudentAttendanceRecord,
  StudentAttendanceState,
  TeacherAttendanceRecord
} from '../types';
import { CurriculumUploadInput } from '../services/api';
import { SCHOOL_INFO } from '../config/school';
import {
  EMPTY_MARKS,
  NURSERY_SUBJECTS,
  NurserySubjectKey,
  ReportCardRecord,
  SubjectMarks,
  calculateReport,
  loadReportCard,
  saveReportCard,
  summarizeAttendance
} from '../services/reportCards';
import {
  Clock,
  CheckCircle2,
  CalendarCheck2,
  Upload,
  BookOpen,
  Loader2,
  AlertCircle,
  LogIn,
  Users,
  FileText,
  Printer,
  GraduationCap,
  Award
} from 'lucide-react';
import { Badge, EmptyState, SectionCard, Tabs } from './ui';
import {
  CardActions,
  ConfirmDialog,
  RecordEditField,
  RecordEditModal,
  StudentEditModal,
  StudentEditValues,
  StudentRegisterTable
} from './StudentDialogs';

interface TeacherPortalProps {
  teacherId: string;
  teacherName: string;
  classes: SchoolClass[];
  students: Student[];
  teacherAttendance: TeacherAttendanceRecord[];
  studentAttendance: StudentAttendanceRecord[];
  curriculum: CurriculumMaterial[];
  schoolLogo?: string | null;
  onCheckIn: (notes: string) => Promise<void>;
  onSaveStudentAttendance: (records: Omit<StudentAttendanceRecord, 'id'>[]) => Promise<void>;
  onUpdateStudent: (id: string, values: StudentEditValues) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onUploadCurriculum: (input: CurriculumUploadInput) => Promise<void>;
  onUpdateCurriculum: (id: string, input: CurriculumUploadInput) => Promise<void>;
  onDeleteCurriculum: (id: string) => Promise<void>;
  onUpdateTeacherAttendance: (
    id: string,
    input: {
      date: string;
      checkInTime: string;
      checkOutTime?: string;
      notes?: string;
      status: TeacherAttendanceRecord['status'];
    }
  ) => Promise<void>;
  onDeleteTeacherAttendance: (id: string) => Promise<void>;
}

type Tab = 'CHECKIN' | 'ATTENDANCE' | 'STUDENTS' | 'CURRICULUM' | 'REPORTS';

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_OPTIONS: { value: StudentAttendanceState; tone: 'emerald' | 'rose' | 'amber' | 'slate' }[] = [
  { value: 'PRESENT', tone: 'emerald' },
  { value: 'ABSENT', tone: 'rose' },
  { value: 'SICK', tone: 'amber' },
  { value: 'LATE', tone: 'slate' }
];

const gradeTone = (status: string): 'emerald' | 'blue' | 'amber' | 'rose' | 'slate' => {
  if (status === 'Excellent') return 'emerald';
  if (status === 'Very Good') return 'blue';
  if (status === 'Satisfactory') return 'amber';
  if (status === 'Needs Improvement') return 'rose';
  return 'slate';
};

const inputClass =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  teacherId,
  teacherName,
  classes,
  students,
  teacherAttendance,
  studentAttendance,
  curriculum,
  schoolLogo,
  onCheckIn,
  onSaveStudentAttendance,
  onUpdateStudent,
  onDeleteStudent,
  onUploadCurriculum,
  onUpdateCurriculum,
  onDeleteCurriculum,
  onUpdateTeacherAttendance,
  onDeleteTeacherAttendance
}) => {
  const [tab, setTab] = useState<Tab>('CHECKIN');

  const [notes, setNotes] = useState('');
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [marks, setMarks] = useState<Record<string, StudentAttendanceState>>({});
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [curriculumAction, setCurriculumAction] = useState<{
    mode: 'edit' | 'delete';
    item: CurriculumMaterial;
  } | null>(null);
  const [curriculumActionBusy, setCurriculumActionBusy] = useState(false);
  const [curriculumActionError, setCurriculumActionError] = useState<string | null>(null);

  const [checkInAction, setCheckInAction] = useState<{
    mode: 'edit' | 'delete';
    record: TeacherAttendanceRecord;
  } | null>(null);
  const [checkInActionBusy, setCheckInActionBusy] = useState(false);
  const [checkInActionError, setCheckInActionError] = useState<string | null>(null);

  const [upload, setUpload] = useState<CurriculumUploadInput>({
    title: '',
    theme: '',
    classLevel: 'MIDDLE_CLASS',
    className: '',
    subject: 'Kinyarwanda',
    fileFormat: 'PDF',
    fileSize: '',
    downloadUrl: '',
    weekNumber: 1,
    term: 'Term 1',
    uploadedByTeacherName: teacherName,
    description: ''
  });
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [reportClassId, setReportClassId] = useState('');
  const [reportStudentId, setReportStudentId] = useState('');
  const [reportMarks, setReportMarks] = useState<SubjectMarks>({ ...EMPTY_MARKS });
  const [reportRemarks, setReportRemarks] = useState('');
  const [showBulletin, setShowBulletin] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const bulletinRef = useRef<HTMLDivElement>(null);

  const myAttendance = useMemo(
    () => teacherAttendance.filter((r) => r.teacherId === teacherId),
    [teacherAttendance, teacherId]
  );
  const todayRecord = myAttendance.find((r) => r.date === TODAY);

  const classStudents = useMemo(
    () => (selectedClassId ? students.filter((s) => s.classId === selectedClassId) : []),
    [selectedClassId, students]
  );

  const reportClassStudents = useMemo(
    () => (reportClassId ? students.filter((s) => s.classId === reportClassId) : []),
    [reportClassId, students]
  );

  const reportStudent = reportClassStudents.find((s) => s.id === reportStudentId) ?? null;
  const reportCalculation = useMemo(() => calculateReport(reportMarks), [reportMarks]);
  const reportAttendance = useMemo(
    () =>
      summarizeAttendance(
        reportStudentId
          ? studentAttendance.filter((record) => record.studentId === reportStudentId)
          : []
      ),
    [reportStudentId, studentAttendance]
  );

  useEffect(() => {
    if (!reportStudent) {
      setReportMarks({ ...EMPTY_MARKS });
      setReportRemarks('');
      setShowBulletin(false);
      setReportMsg(null);
      return;
    }

    const saved = loadReportCard(
      reportStudent.id,
      SCHOOL_INFO.academicYear,
      SCHOOL_INFO.currentTerm
    );
    setReportMarks(saved?.marks ?? { ...EMPTY_MARKS });
    setReportRemarks(saved?.remarks ?? '');
    setShowBulletin(false);
    setReportMsg(null);
  }, [reportStudent?.id]);

  const persistReport = (nextMarks: SubjectMarks, remarks: string) => {
    if (!reportStudent) return;
    const record: ReportCardRecord = {
      studentId: reportStudent.id,
      studentName: `${reportStudent.firstName} ${reportStudent.lastName}`,
      studentReg: reportStudent.regNumber,
      classId: reportStudent.classId,
      className: reportStudent.className,
      academicYear: SCHOOL_INFO.academicYear,
      term: SCHOOL_INFO.currentTerm,
      marks: nextMarks,
      remarks,
      updatedAt: new Date().toISOString()
    };
    saveReportCard(record);
  };

  const updateReportMark = (key: NurserySubjectKey, value: string) => {
    const subject = NURSERY_SUBJECTS.find((item) => item.key === key);
    let nextValue = '';

    if (value !== '') {
      const parsed = Number(value);
      nextValue = Number.isFinite(parsed)
        ? String(Math.min(subject?.maxScore ?? 20, Math.max(0, parsed)))
        : '';
    }

    const nextMarks = { ...reportMarks, [key]: nextValue };
    setReportMarks(nextMarks);
    setReportMsg(null);
    persistReport(nextMarks, reportRemarks);
  };

  const updateReportRemarks = (value: string) => {
    setReportRemarks(value);
    setReportMsg(null);
    persistReport(reportMarks, value);
  };

  const handleGenerateBulletin = () => {
    if (!reportStudent) {
      setReportMsg({ type: 'err', text: 'Select a class and student first.' });
      return;
    }
    if (!reportCalculation.completed) {
      setReportMsg({
        type: 'err',
        text: 'Enter a valid score for all five subjects before generating the bulletin.'
      });
      return;
    }

    persistReport(reportMarks, reportRemarks);
    setShowBulletin(true);
    setReportMsg({
      type: 'ok',
      text: 'Bulletin generated. Review it below, then print or save it as a PDF.'
    });
    window.setTimeout(() => {
      bulletinRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handlePrintBulletin = () => {
    window.print();
  };

  const handleCheckIn = async () => {
    setCheckInBusy(true);
    setCheckInMsg(null);
    try {
      await onCheckIn(notes.trim());
      setNotes('');
      setCheckInMsg({ type: 'ok', text: 'Checked in. Awaiting Headmaster approval.' });
    } catch (err) {
      setCheckInMsg({ type: 'err', text: err instanceof Error ? err.message : 'Check-in failed.' });
    } finally {
      setCheckInBusy(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (classStudents.length === 0) return;
    setAttendanceBusy(true);
    setAttendanceMsg(null);
    try {
      const records: Omit<StudentAttendanceRecord, 'id'>[] = classStudents.map((s) => ({
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        classId: s.classId,
        date: TODAY,
        status: marks[s.id] ?? 'PRESENT',
        recordedByTeacherId: teacherId
      }));
      await onSaveStudentAttendance(records);
      setAttendanceMsg({ type: 'ok', text: `Saved attendance for ${records.length} pupils.` });
    } catch (err) {
      setAttendanceMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not save attendance.'
      });
    } finally {
      setAttendanceBusy(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadBusy(true);
    setUploadMsg(null);
    try {
      const cls = classes.find((c) => c.id === selectedClassId);
      await onUploadCurriculum({
        ...upload,
        className: upload.className || cls?.name || '',
        uploadedByTeacherName: teacherName
      });
      setUploadMsg({ type: 'ok', text: 'Material uploaded.' });
      setUpload((u) => ({ ...u, title: '', theme: '', description: '', fileSize: '', downloadUrl: '' }));
    } catch (err) {
      setUploadMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Upload failed.'
      });
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSaveStudentEdit = async (id: string, values: StudentEditValues) => {
    setEditBusy(true);
    setEditError(null);
    try {
      await onUpdateStudent(id, values);
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
      setDeletingStudent(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the student.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSaveCurriculumEdit = async (values: Record<string, string>) => {
    if (!curriculumAction || curriculumAction.mode !== 'edit') return;
    setCurriculumActionBusy(true);
    setCurriculumActionError(null);
    try {
      await onUpdateCurriculum(curriculumAction.item.id, {
        title: values.title.trim(),
        theme: values.theme.trim(),
        classLevel: values.classLevel as CurriculumUploadInput['classLevel'],
        className: values.className.trim(),
        subject: values.subject as CurriculumUploadInput['subject'],
        fileFormat: values.fileFormat as CurriculumUploadInput['fileFormat'],
        fileSize: values.fileSize.trim(),
        downloadUrl: values.downloadUrl.trim(),
        weekNumber: Number(values.weekNumber) || 1,
        term: values.term.trim(),
        uploadedByTeacherName: curriculumAction.item.uploadedByTeacherName,
        description: values.description.trim()
      });
      setCurriculumAction(null);
    } catch (err) {
      setCurriculumActionError(
        err instanceof Error ? err.message : 'Could not update the curriculum material.'
      );
    } finally {
      setCurriculumActionBusy(false);
    }
  };

  const handleConfirmCurriculumDelete = async () => {
    if (!curriculumAction || curriculumAction.mode !== 'delete') return;
    setCurriculumActionBusy(true);
    setCurriculumActionError(null);
    try {
      await onDeleteCurriculum(curriculumAction.item.id);
      setCurriculumAction(null);
    } catch (err) {
      setCurriculumActionError(
        err instanceof Error ? err.message : 'Could not delete the curriculum material.'
      );
    } finally {
      setCurriculumActionBusy(false);
    }
  };

  const handleSaveCheckInEdit = async (values: Record<string, string>) => {
    if (!checkInAction || checkInAction.mode !== 'edit') return;
    setCheckInActionBusy(true);
    setCheckInActionError(null);
    try {
      await onUpdateTeacherAttendance(checkInAction.record.id, {
        date: values.date,
        checkInTime: values.checkInTime.trim(),
        checkOutTime: values.checkOutTime.trim() || undefined,
        notes: values.notes.trim() || undefined,
        status: checkInAction.record.status
      });
      setCheckInAction(null);
    } catch (err) {
      setCheckInActionError(
        err instanceof Error ? err.message : 'Could not update the check-in record.'
      );
    } finally {
      setCheckInActionBusy(false);
    }
  };

  const handleConfirmCheckInDelete = async () => {
    if (!checkInAction || checkInAction.mode !== 'delete') return;
    setCheckInActionBusy(true);
    setCheckInActionError(null);
    try {
      await onDeleteTeacherAttendance(checkInAction.record.id);
      setCheckInAction(null);
    } catch (err) {
      setCheckInActionError(
        err instanceof Error ? err.message : 'Could not delete the check-in record.'
      );
    } finally {
      setCheckInActionBusy(false);
    }
  };

  const checkInEditFields: RecordEditField[] = [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'checkInTime', label: 'Check-in time', required: true },
    { key: 'checkOutTime', label: 'Check-out time' },
    { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true }
  ];

  const curriculumEditFields: RecordEditField[] = [
    { key: 'title', label: 'Title', required: true, fullWidth: true },
    {
      key: 'subject',
      label: 'Subject',
      type: 'select',
      options: [
        'Kinyarwanda',
        'English',
        'Early Numeracy',
        'Creative Arts & Music',
        'Social & Environmental',
        'Physical Play'
      ].map((subject) => ({ value: subject, label: subject }))
    },
    {
      key: 'fileFormat',
      label: 'File format',
      type: 'select',
      options: ['PDF', 'IMAGE', 'AUDIO', 'DOC'].map((format) => ({
        value: format,
        label: format
      }))
    },
    {
      key: 'classLevel',
      label: 'Class level',
      type: 'select',
      options: [
        { value: 'BABY_CLASS', label: 'Baby class' },
        { value: 'MIDDLE_CLASS', label: 'Middle class' },
        { value: 'TOP_CLASS', label: 'Top class' }
      ]
    },
    { key: 'className', label: 'Class name' },
    { key: 'theme', label: 'Theme' },
    { key: 'term', label: 'Term' },
    { key: 'weekNumber', label: 'Week', type: 'number', min: 1 },
    { key: 'fileSize', label: 'File size', placeholder: 'e.g. 1.2 MB' },
    { key: 'downloadUrl', label: 'Download URL' },
    { key: 'description', label: 'Description', type: 'textarea', fullWidth: true }
  ];

  const Msg = ({ msg }: { msg: { type: 'ok' | 'err'; text: string } | null }) =>
    msg ? (
      <div
        className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${
          msg.type === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}
      >
        {msg.type === 'ok' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 shrink-0" />
        )}
        {msg.text}
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Teacher Portal</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Daily self check-in, student attendance marking and curriculum uploads.
        </p>
      </div>

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: 'CHECKIN', label: 'Self Check-in', icon: <LogIn className="w-3.5 h-3.5" /> },
          { id: 'ATTENDANCE', label: 'Student Attendance', icon: <CalendarCheck2 className="w-3.5 h-3.5" /> },
          { id: 'STUDENTS', label: 'Students', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'CURRICULUM', label: 'Curriculum Uploads', icon: <Upload className="w-3.5 h-3.5" /> },
          { id: 'REPORTS', label: 'Auto Bulletin', icon: <FileText className="w-3.5 h-3.5" /> }
        ]}
      />

      {tab === 'CHECKIN' && (
        <div className="space-y-5">
          <SectionCard title="Today's Check-in" subtitle={`${teacherName} · ${TODAY}`} icon={<Clock className="w-5 h-5" />}>
            <div className="p-4 sm:p-5 space-y-4">
              <Msg msg={checkInMsg} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Current status:</span>
                {todayRecord ? (
                  <Badge tone={todayRecord.status === 'APPROVED' ? 'emerald' : todayRecord.status === 'PENDING' ? 'amber' : 'rose'}>
                    {todayRecord.status} · {todayRecord.checkInTime}
                  </Badge>
                ) : (
                  <Badge tone="slate">Not checked in</Badge>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Classroom set up, materials ready"
                  className={`${inputClass} resize-none`}
                />
              </div>
              <button
                onClick={handleCheckIn}
                disabled={checkInBusy || !!todayRecord}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkInBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                {todayRecord ? 'Already checked in today' : 'Check in now'}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="My Check-in History" subtitle={`${myAttendance.length} records`} icon={<Clock className="w-5 h-5" />}>
            {myAttendance.length === 0 ? (
              <EmptyState icon={<Clock className="w-9 h-9" />} title="No check-ins yet" message="Your submitted check-ins will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {myAttendance.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.date}</p>
                      <p className="text-[11px] text-slate-500">Check-in {r.checkInTime}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={r.status === 'APPROVED' ? 'emerald' : r.status === 'PENDING' ? 'amber' : 'rose'}>
                        {r.status}
                      </Badge>
                      <CardActions
                        onEdit={() => {
                          setCheckInActionError(null);
                          setCheckInAction({ mode: 'edit', record: r });
                        }}
                        onDelete={() => {
                          setCheckInActionError(null);
                          setCheckInAction({ mode: 'delete', record: r });
                        }}
                        editLabel="Edit check-in record"
                        deleteLabel="Delete check-in record"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'ATTENDANCE' && (
        <SectionCard title="Student Attendance" subtitle="Mark daily presence for your class" icon={<CalendarCheck2 className="w-5 h-5" />}>
          <div className="p-4 sm:p-5 space-y-4">
            <Msg msg={attendanceMsg} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setMarks({});
                  }}
                  className={inputClass}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[11px] text-slate-400 self-end">
                {studentAttendance.length} attendance records loaded
              </div>
            </div>

            {classStudents.length === 0 ? (
              <EmptyState icon={<Users className="w-9 h-9" />} title="No students" message="Select a class with enrolled pupils." />
            ) : (
              <>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {classStudents.map((s) => {
                    const status = marks[s.id] ?? 'PRESENT';
                    return (
                      <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {s.firstName} {s.lastName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{s.regNumber}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map((opt) => {
                            const active = status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setMarks((m) => ({ ...m, [s.id]: opt.value }))}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  active
                                    ? opt.value === 'PRESENT'
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : opt.value === 'ABSENT'
                                        ? 'bg-rose-500 border-rose-500 text-white'
                                        : opt.value === 'SICK'
                                          ? 'bg-amber-500 border-amber-500 text-white'
                                          : 'bg-slate-600 border-slate-600 text-white'
                                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {opt.value}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleSaveAttendance}
                  disabled={attendanceBusy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {attendanceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck2 className="w-4 h-4" />}
                  Save attendance
                </button>
              </>
            )}
          </div>
        </SectionCard>
      )}

      {tab === 'STUDENTS' && (
        <SectionCard
          title="Student register"
          subtitle={`${students.length} pupils enrolled · update records or remove pupils`}
          icon={<Users className="w-5 h-5" />}
        >
          {students.length === 0 ? (
            <EmptyState
              icon={<Users className="w-9 h-9" />}
              title="No students registered yet"
              message="Registered pupils will appear here."
            />
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
      )}

      {tab === 'CURRICULUM' && (
        <div className="space-y-5">
          <SectionCard title="Upload Material" subtitle="Share a book, worksheet or lesson plan" icon={<Upload className="w-5 h-5" />}>
            <form onSubmit={handleUpload} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Msg msg={uploadMsg} />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 text-xs mb-1">Title</label>
                <input required value={upload.title} onChange={(e) => setUpload((u) => ({ ...u, title: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Subject</label>
                <select value={upload.subject} onChange={(e) => setUpload((u) => ({ ...u, subject: e.target.value as CurriculumUploadInput['subject'] }))} className={inputClass}>
                  {['Kinyarwanda', 'English', 'Early Numeracy', 'Creative Arts & Music', 'Social & Environmental', 'Physical Play'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Format</label>
                <select value={upload.fileFormat} onChange={(e) => setUpload((u) => ({ ...u, fileFormat: e.target.value as CurriculumUploadInput['fileFormat'] }))} className={inputClass}>
                  {['PDF', 'IMAGE', 'AUDIO', 'DOC'].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    const cls = classes.find((c) => c.id === e.target.value);
                    setSelectedClassId(e.target.value);
                    setUpload((u) => ({
                      ...u,
                      className: cls?.name || '',
                      classLevel:
                        cls?.id.includes('baby') ? 'BABY_CLASS' : cls?.id.includes('top') ? 'TOP_CLASS' : 'MIDDLE_CLASS'
                    }));
                  }}
                  className={inputClass}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Week</label>
                <input type="number" min="1" value={upload.weekNumber} onChange={(e) => setUpload((u) => ({ ...u, weekNumber: Number(e.target.value) }))} className={inputClass} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">File size</label>
                <input value={upload.fileSize} onChange={(e) => setUpload((u) => ({ ...u, fileSize: e.target.value }))} placeholder="e.g. 1.2 MB" className={inputClass} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Download URL</label>
                <input value={upload.downloadUrl} onChange={(e) => setUpload((u) => ({ ...u, downloadUrl: e.target.value }))} placeholder="Supabase Storage URL" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 text-xs mb-1">Description</label>
                <textarea rows={2} value={upload.description} onChange={(e) => setUpload((u) => ({ ...u, description: e.target.value }))} className={`${inputClass} resize-none`} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={uploadBusy} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50">
                  {uploadBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload material
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Published Materials" subtitle={`${curriculum.length} items`} icon={<BookOpen className="w-5 h-5" />}>
            {curriculum.length === 0 ? (
              <EmptyState icon={<BookOpen className="w-9 h-9" />} title="No materials" message="Uploaded curriculum will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {curriculum.map((m) => (
                  <div key={m.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="orange">{m.subject}</Badge>
                        <span className="text-[10px] text-slate-400">
                          Week {m.weekNumber} · {m.fileFormat}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-1.5">{m.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.description}</p>
                    </div>
                    <CardActions
                      onEdit={() => {
                        setCurriculumActionError(null);
                        setCurriculumAction({ mode: 'edit', item: m });
                      }}
                      onDelete={() => {
                        setCurriculumActionError(null);
                        setCurriculumAction({ mode: 'delete', item: m });
                      }}
                      editLabel={`Edit ${m.title}`}
                      deleteLabel={`Delete ${m.title}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'REPORTS' && (
        <div className="space-y-5">
          <SectionCard
            title="Auto Bulletin — Term Report Cards"
            subtitle="Enter marks once; attendance, totals and the printable bulletin are generated automatically"
            icon={<FileText className="w-5 h-5" />}
          >
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1">Class</label>
                  <select
                    value={reportClassId}
                    onChange={(e) => {
                      setReportClassId(e.target.value);
                      setReportStudentId('');
                      setReportMarks({ ...EMPTY_MARKS });
                      setReportRemarks('');
                      setShowBulletin(false);
                      setReportMsg(null);
                    }}
                    className={inputClass}
                  >
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1">
                    Student
                  </label>
                  <select
                    value={reportStudentId}
                    onChange={(e) => {
                      setReportStudentId(e.target.value);
                      setReportMarks({ ...EMPTY_MARKS });
                      setReportRemarks('');
                      setShowBulletin(false);
                      setReportMsg(null);
                    }}
                    disabled={!reportClassId}
                    className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
                  >
                    <option value="">
                      {reportClassId ? 'Select student' : 'Choose a class first'}
                    </option>
                    {reportClassStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} · {s.regNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!reportStudent ? (
                <EmptyState
                  icon={<FileText className="w-9 h-9" />}
                  title="Select a pupil"
                  message="Choose a class and student to enter marks for the term."
                />
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-3 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Subject / Competency</span>
                      <span className="w-14 text-center">Max</span>
                      <span className="w-56 text-right">Score & Remark</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {NURSERY_SUBJECTS.map((subject) => {
                        const result = reportCalculation.subjects.find(
                          (item) => item.key === subject.key
                        );
                        return (
                          <div
                            key={subject.key}
                            className="p-3 sm:px-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 sm:gap-3 sm:items-center"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800">{subject.name}</p>
                              <p className="text-[10px] text-slate-500">{subject.competency}</p>
                            </div>
                            <span className="hidden sm:inline text-xs text-slate-500 w-14 text-center">
                              / {subject.maxScore}
                            </span>
                            <div className="flex items-center gap-2 sm:justify-end">
                              <span className="sm:hidden text-[11px] text-slate-500">
                                Max {subject.maxScore}
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={subject.maxScore}
                                step="0.5"
                                value={reportMarks[subject.key]}
                                onChange={(e) => updateReportMark(subject.key, e.target.value)}
                                placeholder="0"
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                              />
                              <Badge tone={gradeTone(result?.remark ?? 'Not assessed')}>
                                {result?.remark ?? 'Not assessed'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <CalendarCheck2 className="w-3.5 h-3.5 text-orange-500" />
                        Attendance Summary · {SCHOOL_INFO.currentTerm}
                      </p>
                      <Badge
                        tone={
                          reportAttendance.total === 0
                            ? 'slate'
                            : reportAttendance.attendanceRate >= 80
                              ? 'emerald'
                              : reportAttendance.attendanceRate >= 60
                                ? 'amber'
                                : 'rose'
                        }
                      >
                        {reportAttendance.total === 0
                          ? 'No records'
                          : `${reportAttendance.attendanceRate.toFixed(0)}% attendance`}
                      </Badge>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                      {[
                        { label: 'Days', value: reportAttendance.total },
                        { label: 'Present', value: reportAttendance.present },
                        { label: 'Late', value: reportAttendance.late },
                        { label: 'Absent', value: reportAttendance.absent },
                        { label: 'Sick', value: reportAttendance.sick },
                        { label: 'Excused', value: reportAttendance.excused }
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border border-slate-200 bg-white p-2"
                        >
                          <p className="text-base font-extrabold text-slate-800">{item.value}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                    {reportAttendance.total === 0 && (
                      <p className="mt-2 text-[11px] text-amber-700">
                        No attendance records have been captured for this pupil this term yet.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-xs mb-1">
                      Teacher’s General Observations &amp; Remarks
                    </label>
                    <textarea
                      rows={4}
                      value={reportRemarks}
                      onChange={(e) => updateReportRemarks(e.target.value)}
                      placeholder="e.g. Kevin has made excellent progress in early literacy and participates confidently during group activities."
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Total Marks
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-800">
                        {reportCalculation.total} / {reportCalculation.maxTotal}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Average Score
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-800">
                        {reportCalculation.average.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Percentage
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-800">
                        {reportCalculation.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">
                        Grade Status
                      </p>
                      <div className="mt-1">
                        <Badge tone={gradeTone(reportCalculation.status)}>
                          {reportCalculation.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Marks and remarks save automatically on this device.
                    </p>
                    <button
                      onClick={handleGenerateBulletin}
                      disabled={!reportCalculation.completed}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-4 h-4" />
                      Generate Bulletin
                    </button>
                  </div>

                  {!reportCalculation.completed && (
                    <p className="text-[11px] text-amber-700">
                      Enter a valid score for all five subjects to generate the bulletin.
                    </p>
                  )}
                  <Msg msg={reportMsg} />
                </>
              )}
            </div>
          </SectionCard>

          {showBulletin && reportStudent && (
            <div ref={bulletinRef} className="space-y-3">
              <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs text-slate-500">
                  Official bulletin preview · updates instantly with your marks.
                </p>
                <button
                  onClick={handlePrintBulletin}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  Print Bulletin / Download PDF
                </button>
              </div>

              <div className="bulletin-print-area bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="h-2 bg-orange-500" />
                <div className="p-5 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-orange-200 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {schoolLogo ? (
                        <img
                          src={schoolLogo}
                          alt={`${SCHOOL_INFO.name} logo`}
                          className="w-14 h-14 shrink-0 rounded-xl border border-orange-200 bg-white object-contain p-1 shadow-sm"
                        />
                      ) : (
                        <span className="w-14 h-14 shrink-0 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
                          <GraduationCap className="w-8 h-8 text-white" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-800">
                          {SCHOOL_INFO.name}
                        </h2>
                        <p className="text-[11px] font-semibold text-orange-600">
                          Gasabo District, Kigali City
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {SCHOOL_INFO.village} · {SCHOOL_INFO.sector}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:justify-end">
                      {reportStudent.photoUrl ? (
                        <img
                          src={reportStudent.photoUrl}
                          alt={`${reportStudent.firstName} ${reportStudent.lastName}`}
                          className="w-16 h-20 shrink-0 rounded-lg border-2 border-orange-200 object-cover bg-slate-100 shadow-sm"
                        />
                      ) : (
                        <span className="w-16 h-20 shrink-0 rounded-lg border-2 border-dashed border-orange-200 bg-orange-50 text-orange-700 text-lg font-extrabold flex items-center justify-center">
                          {reportStudent.firstName[0]}
                          {reportStudent.lastName[0]}
                        </span>
                      )}
                      <div className="sm:text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                          <Award className="w-3.5 h-3.5" />
                          Official Bulletin
                        </span>
                        <p className="mt-1.5 text-[11px] text-slate-600">
                          Academic Year {SCHOOL_INFO.academicYear}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-700">
                          {SCHOOL_INFO.currentTerm}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Student Name
                      </p>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {reportStudent.firstName} {reportStudent.lastName}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Registration Number
                      </p>
                      <p className="mt-0.5 font-mono font-bold text-slate-800">
                        {reportStudent.regNumber}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Class
                      </p>
                      <p className="mt-0.5 font-bold text-slate-800">{reportStudent.className}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Academic Year &amp; Term
                      </p>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {SCHOOL_INFO.academicYear} · {SCHOOL_INFO.currentTerm}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Attendance Summary
                      </h3>
                      <Badge
                        tone={
                          reportAttendance.total === 0
                            ? 'slate'
                            : reportAttendance.attendanceRate >= 80
                              ? 'emerald'
                              : reportAttendance.attendanceRate >= 60
                                ? 'amber'
                                : 'rose'
                        }
                      >
                        {reportAttendance.total === 0
                          ? 'No records'
                          : `${reportAttendance.attendanceRate.toFixed(0)}% attendance`}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                      {[
                        { label: 'Days', value: reportAttendance.total },
                        { label: 'Present', value: reportAttendance.present },
                        { label: 'Late', value: reportAttendance.late },
                        { label: 'Absent', value: reportAttendance.absent },
                        { label: 'Sick', value: reportAttendance.sick },
                        { label: 'Excused', value: reportAttendance.excused }
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-2">
                          <p className="text-base font-extrabold text-slate-800">{item.value}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      Attendance covers {reportAttendance.attended} of {reportAttendance.total}{' '}
                      recorded school day{reportAttendance.total === 1 ? '' : 's'} this term.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Subject Performance
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[460px] text-left text-xs border border-slate-200">
                        <thead className="bg-orange-50 text-orange-900">
                          <tr>
                            <th className="px-3 py-2 font-bold border-b border-orange-100">
                              Subject
                            </th>
                            <th className="px-3 py-2 font-bold border-b border-orange-100 text-center">
                              Max Score
                            </th>
                            <th className="px-3 py-2 font-bold border-b border-orange-100 text-center">
                              Scored Score
                            </th>
                            <th className="px-3 py-2 font-bold border-b border-orange-100 text-right">
                              Remark
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {reportCalculation.subjects.map((row) => (
                            <tr key={row.key}>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-slate-800">{row.name}</p>
                                <p className="text-[10px] text-slate-400">{row.competency}</p>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">
                                {row.maxScore}
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-slate-800">
                                {row.score ?? '—'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Badge tone={gradeTone(row.remark)}>{row.remark}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold text-slate-800">
                            <td className="px-3 py-2">Total</td>
                            <td className="px-3 py-2 text-center">{reportCalculation.maxTotal}</td>
                            <td className="px-3 py-2 text-center">{reportCalculation.total}</td>
                            <td className="px-3 py-2 text-right">
                              {reportCalculation.percentage.toFixed(1)}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-800">
                        Overall Average
                      </p>
                      <p className="mt-1 text-lg font-extrabold text-orange-600">
                        {reportCalculation.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Total Score
                      </p>
                      <p className="mt-1 text-lg font-extrabold text-slate-800">
                        {reportCalculation.total} / {reportCalculation.maxTotal}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Average / Subject
                      </p>
                      <p className="mt-1 text-lg font-extrabold text-slate-800">
                        {reportCalculation.average.toFixed(1)} /{' '}
                        {(
                          reportCalculation.maxTotal / reportCalculation.subjects.length
                        ).toFixed(0)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Grade Status
                      </p>
                      <div className="mt-1 flex justify-center">
                        <Badge tone={gradeTone(reportCalculation.status)}>
                          {reportCalculation.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Class Teacher’s Remark
                      </p>
                      <p className="mt-1 min-h-[3rem] text-xs leading-relaxed text-slate-700 italic">
                        {reportRemarks.trim() || 'No additional remarks.'}
                      </p>
                      <div className="mt-5 pt-2 border-t border-slate-300 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500">Signature</span>
                        <span className="text-xs font-semibold text-slate-800">{teacherName}</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Headmaster’s Signature
                      </p>
                      <div className="mt-10 border-t border-dashed border-slate-300" />
                      <p className="mt-1 text-[10px] text-slate-400">Name, signature & school stamp</p>
                    </div>
                  </div>

                  <p className="text-center text-[10px] text-slate-400">
                    Generated by {SCHOOL_INFO.name} · {SCHOOL_INFO.email} · {SCHOOL_INFO.phone}
                  </p>
                </div>
              </div>
            </div>
          )}
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

      {curriculumAction?.mode === 'edit' && (
        <RecordEditModal
          key={curriculumAction.item.id}
          title="Edit curriculum material"
          subtitle={`${curriculumAction.item.title} · Week ${curriculumAction.item.weekNumber}`}
          fields={curriculumEditFields}
          initialValues={{
            title: curriculumAction.item.title,
            subject: curriculumAction.item.subject,
            fileFormat: curriculumAction.item.fileFormat,
            classLevel: curriculumAction.item.classLevel,
            className: curriculumAction.item.className,
            theme: curriculumAction.item.theme,
            term: curriculumAction.item.term,
            weekNumber: curriculumAction.item.weekNumber,
            fileSize: curriculumAction.item.fileSize,
            downloadUrl: curriculumAction.item.downloadUrl,
            description: curriculumAction.item.description
          }}
          busy={curriculumActionBusy}
          error={curriculumActionError}
          onClose={() => {
            setCurriculumAction(null);
            setCurriculumActionError(null);
          }}
          onSave={handleSaveCurriculumEdit}
        />
      )}

      {curriculumAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete curriculum material"
          message={
            <>
              Delete <strong>{curriculumAction.item.title}</strong>? The published material will be
              removed from the curriculum library.
            </>
          }
          busy={curriculumActionBusy}
          error={curriculumActionError}
          onCancel={() => {
            setCurriculumAction(null);
            setCurriculumActionError(null);
          }}
          onConfirm={handleConfirmCurriculumDelete}
        />
      )}

      {checkInAction?.mode === 'edit' && (
        <RecordEditModal
          key={checkInAction.record.id}
          title="Edit check-in record"
          subtitle={`${teacherName} · ${checkInAction.record.date}`}
          fields={checkInEditFields}
          initialValues={{
            date: checkInAction.record.date,
            checkInTime: checkInAction.record.checkInTime,
            checkOutTime: checkInAction.record.checkOutTime,
            notes: checkInAction.record.notes
          }}
          busy={checkInActionBusy}
          error={checkInActionError}
          onClose={() => {
            setCheckInAction(null);
            setCheckInActionError(null);
          }}
          onSave={handleSaveCheckInEdit}
        />
      )}

      {checkInAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete check-in record"
          message={
            <>
              Delete your check-in record for <strong>{checkInAction.record.date}</strong>? This
              cannot be undone.
            </>
          }
          busy={checkInActionBusy}
          error={checkInActionError}
          onCancel={() => {
            setCheckInAction(null);
            setCheckInActionError(null);
          }}
          onConfirm={handleConfirmCheckInDelete}
        />
      )}
    </div>
  );
};
