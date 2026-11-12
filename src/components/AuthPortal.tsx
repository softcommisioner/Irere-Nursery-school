import React, { useState } from 'react';
import { Student, UserRole } from '../types';
import { SCHOOL_INFO } from '../config/school';
import {
  AuthSession,
  ROLE_LABELS,
  registerParent,
  signIn
} from '../services/auth';
import {
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Users,
  HeartHandshake,
  Eye,
  EyeOff,
  LogIn,
  Mail,
  Lock,
  User,
  Phone,
  Hash,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  ShieldAlert,
  KeyRound,
  Loader2
} from 'lucide-react';
import { cx } from './ui';

interface AuthPortalProps {
  onAuthenticated: (session: AuthSession) => void;
  onBack: () => void;
  knownStudents: Student[];
  schoolLogo?: string | null;
}

interface PortalMeta {
  role: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  readOnly?: boolean;
}

const PORTALS: PortalMeta[] = [
  {
    role: 'HEADMASTER',
    label: 'Headmaster',
    description: 'School-wide oversight, staff accounts and approvals.',
    icon: <ShieldCheck className="w-4 h-4" />
  },
  {
    role: 'ACCOUNTANT',
    label: 'Accountant',
    description: 'Fees, payments and the school ledger.',
    icon: <Briefcase className="w-4 h-4" />
  },
  {
    role: 'TEACHER',
    label: 'Teacher',
    description: 'Check-in, attendance and curriculum uploads.',
    icon: <GraduationCap className="w-4 h-4" />
  },
  {
    role: 'PARENT',
    label: 'Parent',
    description: 'Your child’s fees, progress and learning materials.',
    icon: <Users className="w-4 h-4" />
  },
  {
    role: 'SPONSOR',
    label: 'Sponsor',
    description: 'Secure review-only visibility across the school.',
    icon: <HeartHandshake className="w-4 h-4" />,
    readOnly: true
  }
];

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-colors';
const labelCls = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

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

const ErrorNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
    <span className="flex-1">{children}</span>
  </div>
);

