import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

export interface PendingSheetMutation {
  title: string;
  description: string;
  details: string[];
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

interface ConfirmSheetMutationModalProps {
  mutation: PendingSheetMutation | null;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmSheetMutationModal: React.FC<ConfirmSheetMutationModalProps> = ({
  mutation,
  isProcessing,
  onCancel,
  onConfirm,
}) => {
  if (!mutation) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-confirm-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2
              id="sheet-confirm-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              {mutation.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            aria-label="Yopish"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">{mutation.description}</p>

        {mutation.details.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            {mutation.details.map((line, i) => (
              <li key={i} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            <span>{isProcessing ? 'Yozilmoqda...' : mutation.confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
