import React, { useState } from 'react';
import {
  FeePayment,
  LedgerCategory,
  LedgerEntry,
  PaymentMethod,
  SchoolClass,
  Student
} from '../types';
import { RecordPaymentInput, LedgerEntryInput } from '../services/api';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  Receipt,
  PlusCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Users
} from 'lucide-react';
import {
  Badge,
  EmptyState,
  ProgressBar,
  SectionCard,
  StatCard,
  Tabs
} from './ui';
import { CardActions, ConfirmDialog, RecordEditField, RecordEditModal } from './StudentDialogs';

interface AccountantPortalProps {
  classes: SchoolClass[];
  students: Student[];
  payments: FeePayment[];
  ledger: LedgerEntry[];
  currentUserName: string;
  onRecordPayment: (input: RecordPaymentInput) => Promise<void>;
  onAddLedgerEntry: (input: LedgerEntryInput) => Promise<void>;
  onUpdatePayment: (
    id: string,
    input: {
      amount: number;
      academicTerm: string;
      paymentMethod: PaymentMethod;
      momoTransactionRef?: string;
      payerName: string;
      payerPhone: string;
      paymentDate: string;
      status: FeePayment['status'];
    }
  ) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  onUpdateLedgerEntry: (id: string, input: LedgerEntryInput) => Promise<void>;
  onDeleteLedgerEntry: (id: string) => Promise<void>;
}

type Tab = 'FEES' | 'LEDGER';

const formatRwf = (amount: number) => `${(amount ?? 0).toLocaleString()} RWF`;

const PAYMENT_METHODS: PaymentMethod[] = ['MTN_MOMO', 'AIRTEL_MONEY', 'BK_TRANSFER', 'CASH'];

const LEDGER_CATEGORIES: LedgerCategory[] = [
  'TUITION_FEE',
  'UNIFORM_SALE',
  'LUNCH_PROGRAM',
  'REGISTRATION_FEE',
  'TEACHER_SALARY',
  'SUPPORT_STAFF',
  'FOOD_SUPPLIES',
  'LEARNING_MATERIALS',
  'UTILITIES_WASAC_REG',
  'FACILITY_MAINTENANCE',
  'HYGIENE_HEALTH'
];

const inputClass =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';

