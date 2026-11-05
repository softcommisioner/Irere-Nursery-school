import React, { useMemo, useState } from 'react';
import {
  CurriculumMaterial,
  SchoolClass,
  Student,
  StudentAttendanceRecord,
  StudentAttendanceState,
  TeacherAttendanceRecord
} from '../types';
import { CurriculumUploadInput } from '../services/api';
import {
  Clock,
  CheckCircle2,
  CalendarCheck2,
  Upload,
  BookOpen,
  Loader2,
  AlertCircle,
  LogIn,
  Users
} from 'lucide-react';
import { Badge, EmptyState, SectionCard, Tabs } from './ui';

interface TeacherPortalProps {
  teacherId: string;
  teacherName: string;
  classes: SchoolClass[];
  students: Student[];
  teacherAttendance: TeacherAttendanceRecord[];
  studentAttendance: StudentAttendanceRecord[];
  curriculum: CurriculumMaterial[];
  onCheckIn: (notes: string) => Promise<void>;
  onSaveStudentAttendance: (records: Omit<StudentAttendanceRecord, 'id'>[]) => Promise<void>;
  onUploadCurriculum: (input: CurriculumUploadInput) => Promise<void>;
}

type Tab = 'CHECKIN' | 'ATTENDANCE' | 'CURRICULUM';

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_OPTIONS: { value: StudentAttendanceState; tone: 'emerald' | 'rose' | 'amber' | 'slate' }[] = [
  { value: 'PRESENT', tone: 'emerald' },
  { value: 'ABSENT', tone: 'rose' },
  { value: 'SICK', tone: 'amber' },
  { value: 'LATE', tone: 'slate' }
];

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
  onCheckIn,
  onSaveStudentAttendance,
  onUploadCurriculum
}) => {
  const [tab, setTab] = useState<Tab>('CHECKIN');

  const [notes, setNotes] = useState('');
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [marks, setMarks] = useState<Record<string, StudentAttendanceState>>({});
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [attendanceMsg, setAttendanceMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  const myAttendance = useMemo(
    () => teacherAttendance.filter((r) => r.teacherId === teacherId),
    [teacherAttendance, teacherId]
  );
  const todayRecord = myAttendance.find((r) => r.date === TODAY);

  const classStudents = useMemo(
    () => (selectedClassId ? students.filter((s) => s.classId === selectedClassId) : []),
    [selectedClassId, students]
  );

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
          { id: 'CURRICULUM', label: 'Curriculum Uploads', icon: <Upload className="w-3.5 h-3.5" /> }
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
                    <Badge tone={r.status === 'APPROVED' ? 'emerald' : r.status === 'PENDING' ? 'amber' : 'rose'}>
                      {r.status}
                    </Badge>
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
                  <div key={m.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="orange">{m.subject}</Badge>
                      <span className="text-[10px] text-slate-400">
                        Week {m.weekNumber} · {m.fileFormat}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-1.5">{m.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{m.description}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
};
