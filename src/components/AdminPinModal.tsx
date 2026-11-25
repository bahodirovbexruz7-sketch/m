import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Lock, X } from 'lucide-react';
import { verifyAdminPin } from '../utils/catalogLogic';

interface AdminPinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setError(null);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Iltimos, 4 xonali PIN kodni kiriting.');
      return;
    }
    if (!verifyAdminPin(pin)) {
      setError('Notoʻgʻri PIN kod. Qayta urinib koʻring.');
      setPin('');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setPin('');
    onSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-pin-title"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 id="admin-pin-title" className="font-display text-base font-bold">
                Operator Paneli kirishi
              </h2>
              <p className="text-xs text-slate-300">Maxfiy PIN kodni kiriting</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="PIN oynasini yopish"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label
              htmlFor="admin-pin-input"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Operator PIN kodi
            </label>
            <div className="relative">
              <KeyRound
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={inputRef}
                id="admin-pin-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••"
                className="min-h-[50px] w-full rounded-xl border border-slate-300 pr-4 pl-10 font-mono text-lg tracking-[0.3em] text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              data-testid="admin-pin-error"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="min-h-[48px] flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              Kirish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
