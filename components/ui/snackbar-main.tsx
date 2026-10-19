'use client';

import { useSnackbar } from '@/lib/useSnackbar';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const CONFIG = {
  success: {
    icon: CheckCircle2,
    className: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
    iconClass: 'text-green-500',
  },
  error: {
    icon: XCircle,
    className: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    iconClass: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    iconClass: 'text-yellow-500',
  },
  info: {
    icon: Info,
    className: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    iconClass: 'text-blue-500',
  },
};

export function Snackbar() {
  const { message, type, hide } = useSnackbar();

  if (!message) return null;

  const { icon: Icon, className, iconClass } = CONFIG[type];

  return (
    <div className="fixed top-4 left-4 z-50 animate-in fade-in slide-in-from-left-2 duration-200">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm text-sm font-medium ${className}`}>
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
        <span>{message}</span>
        <button onClick={hide} className="ml-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}