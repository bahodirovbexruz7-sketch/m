import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Package,
  Send,
  ShoppingCart,
  Upload,
  X,
} from 'lucide-react';
import { AiScanResult, QualityTier, TruckPart } from '../types';
import { formatUZS } from '../utils/catalogLogic';

interface AiScannerModalProps {
  open: boolean;
  parts: TruckPart[];
  onClose: () => void;
  onAddToCart: (part: TruckPart, tier: QualityTier) => void;
  onRequestTashkentImport: (params: {
    partName: string;
    oemCode: string;
    truckModel: string;
    customerName: string;
    customerPhone: string;
    diagnosis: string;
  }) => void;
  onLogMissingDemand: (query: string, source: 'ai_scan') => void;
}

export const AiScannerModal: React.FC<AiScannerModalProps> = ({
  open,
  parts,
  onClose,
  onAddToCart,
  onRequestTashkentImport,
  onLogMissingDemand,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiScanResult | null>(null);
  const [importPhone, setImportPhone] = useState('');
  const [importName, setImportName] = useState('');
  const [importSubmitted, setImportSubmitted] = useState(false);
  const [importFormError, setImportFormError] = useState<string | null>(null);

  if (!open) return null;

  const matchedParts = result
    ? parts.filter((p) =>
        result.matchedArtikuls.some(
          (code) => code.trim().toLowerCase() === p.artikul.trim().toLowerCase()
        )
      )
    : [];

  const handleFileSelected = async (file: File) => {
    setError(null);
    setResult(null);
    setImportSubmitted(false);

    if (!file.type.startsWith('image/')) {
      setError('Faqat rasm fayllarini (JPG, PNG, WEBP) yuklang.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setPreviewUrl(dataUrl);
      setLoading(true);
      try {
        const res = await fetch('/api/analyze-part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            mimeType: file.type || 'image/jpeg',
            catalogSummary: parts.map((p) => ({
              artikul: p.artikul,
              nomi: p.nomi,
              jargon: p.jargon,
              model: p.model,
              holati: p.holati,
            })),
          }),
        });

        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload?.error || 'AI skaner serverida xatolik yuz berdi.');
        }

        const aiResult: AiScanResult = payload.result;
        setResult(aiResult);

        const foundInStock = parts.some((p) =>
          aiResult.matchedArtikuls.some(
            (code) => code.trim().toLowerCase() === p.artikul.trim().toLowerCase()
          )
        );
        if (!foundInStock && aiResult.partNameUz) {
          onLogMissingDemand(
            `${aiResult.partNameUz}${aiResult.oemCode ? ` (${aiResult.oemCode})` : ''}`,
            'ai_scan'
          );
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Rasmni tahlil qilishda xatolik yuz berdi.'
        );
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTashkentOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) return;
    if (!importName.trim() || !importPhone.trim()) {
      setImportFormError('Ismingiz va telefon raqamingizni kiriting.');
      return;
    }
    setImportFormError(null);
    onRequestTashkentImport({
      partName: result.partNameUz,
      oemCode: result.oemCode || result.vinCode || 'AI-FOTO',
      truckModel: result.truckBrands || 'Fura',
      customerName: importName.trim(),
      customerPhone: importPhone.trim(),
      diagnosis: result.diagnosisUz,
    });
    setImportSubmitted(true);
  };

  const resetScanner = () => {
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setImportSubmitted(false);
    setImportFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-scanner-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 id="ai-scanner-title" className="font-display text-lg font-bold">
                AI Detal va VIN Kod Skaneri
              </h2>
              <p className="text-xs text-slate-300">
                Singan detal yoki tex-pasport rasmini yuklang — Gemini 2.5 Flash aniqlaydi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="AI skanerni yopish"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-label="Detal yoki VIN rasmini tanlash"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
            }}
          />

          {!previewUrl ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-amber-400">
                <Camera className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-slate-900">
                Detal yoki tex-pasport VIN kodini rasmga oling
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
                AI detal nomi, OEM raqami, mos fura markasi va usta jargonini (porosyonok, grusha, uskortelniy, nakladka) aniqlab Buxoro omboridan topib beradi.
              </p>

              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
                  <Camera className="h-5 w-5" />
                  <span>Kamera / Rasm tanlash</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <Upload className="h-4 w-4" />
                  <span>Galereyadan yuklash</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                <img
                  src={previewUrl}
                  alt="Yuklangan detal rasmi"
                  className="h-36 w-full rounded-xl bg-white object-contain sm:w-44"
                />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-slate-500">
                    Yuklangan tasvir
                  </div>
                  {loading ? (
                    <div className="mt-2 flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                      <span>Gemini Vision AI detal va OEM kodni tekshirmoqda...</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">
                      Boshqa detal yoki VIN kodni tekshirish uchun yangi rasm yuklang.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={resetScanner}
                    disabled={loading}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Boshqa rasm yuklash</span>
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <div className="font-bold">AI tahlil xatosi</div>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  {/* Diagnosis Summary */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {result.isVinCode ? 'Tex-pasport VIN tahlili' : 'Detal AI diagnostikasi'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aniqlik: {result.confidence}%
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-bold text-slate-900">
                      {result.partNameUz}
                    </h3>

                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-2">
                      <div>
                        <span className="text-slate-500">OEM / Artikul:</span>{' '}
                        <span className="font-mono font-bold text-slate-900">
                          {result.oemCode || result.vinCode || 'Aniqlanmadi'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Mos furalar:</span>{' '}
                        <span className="font-semibold text-slate-900">
                          {result.truckBrands || 'Universal yuk mashina'}
                        </span>
                      </div>
                    </div>

                    {result.matchedSlang.length > 0 && (
                      <div className="mt-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">Usta jargoni:</span>{' '}
                        {result.matchedSlang.join(' · ')}
                      </div>
                    )}

                    <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-700">
                      {result.diagnosisUz}
                    </p>
                  </div>

                  {/* Matched Catalog Items OR Toshkent 12-Hour Import Card */}
                  {matchedParts.length > 0 ? (
                    <div className="space-y-2.5">
                      <h4 className="font-display text-sm font-bold text-slate-900">
                        Buxoro katalogidan topilgan mos detallar ({matchedParts.length})
                      </h4>
                      {matchedParts.map((part) => (
                        <div
                          key={part.artikul}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 sm:flex-row sm:items-center"
                        >
                          <div>
                            <div className="font-mono text-xs font-semibold text-emerald-800">
                              {part.artikul} · {part.holati}
                            </div>
                            <div className="mt-0.5 font-display text-sm font-bold text-slate-900">
                              {part.nomi}
                            </div>
                            <div className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                              {formatUZS(part.narx)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onAddToCart(part, 'oem');
                              onClose();
                            }}
                            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400"
                          >
                            <ShoppingCart className="h-4 w-4" />
                            <span>Savatchaga qoʻshish</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-display text-base font-bold text-slate-900">
                            Toshkent Importchi Omboridan 12 soatda keltiramiz!
                          </h4>
                          <p className="mt-1 text-sm text-slate-700">
                            Ushbu detal hozir Buxoro omborimizda yoʻq, lekin Toshkent hamkor importchilarimizdan tungi reys orqali 12 soatda yetkazib beramiz.
                          </p>
                        </div>
                      </div>

                      {importSubmitted ? (
                        <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-emerald-600 p-3.5 text-sm font-semibold text-white">
                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                          <span>
                            Soʻrov operatorga yuborildi! 10 daqiqa ichida narx va yetkazish vaqti bilan aloqaga chiqamiz.
                          </span>
                        </div>
                      ) : (
                        <form onSubmit={handleTashkentOrderSubmit} className="mt-4 space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="ai-import-name"
                                className="mb-1 block text-xs font-semibold text-slate-700"
                              >
                                Ismingiz
                              </label>
                              <input
                                id="ai-import-name"
                                type="text"
                                value={importName}
                                onChange={(e) => setImportName(e.target.value)}
                                placeholder="Masalan: Akmal haydovchi"
                                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="ai-import-phone"
                                className="mb-1 block text-xs font-semibold text-slate-700"
                              >
                                Telefon raqamingiz
                              </label>
                              <input
                                id="ai-import-phone"
                                type="tel"
                                value={importPhone}
                                onChange={(e) => setImportPhone(e.target.value)}
                                placeholder="+998 90 123 45 67"
                                className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              />
                            </div>
                          </div>
                          {importFormError && (
                            <p className="text-xs font-semibold text-red-700">{importFormError}</p>
                          )}
                          <button
                            type="submit"
                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                          >
                            <Send className="h-4 w-4" />
                            <span>Operatorga 12 soatlik buyurtma yuborish</span>
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
