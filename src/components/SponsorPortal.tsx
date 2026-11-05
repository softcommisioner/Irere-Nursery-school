import React, { useState } from 'react';
import {
  CurriculumMaterial,
  FeePayment,
  LedgerEntry,
  SchoolClass,
  Student,
  StudentAttendanceRecord,
  StudentMilestoneEvaluation,
  TeacherAttendanceRecord,
  User
} from '../types';
import {
  Users,
  UserCog,
  GraduationCap,
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  BookOpen,
  CalendarCheck2,
  ShieldAlert,
  Eye
} from 'lucide-react';
import { Badge, EmptyState, ProgressBar, ReadOnlyBadge, SectionCard, StatCard, Tabs } from './ui';

interface SponsorPortalProps {
  classes: SchoolClass[];
  students: Student[];
  staff: User[];
  teacherAttendance: TeacherAttendanceRecord[];
  studentAttendance: StudentAttendanceRecord[];
  payments: FeePayment[];
  ledger: LedgerEntry[];
  curriculum: CurriculumMaterial[];
  evaluations: StudentMilestoneEvaluation[];
}

type Tab = 'OVERVIEW' | 'ATTENDANCE' | 'FINANCE' | 'CURRICULUM';

const formatRwf = (amount: number) => `${(amount ?? 0).toLocaleString()} RWF`;

const roleLabel: Record<string, string> = {
  HEADMASTER: 'Headmaster',
  ACCOUNTANT: 'Accountant',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  SPONSOR: 'Sponsor'
};