export const AccountantPortal: React.FC<AccountantPortalProps> = ({
  students,
  payments,
  ledger,
  currentUserName,
  onRecordPayment,
  onAddLedgerEntry,
  onUpdatePayment,
  onDeletePayment,
  onUpdateLedgerEntry,
  onDeleteLedgerEntry
}) => {
  const [tab, setTab] = useState<Tab>('FEES');

  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    amount: '',
    method: 'MTN_MOMO' as PaymentMethod,
    date: new Date().toISOString().slice(0, 10),
    payerName: '',
    payerPhone: '',
    reference: ''
  });
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [ledgerForm, setLedgerForm] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    category: 'TUITION_FEE' as LedgerCategory,
    amount: '',
    description: '',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
    method: 'MTN_MOMO' as PaymentMethod
  });
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerMsg, setLedgerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [paymentAction, setPaymentAction] = useState<{
    mode: 'edit' | 'delete';
    payment: FeePayment;
  } | null>(null);
  const [paymentActionBusy, setPaymentActionBusy] = useState(false);
  const [paymentActionError, setPaymentActionError] = useState<string | null>(null);

  const [ledgerAction, setLedgerAction] = useState<{
    mode: 'edit' | 'delete';
    entry: LedgerEntry;
  } | null>(null);
  const [ledgerActionBusy, setLedgerActionBusy] = useState(false);
  const [ledgerActionError, setLedgerActionError] = useState<string | null>(null);

  const totalBilled = students.reduce((a, s) => a + (s.tuitionFeeTerm ?? 0), 0);
  const totalCollected = students.reduce((a, s) => a + (s.paidAmount ?? 0), 0);
  const totalOutstanding = students.reduce((a, s) => a + (s.balance ?? 0), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const totalIncome = ledger.filter((e) => e.type === 'INCOME').reduce((a, e) => a + e.amount, 0);
  const totalExpense = ledger.filter((e) => e.type === 'EXPENSE').reduce((a, e) => a + e.amount, 0);
  const net = totalIncome - totalExpense;

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find((s) => s.id === paymentForm.studentId);
    if (!student || !paymentForm.amount) {
      setPaymentMsg({ type: 'err', text: 'Select a student and enter an amount.' });
      return;
    }
    setPaymentBusy(true);
    setPaymentMsg(null);
    try {
      await onRecordPayment({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentReg: student.regNumber,
        classId: student.classId,
        className: student.className,
        amount: Number(paymentForm.amount),
        academicTerm: 'Term 1 - 2026',
        paymentMethod: paymentForm.method,
        momoTransactionRef: paymentForm.reference || undefined,
        payerName: paymentForm.payerName || student.parentName,
        payerPhone: paymentForm.payerPhone || student.parentPhone,
        receivedBy: currentUserName,
        paymentDate: paymentForm.date
      });
      setPaymentMsg({ type: 'ok', text: 'Payment recorded successfully.' });
      setPaymentForm((f) => ({ ...f, amount: '', reference: '' }));
    } catch (err) {
      setPaymentMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not record payment.'
      });
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerForm.amount || !ledgerForm.description) {
      setLedgerMsg({ type: 'err', text: 'Enter a description and amount.' });
      return;
    }
    setLedgerBusy(true);
    setLedgerMsg(null);
    try {
      await onAddLedgerEntry({
        entryDate: ledgerForm.date,
        description: ledgerForm.description,
        type: ledgerForm.type,
        category: ledgerForm.category,
        amount: Number(ledgerForm.amount),
        referenceDocNumber: ledgerForm.reference || '—',
        recordedBy: currentUserName,
        paymentMethod: ledgerForm.method
      });
      setLedgerMsg({ type: 'ok', text: 'Ledger entry added.' });
      setLedgerForm((f) => ({ ...f, amount: '', description: '', reference: '' }));
    } catch (err) {
      setLedgerMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not add ledger entry.'
      });
    } finally {
      setLedgerBusy(false);
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
        paymentMethod: values.paymentMethod as PaymentMethod,
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

  const handleSaveLedgerEdit = async (values: Record<string, string>) => {
    if (!ledgerAction || ledgerAction.mode !== 'edit') return;
    setLedgerActionBusy(true);
    setLedgerActionError(null);
    try {
      await onUpdateLedgerEntry(ledgerAction.entry.id, {
        entryDate: values.entryDate,
        description: values.description.trim(),
        type: values.type as LedgerEntry['type'],
        category: values.category as LedgerCategory,
        amount: Number(values.amount) || 0,
        referenceDocNumber: values.referenceDocNumber.trim() || '—',
        recordedBy: ledgerAction.entry.recordedBy,
        paymentMethod: values.paymentMethod as PaymentMethod
      });
      setLedgerAction(null);
    } catch (err) {
      setLedgerActionError(
        err instanceof Error ? err.message : 'Could not update the ledger entry.'
      );
    } finally {
      setLedgerActionBusy(false);
    }
  };

  const handleConfirmLedgerDelete = async () => {
    if (!ledgerAction || ledgerAction.mode !== 'delete') return;
    setLedgerActionBusy(true);
    setLedgerActionError(null);
    try {
      await onDeleteLedgerEntry(ledgerAction.entry.id);
      setLedgerAction(null);
    } catch (err) {
      setLedgerActionError(
        err instanceof Error ? err.message : 'Could not delete the ledger entry.'
      );
    } finally {
      setLedgerActionBusy(false);
    }
  };

  const paymentEditFields: RecordEditField[] = [
    { key: 'amount', label: 'Amount (RWF)', type: 'number', min: 0, required: true },
    { key: 'paymentDate', label: 'Payment date', type: 'date', required: true },
    {
      key: 'paymentMethod',
      label: 'Payment method',
      type: 'select',
      options: PAYMENT_METHODS.map((method) => ({
        value: method,
        label: method.replace(/_/g, ' ')
      }))
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

  const ledgerEditFields: RecordEditField[] = [
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'INCOME', label: 'Income' },
        { value: 'EXPENSE', label: 'Expense' }
      ]
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: LEDGER_CATEGORIES.map((category) => ({
        value: category,
        label: category.replace(/_/g, ' ')
      }))
    },
    { key: 'amount', label: 'Amount (RWF)', type: 'number', min: 0, required: true },
    { key: 'entryDate', label: 'Date', type: 'date', required: true },
    { key: 'description', label: 'Description', required: true, fullWidth: true },
    { key: 'referenceDocNumber', label: 'Reference' },
    {
      key: 'paymentMethod',
      label: 'Method',
      type: 'select',
      options: PAYMENT_METHODS.map((method) => ({
        value: method,
        label: method.replace(/_/g, ' ')
      }))
    }
  ];

  const Msg: React.FC<{ msg: { type: 'ok' | 'err'; text: string } | null }> = ({ msg }) =>
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
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">Accountant Portal</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Financial ledger, student fee tracking and income / expense records.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Fees Collected" value={formatRwf(totalCollected)} sub={`${collectionRate}% of billed`} icon={<Wallet className="w-5 h-5" />} tone="emerald" />
        <StatCard label="Outstanding" value={formatRwf(totalOutstanding)} sub="Unpaid balance" icon={<Scale className="w-5 h-5" />} tone="amber" />
        <StatCard label="Total Income" value={formatRwf(totalIncome)} sub="All ledger income" icon={<TrendingUp className="w-5 h-5" />} tone="blue" />
        <StatCard label="Total Expenses" value={formatRwf(totalExpense)} sub="All ledger expenses" icon={<TrendingDown className="w-5 h-5" />} tone="rose" />
      </div>

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        items={[
          { id: 'FEES', label: 'Fee Tracking', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'LEDGER', label: 'Ledger & Records', icon: <FileText className="w-3.5 h-3.5" /> }
        ]}
      />

      {tab === 'FEES' && (
        <div className="space-y-5">
          <SectionCard title="Student Fee Tracking" subtitle="Paid vs. remaining balance per pupil" icon={<Wallet className="w-5 h-5" />}>
            {students.length === 0 ? (
              <EmptyState icon={<Users className="w-9 h-9" />} title="No students" message="Student fee data will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Student</th>
                      <th className="py-3 px-4 font-semibold">Class</th>
                      <th className="py-3 px-4 font-semibold">Billed</th>
                      <th className="py-3 px-4 font-semibold">Paid</th>
                      <th className="py-3 px-4 font-semibold">Remaining</th>
                      <th className="py-3 px-4 font-semibold w-40">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => {
                      const percent = s.tuitionFeeTerm > 0 ? (s.paidAmount / s.tuitionFeeTerm) * 100 : 0;
                      const cleared = s.balance <= 0;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">
                              {s.firstName} {s.lastName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{s.regNumber}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{s.className}</td>
                          <td className="py-3 px-4 text-slate-600">{formatRwf(s.tuitionFeeTerm)}</td>
                          <td className="py-3 px-4 font-semibold text-emerald-600">{formatRwf(s.paidAmount)}</td>
                          <td className={`py-3 px-4 font-semibold ${cleared ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {formatRwf(s.balance)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <ProgressBar percent={percent} tone={cleared ? 'emerald' : 'orange'} />
                              <span className="text-[10px] text-slate-500 w-8 text-right">
                                {Math.round(percent)}%
                              </span>
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

          <SectionCard title="Record a Payment" subtitle="Log a new fee payment received" icon={<Receipt className="w-5 h-5" />}>
            <form onSubmit={handlePaymentSubmit} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Msg msg={paymentMsg} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Student</label>
                <select
                  required
                  value={paymentForm.studentId}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, studentId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} · {s.regNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Amount (RWF)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Date</label>
                <input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Payer name</label>
                <input
                  value={paymentForm.payerName}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payerName: e.target.value }))}
                  placeholder="Defaults to parent on record"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Reference</label>
                <input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="MoMo / bank reference"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={paymentBusy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {paymentBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Record payment
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      )}

      {tab === 'LEDGER' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <StatCard label="Total Income" value={formatRwf(totalIncome)} icon={<TrendingUp className="w-5 h-5" />} tone="emerald" />
            <StatCard label="Total Expenses" value={formatRwf(totalExpense)} icon={<TrendingDown className="w-5 h-5" />} tone="rose" />
            <StatCard label="Net Balance" value={formatRwf(net)} icon={<Scale className="w-5 h-5" />} tone="blue" />
          </div>

          <SectionCard title="Add Ledger Entry" subtitle="Record income or an expense" icon={<PlusCircle className="w-5 h-5" />}>
            <form onSubmit={handleLedgerSubmit} className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Msg msg={ledgerMsg} />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Type</label>
                <select
                  value={ledgerForm.type}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, type: e.target.value as 'INCOME' | 'EXPENSE' }))}
                  className={inputClass}
                >
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Category</label>
                <select
                  value={ledgerForm.category}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, category: e.target.value as LedgerCategory }))}
                  className={inputClass}
                >
                  {LEDGER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Amount (RWF)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={ledgerForm.amount}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, amount: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Date</label>
                <input
                  type="date"
                  value={ledgerForm.date}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 text-xs mb-1">Description</label>
                <input
                  required
                  value={ledgerForm.description}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Term 1 tuition collection batch"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Reference</label>
                <input
                  value={ledgerForm.reference}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="Doc / invoice number"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 text-xs mb-1">Method</label>
                <select
                  value={ledgerForm.method}
                  onChange={(e) => setLedgerForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={ledgerBusy}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {ledgerBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  Add entry
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Financial Records" subtitle="Income and expense ledger" icon={<FileText className="w-5 h-5" />}>
            {ledger.length === 0 ? (
              <EmptyState icon={<FileText className="w-9 h-9" />} title="No ledger entries" message="Income and expense records will appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {ledger.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={entry.type === 'INCOME' ? 'emerald' : 'rose'}>{entry.type}</Badge>
                        <span className="text-[10px] text-slate-400">{entry.category.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 mt-1.5">{entry.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {entry.entryDate} · {entry.referenceDocNumber} · {entry.recordedBy}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`text-sm font-bold ${
                          entry.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {entry.type === 'INCOME' ? '+' : '−'}
                        {formatRwf(entry.amount)}
                      </span>
                      <CardActions
                        onEdit={() => {
                          setLedgerActionError(null);
                          setLedgerAction({ mode: 'edit', entry });
                        }}
                        onDelete={() => {
                          setLedgerActionError(null);
                          setLedgerAction({ mode: 'delete', entry });
                        }}
                        editLabel="Edit ledger entry"
                        deleteLabel="Delete ledger entry"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {payments.length > 0 && (
            <SectionCard title="Recent Payments" subtitle={`${payments.length} payment records`} icon={<Receipt className="w-5 h-5" />}>
              <div className="divide-y divide-slate-100">
                {payments.slice(0, 8).map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.studentName}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.receiptNumber} · {p.paymentMethod.replace('_', ' ')} · {p.paymentDate}
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
            </SectionCard>
          )}
        </div>
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

      {ledgerAction?.mode === 'edit' && (
        <RecordEditModal
          key={ledgerAction.entry.id}
          title="Edit ledger entry"
          subtitle={`${ledgerAction.entry.type} · ${ledgerAction.entry.entryDate}`}
          fields={ledgerEditFields}
          initialValues={{
            type: ledgerAction.entry.type,
            category: ledgerAction.entry.category,
            amount: ledgerAction.entry.amount,
            entryDate: ledgerAction.entry.entryDate,
            description: ledgerAction.entry.description,
            referenceDocNumber: ledgerAction.entry.referenceDocNumber,
            paymentMethod: ledgerAction.entry.paymentMethod
          }}
          busy={ledgerActionBusy}
          error={ledgerActionError}
          onClose={() => {
            setLedgerAction(null);
            setLedgerActionError(null);
          }}
          onSave={handleSaveLedgerEdit}
        />
      )}

      {ledgerAction?.mode === 'delete' && (
        <ConfirmDialog
          title="Delete ledger entry"
          message={
            <>
              Delete <strong>{ledgerAction.entry.description}</strong> (
              {formatRwf(ledgerAction.entry.amount)}) from the financial ledger?
            </>
          }
          busy={ledgerActionBusy}
          error={ledgerActionError}
          onCancel={() => {
            setLedgerAction(null);
            setLedgerActionError(null);
          }}
          onConfirm={handleConfirmLedgerDelete}
        />
      )}
    </div>
  );
};
