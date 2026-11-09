import React, { useEffect, useState } from 'react';
import {
  CurriculumMaterial,
  ParentFeedbackMessage,
  Student,
  StudentMilestoneEvaluation
} from '../types';
import {
  Wallet,
  BookOpen,
  Download,
  Send,
  CheckCircle2,
  Clock,
  MessageSquare,
  GraduationCap,
  AlertCircle,
  Loader2,
  UserX,
  Award,
  Heart,
  Hash,
  Search
} from 'lucide-react';
import { Badge, EmptyState, ProgressBar, SectionCard, StatCard, Tabs } from './ui';

interface ParentPortalProps {
  student: Student | null;
  curriculum: CurriculumMaterial[];
  feedbacks: ParentFeedbackMessage[];
  evaluation: StudentMilestoneEvaluation | null;
  onSubmitFeedback: (subject: string, message: string) => Promise<void>;
  onLookupStudent: (registrationNumber: string) => boolean;
}

type Tab = 'PERFORMANCE' | 'FEES' | 'CURRICULUM' | 'FEEDBACK';

const formatRwf = (amount: number) => `${(amount ?? 0).toLocaleString()} RWF`;

const READINESS_TONE: Record<string, 'emerald' | 'blue' | 'amber' | 'rose'> = {
  EXCELLING: 'emerald',
  MEETING_STANDARDS: 'blue',
  DEVELOPING: 'amber',
  NEEDS_SUPPORT: 'rose'
};

const inputClass =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-400';