export const SponsorPortal: React.FC<SponsorPortalProps> = ({
  classes,
  students,
  staff,
  teacherAttendance,
  studentAttendance,
  payments,
  ledger,
  curriculum,
  evaluations
}) => {
  const [tab, setTab] = useState<Tab>('OVERVIEW');

  const approved = teacherAttendance.filter((r) => r.status === 'APPROVED').length;
  const pending = teacherAttendance.filter((r) => r.status === 'PENDING').length;
  const presentToday = studentAttendance.filter((r) => r.status === 'PRESENT').length;

  const totalBilled = students.reduce((a, s) => a + (s.tuitionFeeTerm ?? 0), 0);
  const totalCollected = students.reduce((a, s) => a + (s.paidAmount ?? 0), 0);
  const totalOutstanding = students.reduce((a, s) => a + (s.balance ?? 0), 0);
  const totalIncome = ledger.filter((e) => e.type === 'INCOME').reduce((a, e) => a + e.amount, 0);
  const totalExpense = ledger.filter((e) => e.type === 'EXPENSE').reduce((a, e) => a + e.amount, 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Sponsor Portal</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            School-wide read-only visibility across students, attendance, finance and curriculum.
          </p>
        </div>
        <ReadOnlyBadge />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Read-only access. As a sponsor you can review all school data, but editing, approving,
          submitting or deleting is disabled.
        </span>
      </div>

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: 'OVERVIEW', label: 'Overview', icon: <Eye className="w-3.5 h-3.5" /> },
          { id: 'ATTENDANCE', label: 'Attendance', icon: <CalendarCheck2 className="w-3.5 h-3.5" /> },
          { id: 'FINANCE', label: 'Finance', icon: <Wallet className="w-3.5 h-3.5" /> },
          { id: 'CURRICULUM', label: 'Curriculum', icon: <BookOpen className="w-3.5 h-3.5" /> }
        ]}
      />

      {tab === 'OVERVIEW' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Total Students" value={students.length} sub={`${classes.length} classes`} icon={<Users className="w-5 h-5" />} tone="orange" />
            <StatCard label="Staff Members" value={staff.length} sub="Accounts on record" icon={<UserCog className="w-5 h-5" />} tone="blue" />
            <StatCard label="Teachers Approved" value={approved} sub={`${pending} pending`} icon={<GraduationCap className="w-5 h-5" />} tone="emerald" />
            <StatCard label="Pupils Present Today" value={presentToday} sub={`${studentAttendance.length} records`} icon={<CalendarCheck2 className="w-5 h-5" />} tone="blue" />
            <StatCard label="Fees Collected" value={formatRwf(totalCollected)} sub={`of ${formatRwf(totalBilled)}`} icon={<Wallet className="w-5 h-5" />} tone="emerald" />
            <StatCard label="Outstanding" value={formatRwf(totalOutstanding)} sub="Unpaid balances" icon={<Scale className="w-5 h-5" />} tone="rose" />
            <StatCard label="Net Balance" value={formatRwf(net)} sub="Income − expenses" icon={<TrendingUp className="w-5 h-5" />} tone="blue" />
          </div>

          <SectionCard title="Class Enrollment" subtitle="Pupils per class" icon={<GraduationCap className="w-5 h-5" />}>
            {classes.length === 0 ? (
              <EmptyState title="No classes found" />
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

          <SectionCard title="Staff Directory" subtitle={`${staff.length} accounts (read-only)`} icon={<UserCog className="w-5 h-5" />}>
            {staff.length === 0 ? (
              <EmptyState title="No staff on record" />
            ) : (
              <div className="divide-y divide-slate-100">
                {staff.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{member.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{member.title}</p>
                    </div>
                    <Badge tone={member.role === 'ACCOUNTANT' ? 'blue' : 'orange'}>
                      {roleLabel[member.role] ?? member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {evaluations.length > 0 && (
            <SectionCard title="Performance Summary" subtitle={`${evaluations.length} evaluations on record`} icon={<GraduationCap className="w-5 h-5" />}>
              <div className="divide-y divide-slate-100">
                {evaluations.map((ev) => {
                  const student = students.find((s) => s.id === ev.studentId);
                  return (
                    <div key={ev.id} className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {student ? `${student.firstName} ${student.lastName}` : ev.studentId}
                        </p>
                        <p className="text-[11px] text-slate-500">{ev.term} · {ev.evaluationDate}</p>
                      </div>
                      <Badge tone="blue">Literacy: {ev.earlyLiteracy.replace(/_/g, ' ')}</Badge>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {tab === 'ATTENDANCE' && (
        <div className="space-y-5">
          <SectionCard title="Teacher Attendance" subtitle="Staff check-in records (read-only)" icon={<GraduationCap className="w-5 h-5" />}>
            {teacherAttendance.length === 0 ? (
              <EmptyState title="No teacher attendance records" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Teacher</th>
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Check-in</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacherAttendance.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 px-4 font-semibold text-slate-800">{r.teacherName}</td>
                        <td className="py-3 px-4 text-slate-600">{r.date}</td>
                        <td className="py-3 px-4 text-slate-600">{r.checkInTime}</td>
                        <td className="py-3 px-4">
                          <Badge tone={r.status === 'APPROVED' ? 'emerald' : r.status === 'PENDING' ? 'amber' : 'rose'}>
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Student Attendance" subtitle="Classroom presence records" icon={<CalendarCheck2 className="w-5 h-5" />}>
            {studentAttendance.length === 0 ? (
              <EmptyState title="No student attendance records" />
            ) : (
              <div className="divide-y divide-slate-100">
                {studentAttendance.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.studentName}</p>
                      <p className="text-[11px] text-slate-400">{r.date}</p>
                    </div>
                    <Badge tone={r.status === 'PRESENT' ? 'emerald' : r.status === 'SICK' ? 'amber' : 'rose'}>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'FINANCE' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Total Income" value={formatRwf(totalIncome)} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
            <StatCard label="Total Expenses" value={formatRwf(totalExpense)} icon={<TrendingDown className="w-5 h-5" />} tone="rose" />
            <StatCard label="Net Balance" value={formatRwf(net)} icon={<Scale className="w-5 h-5" />} tone="blue" />
          </div>

          <SectionCard title="Student Fee Overview" subtitle="Paid vs. remaining (read-only)" icon={<Wallet className="w-5 h-5" />}>
            {students.length === 0 ? (
              <EmptyState title="No student fee data" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Student</th>
                      <th className="py-3 px-4 font-semibold">Class</th>
                      <th className="py-3 px-4 font-semibold">Paid</th>
                      <th className="py-3 px-4 font-semibold">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.className}</td>
                        <td className="py-3 px-4 text-emerald-600 font-semibold">{formatRwf(s.paidAmount)}</td>
                        <td className={`py-3 px-4 font-semibold ${s.balance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatRwf(s.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Ledger Records" subtitle={`${ledger.length} income / expense entries`} icon={<Scale className="w-5 h-5" />}>
            {ledger.length === 0 ? (
              <EmptyState title="No ledger entries" />
            ) : (
              <div className="divide-y divide-slate-100">
                {ledger.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone={entry.type === 'INCOME' ? 'emerald' : 'rose'}>{entry.type}</Badge>
                        <span className="text-[10px] text-slate-400">{entry.entryDate}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-1.5 truncate">{entry.description}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${entry.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.type === 'INCOME' ? '+' : '−'}
                      {formatRwf(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {payments.length > 0 && (
            <SectionCard title="Payment Records" subtitle={`${payments.length} payments`} icon={<Wallet className="w-5 h-5" />}>
              <div className="divide-y divide-slate-100">
                {payments.slice(0, 10).map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.studentName}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.receiptNumber} · {p.paymentMethod.replace('_', ' ')} · {p.paymentDate}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-emerald-600">{formatRwf(p.amount)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {tab === 'CURRICULUM' && (
        <SectionCard title="Curriculum & Books" subtitle={`${curriculum.length} materials (read-only)`} icon={<BookOpen className="w-5 h-5" />}>
          {curriculum.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-9 h-9" />} title="No curriculum materials" />
          ) : (
            <div className="divide-y divide-slate-100">
              {curriculum.map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="orange">{m.subject}</Badge>
                    <span className="text-[10px] text-slate-400">
                      Week {m.weekNumber} · {m.fileFormat} · {m.fileSize}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mt-1.5">{m.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {m.uploadedByTeacherName} · {m.className}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};
