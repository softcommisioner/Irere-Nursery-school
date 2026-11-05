import React from 'react';
import { UserRole } from '../types';
import {
  ShieldCheck,
  Briefcase,
  GraduationCap,
  Users,
  HeartHandshake,
  Eye
} from 'lucide-react';
import { cx } from './ui';

interface RoleSwitcherProps {
  activeRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

const ROLES: {
  id: UserRole;
  label: string;
  sub: string;
  icon: React.ReactNode;
  readOnly?: boolean;
}[] = [
  { id: 'HEADMASTER', label: 'Headmaster', sub: 'Overview & approvals', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'ACCOUNTANT', label: 'Accountant', sub: 'Fees & ledger', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'TEACHER', label: 'Teacher', sub: 'Check-in & classes', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'PARENT', label: 'Parent', sub: 'Child & fees', icon: <Users className="w-4 h-4" /> },
  { id: 'SPONSOR', label: 'Sponsor', sub: 'Read-only view', icon: <HeartHandshake className="w-4 h-4" />, readOnly: true }
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ activeRole, onSelectRole }) => (
  <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
    <div className="flex gap-2 min-w-min pb-1">
      {ROLES.map((role) => {
        const isActive = activeRole === role.id;
        return (
          <button
            key={role.id}
            onClick={() => onSelectRole(role.id)}
            className={cx(
              'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors shrink-0',
              isActive
                ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-slate-800'
            )}
          >
            <span className={isActive ? 'text-white' : 'text-orange-500'}>{role.icon}</span>
            <span className="leading-tight">
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-bold whitespace-nowrap">{role.label}</span>
                {role.readOnly && (
                  <Eye
                    className={cx('w-3 h-3', isActive ? 'text-white' : 'text-amber-500')}
                    aria-label="Read-only"
                  />
                )}
              </span>
              <span
                className={cx(
                  'text-[10px] whitespace-nowrap',
                  isActive ? 'text-orange-50' : 'text-slate-400'
                )}
              >
                {role.sub}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