export const ParentPortal: React.FC<ParentPortalProps> = ({
  student,
  curriculum,
  feedbacks,
  evaluation,
  onSubmitFeedback,
  onLookupStudent
}) => {
  const [tab, setTab] = useState<Tab>('PERFORMANCE');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lookupReg, setLookupReg] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (student?.regNumber) setLookupReg(student.regNumber);
  }, [student?.regNumber]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const reg = lookupReg.trim();
    if (!reg) {
      setLookupError('Enter your child’s registration number / ID to continue.');
      return;
    }
    const found = onLookupStudent(reg);
    if (!found) {
      setLookupError('No pupil was found with that registration number. Please check and try again.');
      return;
    }
    setTab('PERFORMANCE');
  };

  const termFee = student?.tuitionFeeTerm ?? 0;
  const paidAmount = student?.paidAmount ?? 0;
  const balance = student?.balance ?? 0;
  const paidPercent = termFee > 0 ? Math.min(100, Math.round((paidAmount / termFee) * 100)) : 0;
  const isCleared = balance <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmitFeedback(subject.trim(), message.trim());
      setSubject('');
      setMessage('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const pillars = evaluation
    ? [
        { label: 'Early Literacy & Phonics', value: evaluation.earlyLiteracy },
        { label: 'Numeracy & Sorting', value: evaluation.numeracySkills },
        { label: 'Fine & Gross Motor', value: evaluation.fineGrossMotor },
        { label: 'Social-Emotional', value: evaluation.socialBehavior },
        { label: 'Hygiene & Self-Care', value: evaluation.hygieneSelfCare }
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Parent Portal</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {student
            ? `Welcome, ${student.parentName}. Track your child's progress, fees and materials.`
            : 'Track your child’s progress, fees and materials.'}
        </p>
      </div>

      {student ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex items-center gap-4">
          <span className="w-12 h-12 shrink-0 rounded-full bg-orange-100 text-orange-600 font-extrabold text-lg flex items-center justify-center">
            {student.firstName[0]}
            {student.lastName[0]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {student.className} · {student.regNumber}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center gap-3">
          <UserX className="w-6 h-6 text-slate-400" />
          <p className="text-sm text-slate-500">
            No pupil is linked yet. Enter your child’s registration number below to review their
            performance.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 shrink-0 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
            <Hash className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Review a pupil record</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Enter the child’s Registration Number / ID to view their academic performance.
            </p>
            <form onSubmit={handleLookup} className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                value={lookupReg}
                onChange={(e) => setLookupReg(e.target.value)}
                placeholder="e.g. IRR-2026-001"
                className={`${inputClass} font-mono uppercase sm:flex-1`}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                Review Performance
              </button>
            </form>
            {lookupError && (
              <p className="flex items-center gap-1.5 mt-2 text-[11px] text-rose-700">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {lookupError}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: 'PERFORMANCE', label: 'Performance', icon: <Award className="w-3.5 h-3.5" /> },
          { id: 'FEES', label: 'Fee Balance', icon: <Wallet className="w-3.5 h-3.5" /> },
          { id: 'CURRICULUM', label: 'Curriculum', icon: <BookOpen className="w-3.5 h-3.5" /> },
          { id: 'FEEDBACK', label: `Feedback (${feedbacks.length})`, icon: <MessageSquare className="w-3.5 h-3.5" /> }
        ]}
      />

      {tab === 'PERFORMANCE' && (
        <SectionCard title="Child Performance" subtitle="Holistic early-childhood milestones" icon={<Award className="w-5 h-5" />}>
          {!evaluation ? (
            <EmptyState icon={<Award className="w-9 h-9" />} title="No evaluation yet" message="Teacher assessments will appear here." />
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              <div className="text-[11px] text-slate-500">
                {evaluation.term} · {evaluation.evaluationDate}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pillars.map((p) => (
                  <div key={p.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                    <Badge tone={READINESS_TONE[p.value]}>{p.value.replace(/_/g, ' ')}</Badge>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" /> Teacher's Remarks
                </h3>
                <p className="text-xs text-slate-800 italic leading-relaxed">
                  "{evaluation.teacherFeedback}"
                </p>
                {evaluation.headmasterEndorsement && (
                  <p className="text-[11px] text-emerald-700 font-semibold">✓ Endorsed by the Headmaster</p>
                )}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'FEES' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Term Fee" value={formatRwf(termFee)} tone="slate" />
            <StatCard label="Paid" value={formatRwf(paidAmount)} tone="emerald" />
            <StatCard label="Remaining" value={formatRwf(balance)} tone={isCleared ? 'emerald' : 'rose'} />
          </div>
          <SectionCard
            title="Student Fee Balance"
            subtitle="Paid vs. remaining for the current term"
            icon={<Wallet className="w-5 h-5" />}
            action={
              student ? (
                isCleared ? (
                  <Badge tone="emerald">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid
                  </Badge>
                ) : (
                  <Badge tone="amber">
                    <Clock className="w-3.5 h-3.5" /> Balance Due
                  </Badge>
                )
              ) : undefined
            }
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                <span>Payment progress</span>
                <span className="font-semibold text-slate-700">{paidPercent}%</span>
              </div>
              <ProgressBar percent={paidPercent} tone={isCleared ? 'emerald' : 'orange'} />
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'CURRICULUM' && (
        <SectionCard title="Curriculum & Books" subtitle="Subjects and materials for home practice" icon={<BookOpen className="w-5 h-5" />}>
          {curriculum.length === 0 ? (
            <EmptyState icon={<BookOpen className="w-9 h-9" />} title="No materials yet" message="Learning materials published by teachers will appear here." />
          ) : (
            <div className="divide-y divide-slate-100">
              {curriculum.map((mat) => (
                <div key={mat.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="orange">{mat.subject}</Badge>
                      <span className="text-[10px] text-slate-400">
                        Week {mat.weekNumber} · {mat.fileFormat} · {mat.fileSize}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-1.5">{mat.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{mat.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1 inline-flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      {mat.uploadedByTeacherName} · {mat.className}
                    </p>
                  </div>
                  <a
                    href={mat.downloadUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {tab === 'FEEDBACK' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Send Feedback" subtitle="Message your child's teachers" icon={<MessageSquare className="w-5 h-5" />}>
            <div className="p-4 sm:p-5 space-y-3">
              {submitted && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Your feedback has been submitted to the school.
                </div>
              )}
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1">Subject</label>
                  <input
                    required
                    disabled={!student || submitting}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Question about Week 6 materials"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    disabled={!student || submitting}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your thoughts or ask a question..."
                    className={`${inputClass} resize-none`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!student || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit Feedback
                    </>
                  )}
                </button>
              </form>
            </div>
          </SectionCard>

          <SectionCard title={`Previous Messages (${feedbacks.length})`} icon={<MessageSquare className="w-5 h-5" />}>
            {feedbacks.length === 0 ? (
              <EmptyState icon={<MessageSquare className="w-9 h-9" />} title="No messages yet" message="Your submitted feedback will appear here." />
            ) : (
              <div className="p-4 space-y-3">
                {feedbacks.map((fb) => (
                  <div key={fb.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold text-slate-800">{fb.subject}</p>
                      <Badge tone={fb.status === 'REPLIED' ? 'emerald' : 'amber'}>
                        {fb.status === 'REPLIED' ? 'Replied' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{fb.message}</p>
                    <p className="text-[10px] text-slate-400">{fb.createdAt}</p>
                    {fb.response && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="text-[10px] font-semibold text-emerald-800">{fb.response.repliedBy}</p>
                        <p className="text-[11px] text-emerald-900 mt-0.5">{fb.response.message}</p>
                      </div>
                    )}
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
