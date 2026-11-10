import React, { useEffect, useState } from 'react';
import { SchoolClass, Student } from '../types';
import {
  AlertCircle,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { cx } from './ui';

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

const ErrorNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800">
    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
    <span className="flex-1">{children}</span>
  </div>
);

const ModalShell: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, onClose, children }) => {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <span className="w-9 h-9 shrink-0 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-800 truncate">{title}</h2>
              {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
};

export interface StudentEditValues {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  dob: string;
  classId: string;
  className: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  residenceVillage: string;
  tuitionFeeTerm: number;
}

export const StudentEditModal: React.FC<{
  student: Student;
  classes: SchoolClass[];
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (id: string, values: StudentEditValues) => Promise<void>;
}> = ({ student, classes, busy, error, onClose, onSave }) => {
  const [form, setForm] = useState<StudentEditValues>(() => ({
    firstName: student.firstName ?? '',
    lastName: student.lastName ?? '',
    gender: student.gender ?? 'F',
    dob: student.dob ?? '',
    classId: student.classId ?? '',
    className: student.className ?? '',
    parentName: student.parentName ?? '',
    parentPhone: student.parentPhone ?? '',
    parentEmail: student.parentEmail ?? '',
    residenceVillage: student.residenceVillage ?? '',
    tuitionFeeTerm: student.tuitionFeeTerm ?? 0
  }));
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setLocalError('Student first and last name are required.');
      return;
    }
    if (!form.classId) {
      setLocalError('Please choose a class for the student.');
      return;
    }

    const cls = classes.find((item) => item.id === form.classId);
    try {
      await onSave(student.id, {
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim(),
        residenceVillage: form.residenceVillage.trim(),
        className: cls?.name ?? form.className
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not update the student.');
    }
  };

  return (
    <ModalShell
      title="Edit student"
      subtitle={`${student.firstName} ${student.lastName} · ${student.regNumber}`}
      icon={<Pencil className="w-4 h-4" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputCls}
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputCls}
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Gender">
            <select
              className={inputCls}
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value as 'M' | 'F' }))
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
              value={form.dob}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Class">
            <select
              className={inputCls}
              value={form.classId}
              onChange={(e) => {
                const classId = e.target.value;
                const cls = classes.find((item) => item.id === classId);
                setForm((f) => ({ ...f, classId, className: cls?.name ?? f.className }));
              }}
            >
              <option value="">Select a class…</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Term tuition fee (RWF)">
            <input
              type="number"
              min="0"
              className={inputCls}
              value={form.tuitionFeeTerm}
              onChange={(e) =>
                setForm((f) => ({ ...f, tuitionFeeTerm: Number(e.target.value) }))
              }
            />
          </Field>
        </div>

        <div className="pt-1 border-t border-slate-100">
          <p className="pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Parent / guardian
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Parent name">
            <input
              className={inputCls}
              value={form.parentName}
              onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))}
            />
          </Field>
          <Field label="Parent phone">
            <input
              className={inputCls}
              value={form.parentPhone}
              onChange={(e) => setForm((f) => ({ ...f, parentPhone: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Parent email">
            <input
              type="email"
              className={inputCls}
              value={form.parentEmail}
              onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
            />
          </Field>
          <Field label="Residence village">
            <input
              className={inputCls}
              value={form.residenceVillage}
              onChange={(e) =>
                setForm((f) => ({ ...f, residenceVillage: e.target.value }))
              }
            />
          </Field>
        </div>

        {(localError || error) && <ErrorNotice>{localError ?? error}</ErrorNotice>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export const ConfirmDialog: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}> = ({ title, message, confirmLabel = 'Delete', busy, error, onCancel, onConfirm }) => (
  <ModalShell
    title={title}
    icon={<Trash2 className="w-4 h-4" />}
    onClose={busy ? () => undefined : onCancel}
  >
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1">{message}</div>
      </div>

      {error && <ErrorNotice>{error}</ErrorNotice>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);

export const StudentRegisterTable: React.FC<{
  students: Student[];
  busyId?: string | null;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}> = ({ students, busyId, onEdit, onDelete }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
        <tr>
          <th className="py-3 px-4 font-semibold">Reg. No.</th>
          <th className="py-3 px-4 font-semibold">Student</th>
          <th className="py-3 px-4 font-semibold">Class</th>
          <th className="py-3 px-4 font-semibold">Parent</th>
          <th className="py-3 px-4 font-semibold text-right">Balance</th>
          <th className="py-3 px-4 font-semibold text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {students.map((student) => (
          <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
              {student.regNumber}
            </td>
            <td className="py-3 px-4">
              <p className="font-semibold text-slate-800">
                {student.firstName} {student.lastName}
              </p>
              <p className="text-[10px] text-slate-400">{student.dob}</p>
            </td>
            <td className="py-3 px-4">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-800">
                {student.className}
              </span>
            </td>
            <td className="py-3 px-4 text-slate-600">
              <p>{student.parentName}</p>
              <p className="text-[10px] text-slate-400">{student.parentPhone}</p>
            </td>
            <td
              className={cx(
                'py-3 px-4 text-right font-semibold',
                student.balance <= 0 ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {(student.balance ?? 0).toLocaleString()} RWF
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => onEdit(student)}
                  title="Edit student"
                  aria-label={`Edit ${student.firstName} ${student.lastName}`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(student)}
                  disabled={busyId === student.id}
                  title="Delete student"
                  aria-label={`Delete ${student.firstName} ${student.lastName}`}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition-colors disabled:opacity-50"
                >
                  {busyId === student.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