export const AuthPortal: React.FC<AuthPortalProps> = ({
  onAuthenticated,
  onBack,
  knownStudents,
  schoolLogo
}) => {
  const [role, setRole] = useState<UserRole>('HEADMASTER');
  const [parentMode, setParentMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [parentConfirm, setParentConfirm] = useState('');
  const [childName, setChildName] = useState('');
  const [childReg, setChildReg] = useState('');

  const meta = PORTALS.find((portal) => portal.role === role) ?? PORTALS[0];

  const resetFeedback = () => {
    setError(null);
  };

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setParentMode('LOGIN');
    setError(null);
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const switchParentMode = (mode: 'LOGIN' | 'REGISTER') => {
    setParentMode(mode);
    setError(null);
    setShowPassword(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setBusy(true);
    try {
      const result = await signIn(email, password, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      onAuthenticated(result.session);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (!parentName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (parentPassword.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }

    if (parentPassword !== parentConfirm) {
      setError('The two passwords do not match.');
      return;
    }

    if (!childReg.trim()) {
      setError('Enter your child’s registration number / ID.');
      return;
    }

    const normalizedReg = childReg.trim().toUpperCase();
    const matchedStudent = knownStudents.find(
      (student) => student.regNumber.toUpperCase() === normalizedReg
    );

    if (knownStudents.length > 0 && !matchedStudent) {
      setError(
        'No pupil was found with that registration number. Please check the ID or contact the school office.'
      );
      return;
    }

    setBusy(true);
    try {
      const result = await registerParent({
        name: parentName.trim(),
        email: parentEmail.trim(),
        phone: parentPhone.trim() || undefined,
        password: parentPassword,
        linkedStudentReg: matchedStudent?.regNumber ?? normalizedReg,
        linkedStudentName:
          childName.trim() ||
          (matchedStudent ? `${matchedStudent.firstName} ${matchedStudent.lastName}` : undefined)
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onAuthenticated(result.session);
    } finally {
      setBusy(false);
    }
  };

  const portalTitle = role === 'PARENT' ? 'Parent Portal' : `${meta.label} Portal`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3 min-w-0">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt={`${SCHOOL_INFO.name} logo`}
                  className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
                />
              ) : (
                <span className="w-10 h-10 shrink-0 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
                  <GraduationCap className="w-6 h-6 text-white" />
                </span>
              )}
              <div className="leading-tight min-w-0">
                <p className="text-sm font-extrabold text-slate-800 truncate">{SCHOOL_INFO.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  Secure portal access · {SCHOOL_INFO.district}
                </p>
              </div>
            </div>
            <button
              onClick={onBack}
              aria-label="Back to home"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to home</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-6 lg:gap-8 items-start">
          <section className="space-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
                <Lock className="w-3.5 h-3.5" />
                Secure sign in
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
                Choose your portal
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Every portal has its own login. Select your role to continue.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2.5">
              {PORTALS.map((portal) => {
                const isActive = portal.role === role;
                return (
                  <button
                    key={portal.role}
                    type="button"
                    onClick={() => selectRole(portal.role)}
                    className={cx(
                      'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                      isActive
                        ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-orange-300'
                    )}
                  >
                    <span
                      className={cx(
                        'w-9 h-9 shrink-0 rounded-lg flex items-center justify-center',
                        isActive ? 'bg-white/15 text-white' : 'bg-orange-50 text-orange-600'
                      )}
                    >
                      {portal.icon}
                    </span>
                    <span className="leading-tight min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{portal.label}</span>
                        {portal.readOnly && (
                          <Eye
                            className={cx('w-3 h-3', isActive ? 'text-white' : 'text-amber-500')}
                            aria-label="Read-only"
                          />
                        )}
                      </span>
                      <span
                        className={cx(
                          'mt-0.5 block text-[10px] leading-snug',
                          isActive ? 'text-orange-50' : 'text-slate-400'
                        )}
                      >
                        {portal.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="hidden lg:block rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-orange-800">
                <KeyRound className="w-4 h-4" />
                <p className="text-xs font-bold">Staff credentials</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-orange-800/80">
                Staff sign in with the official work email and the password assigned by the
                Headmaster. Contact the school office if you need your password reset.
              </p>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 shrink-0 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-800">
                      {portalTitle}
                    </h2>
                    {meta.readOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        <Eye className="w-3 h-3" />
                        Read-only
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {role === 'PARENT' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => switchParentMode('LOGIN')}
                      className={cx(
                        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                        parentMode === 'LOGIN'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      Log In
                    </button>
                    <button
                      type="button"
                      onClick={() => switchParentMode('REGISTER')}
                      className={cx(
                        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                        parentMode === 'REGISTER'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Create New Account
                    </button>
                  </div>

                  {parentMode === 'LOGIN' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <Field label="Email address">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className={`${inputCls} pl-9`}
                          />
                        </div>
                      </Field>

                      <Field label="Password">
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className={`${inputCls} pl-9 pr-11`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </Field>

                      {error && <ErrorNotice>{error}</ErrorNotice>}

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogIn className="w-4 h-4" />
                        )}
                        {busy ? 'Signing in…' : 'Log In to Parent Portal'}
                      </button>

                      <p className="text-center text-[11px] text-slate-500">
                        New here?{' '}
                        <button
                          type="button"
                          onClick={() => switchParentMode('REGISTER')}
                          className="font-bold text-orange-600 hover:text-orange-700"
                        >
                          Create a parent account
                        </button>
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                        Create your account and link your child so you can view fee balances,
                        curriculum and academic performance.
                      </div>

                      <Field label="Full name">
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            autoComplete="name"
                            value={parentName}
                            onChange={(e) => setParentName(e.target.value)}
                            placeholder="e.g. Mugisha Diane"
                            className={`${inputCls} pl-9`}
                          />
                        </div>
                      </Field>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Email address">
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="email"
                              autoComplete="email"
                              value={parentEmail}
                              onChange={(e) => setParentEmail(e.target.value)}
                              placeholder="you@example.com"
                              className={`${inputCls} pl-9`}
                            />
                          </div>
                        </Field>
                        <Field label="Phone (optional)">
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="tel"
                              autoComplete="tel"
                              value={parentPhone}
                              onChange={(e) => setParentPhone(e.target.value)}
                              placeholder="+250 7xx xxx xxx"
                              className={`${inputCls} pl-9`}
                            />
                          </div>
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Password">
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={parentPassword}
                              onChange={(e) => setParentPassword(e.target.value)}
                              placeholder="At least 8 characters"
                              className={`${inputCls} pl-9 pr-10`}
                            />
                          </div>
                        </Field>
                        <Field label="Confirm password">
                          <div className="relative">
                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={parentConfirm}
                              onChange={(e) => setParentConfirm(e.target.value)}
                              placeholder="Repeat password"
                              className={`${inputCls} pl-9`}
                            />
                          </div>
                        </Field>
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        <p className="flex items-center gap-1.5 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <GraduationCap className="w-3.5 h-3.5 text-orange-500" />
                          Link your child
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Child’s full name (optional)">
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={childName}
                              onChange={(e) => setChildName(e.target.value)}
                              placeholder="e.g. Mugisha Kevin"
                              className={`${inputCls} pl-9`}
                            />
                          </div>
                        </Field>
                        <Field label="Child’s registration number / ID">
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              value={childReg}
                              onChange={(e) => setChildReg(e.target.value)}
                              placeholder="e.g. IRR-2026-001"
                              className={`${inputCls} pl-9 font-mono uppercase`}
                            />
                          </div>
                        </Field>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        The registration number is printed on your child’s admission letter. You
                        can also enter it later to review a pupil’s performance.
                      </p>

                      {error && <ErrorNotice>{error}</ErrorNotice>}

                      <button
                        type="submit"
                        disabled={busy}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4" />
                        )}
                        {busy ? 'Creating account…' : 'Create Parent Account'}
                      </button>

                      <p className="text-center text-[11px] text-slate-500">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchParentMode('LOGIN')}
                          className="font-bold text-orange-600 hover:text-orange-700"
                        >
                          Log in
                        </button>
                      </p>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {role === 'SPONSOR' && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Sponsor access is review-only. You can view school data but cannot edit,
                        approve or submit records.
                      </span>
                    </div>
                  )}

                  <Field label="Email or phone number">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@irerenursery.rw or 07xx xxx xxx"
                        className={`${inputCls} pl-9`}
                      />
                    </div>
                  </Field>

                  <Field label="Password">
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your assigned password"
                        className={`${inputCls} pl-9 pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  {error && <ErrorNotice>{error}</ErrorNotice>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    {busy ? 'Signing in…' : `Log In to ${meta.label} Portal`}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {role === 'SPONSOR'
                        ? 'Secure review-only access'
                        : role === 'HEADMASTER'
                          ? 'Headmaster signs in with the school phone number or email.'
                          : 'Use the password assigned by the Headmaster.'}
                    </span>
                  </div>
                </form>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <p className="text-[10px] leading-relaxed text-slate-400">
                {ROLE_LABELS[role]} portal · {SCHOOL_INFO.academicYear} {SCHOOL_INFO.currentTerm}.
                Never share your password. Contact {SCHOOL_INFO.email} for help.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-1 text-[10px] text-slate-500">
          <span className="font-semibold text-slate-700">{SCHOOL_INFO.name}</span>
          <span>
            {SCHOOL_INFO.village} · {SCHOOL_INFO.sector} · {SCHOOL_INFO.district}
          </span>
        </div>
      </footer>
    </div>
  );
};
