import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Gift,
  Send,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { CashbackWithdrawal } from '../types';
import { formatUZS } from '../utils/catalogLogic';

interface ReferralModalProps {
  open: boolean;
  referralCode: string;
  invitedCount: number;
  onSimulateInvite: () => void;
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  open,
  referralCode,
  invitedCount,
  onSimulateInvite,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const earnedBonus = invitedCount * 50000;
  const shareText = `Birinchi 500 000 so'mlik xaridda senga ham, menga ham 50 000 so'm bonus! TruckParts AI Uz — Buxoro (M-37) zapchast ilovasida mening kodimni kirit: ${referralCode}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    'https://truckparts-buxoro.uz'
  )}&text=${encodeURIComponent(shareText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
    } catch {
      // Clipboard fallback ignored cleanly
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <h2 id="referral-modal-title" className="font-display text-lg font-bold">
                Fura Doʻstlar — 50 000 soʻm
              </h2>
              <p className="text-xs text-slate-300">TBC uslubidagi referal dasturi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Referal oynasini yopish"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <p className="text-sm leading-relaxed text-slate-700">
            Birinchi 500 000 soʻmlik xaridda senga ham, menga ham{' '}
            <strong className="font-mono text-slate-900">50 000 soʻm</strong> bonus! Kodingizni hamkasb haydovchi yoki ustalarga yuboring.
          </p>

          {/* Referral Code Box */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <div className="text-xs font-medium text-slate-500">Sizning shaxsiy kodingiz</div>
              <div
                data-testid="referral-code-value"
                className="mt-0.5 font-mono text-2xl font-bold tracking-wider text-slate-900"
              >
                {referralCode}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Nusxalandi' : 'Nusxalash'}</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Users className="h-4 w-4 text-slate-400" />
                <span>Taklif qilinganlar</span>
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {invitedCount} nafar
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
              <div className="text-xs text-emerald-800">Yigʻilgan bonus</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-700 tabular-nums">
                {formatUZS(earnedBonus)}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <a
              href={telegramShareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              <Send className="h-4 w-4" />
              <span>Telegramdan doʻstga ulashish</span>
            </a>
            <button
              type="button"
              onClick={onSimulateInvite}
              className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              +1 yangi doʻst xaridini sinovdan oʻtkazish (+50 000 soʻm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WalletModalProps {
  open: boolean;
  balanceUZS: number;
  withdrawals: CashbackWithdrawal[];
  onRequestWithdraw: (params: {
    cardNumber: string;
    provider: 'Click' | 'Payme';
    amountUZS: number;
  }) => void;
  onClose: () => void;
}

export const MechanicWalletModal: React.FC<WalletModalProps> = ({
  open,
  balanceUZS,
  withdrawals,
  onRequestWithdraw,
  onClose,
}) => {
  const [provider, setProvider] = useState<'Click' | 'Payme'>('Click');
  const [cardNumber, setCardNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    const digits = cardNumber.replace(/\D/g, '');
    if (balanceUZS < 50000) {
      setError('Yechish uchun kamida 50 000 soʻm keshbek yigʻilishi kerak.');
      return;
    }
    if (digits.length !== 16) {
      setError('16 xonali Uzcard yoki Humo karta raqamini toʻliq kiriting.');
      return;
    }
    setError(null);
    onRequestWithdraw({
      cardNumber: digits.replace(/(\d{4})(?=\d)/g, '$1 '),
      provider,
      amountUZS: balanceUZS,
    });
    setCardNumber('');
    setSuccessMsg(
      `${formatUZS(balanceUZS)} ${provider} kartangizga oʻtkazish uchun operatorga yuborildi.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 id="wallet-modal-title" className="font-display text-lg font-bold">
                Mening Keshbekim (Usta Hamyoni)
              </h2>
              <p className="text-xs text-slate-300">Har bir xarid uchun 5% Usta bonusi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Hamyon oynasini yopish"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <div className="text-xs font-medium text-slate-400">Mavjud keshbek balansi</div>
            <div
              data-testid="wallet-balance"
              className="mt-1 font-mono text-3xl font-bold text-amber-400 tabular-nums"
            >
              {formatUZS(balanceUZS)}
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Savatchada &ldquo;Usta / Avtoservis (+5%)&rdquo; rejimida buyurtma bering — bonus avtomatik qoʻshiladi.
            </p>
          </div>

          <form onSubmit={handleWithdraw} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              {(['Click', 'Payme'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setProvider(item)}
                  aria-pressed={provider === item}
                  className={`min-h-[48px] rounded-xl border text-sm font-bold transition-colors ${
                    provider === item
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div>
              <label
                htmlFor="wallet-card-input"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Uzcard / Humo karta raqami
              </label>
              <input
                id="wallet-card-input"
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="8600 0000 0000 0000"
                className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {error}
              </p>
            )}
            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              <CreditCard className="h-4 w-4" />
              <span>Click / Payme kartaga yechish</span>
            </button>
          </form>

          {withdrawals.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2 text-xs font-bold text-slate-700">Soʻnggi yechish soʻrovlari</div>
              <div className="space-y-2">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {w.provider} · {w.cardNumber.slice(-9)}
                      </div>
                      <div className="text-slate-500">{w.requestedAt}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatUZS(w.amountUZS)}
                      </div>
                      <div className="font-semibold text-amber-700">{w.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
