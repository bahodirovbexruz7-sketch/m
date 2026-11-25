import React, { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle2,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  MissingDemandItem,
  OrderRecord,
  OrderStatus,
  SyncStatus,
  TruckPart,
} from '../types';
import {
  calculateFleetB2BSavings,
  classifyCategory,
  formatUZS,
  parsePriceUZS,
} from '../utils/catalogLogic';
import { GoogleSignInButton } from './GoogleSignInButton';

interface OperatorPanelProps {
  parts: TruckPart[];
  orders: OrderRecord[];
  missingDemand: MissingDemandItem[];
  sheetsApiUrl: string;
  onSheetsApiUrlChange: (url: string) => void;
  spreadsheetId: string;
  onSpreadsheetIdChange: (id: string) => void;
  syncStatus: SyncStatus;
  isSyncing: boolean;
  googleUser: User | null;
  hasGoogleToken: boolean;
  isGoogleLoggingIn: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onTestAppsScript: () => void;
  onSyncGoogleSheet: () => void;
  onCreateGoogleSheet: () => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onAddPart: (part: TruckPart) => Promise<void>;
}

export const OperatorPanel: React.FC<OperatorPanelProps> = ({
  parts,
  orders,
  missingDemand,
  sheetsApiUrl,
  onSheetsApiUrlChange,
  spreadsheetId,
  onSpreadsheetIdChange,
  syncStatus,
  isSyncing,
  googleUser,
  hasGoogleToken,
  isGoogleLoggingIn,
  onGoogleSignIn,
  onGoogleSignOut,
  onTestAppsScript,
  onSyncGoogleSheet,
  onCreateGoogleSheet,
  onUpdateOrderStatus,
  onAddPart,
}) => {
  const [orderFilter, setOrderFilter] = useState<'all' | OrderStatus | 'sos'>('all');

  // Quick Add Part state
  const [artikul, setArtikul] = useState('');
  const [nomi, setNomi] = useState('');
  const [jargon, setJargon] = useState('');
  const [model, setModel] = useState('');
  const [narxInput, setNarxInput] = useState('');
  const [holati, setHolati] = useState('Buxoro omborida bor');
  const [rasm, setRasm] = useState('');
  const [partFormError, setPartFormError] = useState<string | null>(null);
  const [partFormSuccess, setPartFormSuccess] = useState<string | null>(null);
  const [addingPart, setAddingPart] = useState(false);

  // B2B Fleet Calculator state
  const [truckCount, setTruckCount] = useState(8);
  const [monthlySpendPerTruck, setMonthlySpendPerTruck] = useState(3500000);
  const [includeDidoxVat, setIncludeDidoxVat] = useState(true);

  const kpis = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalUZS, 0);
    const totalCashback = orders.reduce((sum, o) => sum + o.cashbackUZS, 0);
    const sosCount = orders.filter((o) => o.deliveryMethod === 'sos' || o.type === 'sos').length;
    return {
      orderCount: orders.length,
      totalRevenue,
      totalCashback,
      sosCount,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    if (orderFilter === 'sos') {
      return orders.filter((o) => o.deliveryMethod === 'sos' || o.type === 'sos');
    }
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const fleetCalc = useMemo(
    () => calculateFleetB2BSavings(truckCount, monthlySpendPerTruck, includeDidoxVat),
    [truckCount, monthlySpendPerTruck, includeDidoxVat]
  );

  const handleAddPartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartFormSuccess(null);

    const parsedPrice = parsePriceUZS(narxInput);
    if (!artikul.trim() || !nomi.trim() || parsedPrice <= 0) {
      setPartFormError('Artikul, detal nomi va narxini (0 dan katta) kiriting.');
      return;
    }

    setPartFormError(null);
    setAddingPart(true);
    try {
      const category = classifyCategory(artikul, nomi, jargon);
      const newPart: TruckPart = {
        id: artikul.trim(),
        artikul: artikul.trim().toUpperCase(),
        nomi: nomi.trim(),
        jargon: jargon.trim() || nomi.trim().toLowerCase(),
        model: model.trim() || 'Howo, Shacman, Volvo',
        narx: parsedPrice,
        narxFormatted: formatUZS(parsedPrice),
        holati,
        rasm: rasm.trim(),
        category,
        tradeInEligible: category === 'Tormoz va Pnevmo',
      };
      await onAddPart(newPart);
      setArtikul('');
      setNomi('');
      setJargon('');
      setModel('');
      setNarxInput('');
      setRasm('');
      setPartFormSuccess(`"${newPart.nomi}" (${newPart.artikul}) katalogga qoʻshildi.`);
    } finally {
      setAddingPart(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Sotuvchi-Operator va Importchi Paneli
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Buxoro M-37 ombori, jonli Google Sheets sinxronizatsiyasi, buyurtmalar navbati va B2B avtopark hisob-kitobi.
          </p>
        </div>
        <div
          data-testid="sheets-sync-status"
          className={`inline-flex items-center gap-2 self-start rounded-xl border px-3.5 py-2 text-xs font-bold sm:self-auto ${
            syncStatus.connected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <CheckCircle2
            className={`h-4 w-4 shrink-0 ${
              syncStatus.connected ? 'text-emerald-600' : 'text-amber-600'
            }`}
          />
          <span>
            {syncStatus.connected ? 'Live Ulangan' : 'Buxoro Zaxira Baza (15 detal)'}
          </span>
        </div>
      </div>

      {/* 1. Live Google Sheets API Connection Bar (Workspace OAuth + Apps Script URL) */}
      <section
        aria-labelledby="sheets-connection-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="sheets-connection-heading"
                className="font-display text-base font-bold text-slate-900"
              >
                Jonli Ikki Tomonlama Google Sheets Sinxronizatsiyasi
              </h2>
              <p className="text-xs text-slate-500">{syncStatus.message}</p>
            </div>
          </div>
          {syncStatus.lastSyncedAt && (
            <span className="font-mono text-xs text-slate-500">
              Oxirgi yangilanish: {syncStatus.lastSyncedAt}
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 1-usul: Apps Script Web App URL (Kirish talab qilinmaydi) */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Link2 className="h-4 w-4 text-slate-500" />
              <span>1-usul: Google Apps Script Web App URL (Login talab qilmaydi)</span>
            </div>
            <div>
              <label
                htmlFor="apps-script-url-input"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Apps Script havolasi (SHEETS_API_URL)
              </label>
              <input
                id="apps-script-url-input"
                type="url"
                value={sheetsApiUrl}
                onChange={(e) => onSheetsApiUrlChange(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onTestAppsScript}
                disabled={isSyncing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>Ulanishni tekshirish</span>
              </button>
              <span className="text-xs text-slate-500">
                Katalogda jami: <strong className="font-mono text-slate-900">{parts.length}</strong> detal
              </span>
            </div>
          </div>

          {/* 2-usul: Optional Direct Google Sheets API (Google Workspace OAuth) */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                2-usul (ixtiyoriy): Google Sheets toʻgʻridan-toʻgʻri ulash
              </span>
              {googleUser && hasGoogleToken && (
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-red-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Chiqish</span>
                </button>
              )}
            </div>

            {!hasGoogleToken ? (
              <div className="space-y-2.5">
                <p className="text-xs leading-relaxed text-slate-600">
                  Faqat operator xohishiga koʻra: Google hisob orqali &ldquo;Baza&rdquo; va &ldquo;Buyurtmalar&rdquo; jadvallarini toʻgʻridan-toʻgʻri ulash (mijozlardan kirish soʻralmaydi).
                </p>
                <GoogleSignInButton
                  onClick={onGoogleSignIn}
                  disabled={isGoogleLoggingIn}
                  label={isGoogleLoggingIn ? 'Ulanmoqda...' : 'Sign in with Google'}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-medium text-emerald-800">
                  Ulangan hisob: <span className="font-bold">{googleUser?.email}</span>
                </div>
                <div>
                  <label
                    htmlFor="spreadsheet-id-input"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Google Sheets havolasi yoki Jadval ID
                  </label>
                  <input
                    id="spreadsheet-id-input"
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => onSpreadsheetIdChange(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSyncGoogleSheet}
                    disabled={isSyncing || !spreadsheetId.trim()}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span>Jadvaldan yuklash</span>
                  </button>
                  <button
                    type="button"
                    onClick={onCreateGoogleSheet}
                    disabled={isSyncing}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Yangi Buxoro Google Sheet yaratish</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. KPI Cards */}
      <section aria-label="Asosiy ko'rsatkichlar" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Bugungi buyurtmalar</span>
            <Database className="h-4 w-4 text-slate-400" />
          </div>
          <div
            data-testid="kpi-orders-count"
            className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums"
          >
            {kpis.orderCount} ta
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Kunlik tushum</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums sm:text-2xl">
            {formatUZS(kpis.totalRevenue)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Ustalarga keshbek (5%)</span>
            <Wallet className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-emerald-700 tabular-nums sm:text-2xl">
            {formatUZS(kpis.totalCashback)}
          </div>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-red-800">
            <span>Trassa SOS soʻrovlari</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {kpis.sosCount} ta
          </div>
        </div>
      </section>

      {/* 3. Live Order Queue */}
      <section
        aria-labelledby="order-queue-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 id="order-queue-heading" className="font-display text-lg font-bold text-slate-900">
              Jonli Buyurtmalar Navbati
            </h2>
            <p className="text-xs text-slate-500">
              Holatni 1 bosishda yangilang · Trassa SOS buyurtmalarida GPS xarita havolasi mavjud
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Buyurtmalarni saralash">
            {(
              [
                { id: 'all', label: 'Barchasi' },
                { id: 'Yangi', label: 'Yangi' },
                { id: 'Importchidan olinmoqda', label: 'Importchidan' },
                { id: 'Yetkazildi', label: 'Yetkazildi' },
                { id: 'sos', label: 'Trassa SOS' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOrderFilter(tab.id)}
                className={`min-h-[40px] rounded-xl px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  orderFilter === tab.id
                    ? tab.id === 'sos'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
              Tanlangan filtr boʻyicha buyurtmalar topilmadi.
            </div>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">ID / Vaqt</th>
                  <th className="py-3 pr-4">Mijoz / Mashina</th>
                  <th className="py-3 pr-4">Detallar va Manzil</th>
                  <th className="py-3 pr-4 text-right">Summa</th>
                  <th className="py-3">Holatni boshqarish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="align-top hover:bg-slate-50/70">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {order.id}
                        </span>
                        {order.deliveryMethod === 'sos' && (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            SOS
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{order.createdAt}</div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-900">{order.customerName}</div>
                      <div className="font-mono text-xs text-slate-600">{order.customerPhone}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {order.truckModel} ·{' '}
                        {order.buyerRole === 'mechanic' ? 'Usta (+5%)' : 'Haydovchi'}
                      </div>
                    </td>
                    <td className="max-w-xs py-3.5 pr-4">
                      <div className="text-xs font-medium text-slate-800">
                        {order.itemsSummary}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{order.deliveryAddress}</div>
                      {order.gps && (
                        <a
                          href={order.gps.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs font-bold text-red-700 underline hover:text-red-800"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>
                            GPS Xarita ({order.gps.lat}, {order.gps.lng})
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatUZS(order.totalUZS)}
                      </div>
                      {order.cashbackUZS > 0 && (
                        <div className="font-mono text-[11px] font-semibold text-emerald-700 tabular-nums">
                          +{formatUZS(order.cashbackUZS)} keshbek
                        </div>
                      )}
                    </td>
                    <td className="py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          ['Yangi', 'Importchidan olinmoqda', 'Yetkazildi'] as OrderStatus[]
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => onUpdateOrderStatus(order.id, st)}
                            className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                              order.status === st
                                ? st === 'Yetkazildi'
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : st === 'Importchidan olinmoqda'
                                    ? 'border-amber-500 bg-amber-500 text-slate-950'
                                    : 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 4 & 5. Importer Demand Analytics + Quick Add Part Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Importer Demand Analytics */}
        <section
          aria-labelledby="importer-demand-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="importer-demand-heading"
                className="font-display text-base font-bold text-slate-900"
              >
                Importchilar uchun talab statistikasi
              </h2>
              <p className="text-xs text-slate-500">
                Omborda topilmagan (0 natija) qidiruvlar — keyingi partiyaga olib kelish uchun
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100" data-testid="missing-demand-list">
            {missingDemand.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{item.query}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Manba:{' '}
                    {item.source === 'ai_scan'
                      ? 'AI Foto Skaner'
                      : item.source === 'voice'
                        ? 'Ovozli qidiruv'
                        : 'Matn qidiruvi'}{' '}
                    · {item.lastSearchedAt}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold text-amber-700 tabular-nums">
                    {item.count} soʻrov
                  </div>
                  {item.requestedByCustomer && (
                    <div className="text-[11px] font-semibold text-emerald-700">
                      Mijoz kutmoqda
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Add Part Form */}
        <section
          aria-labelledby="add-part-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 id="add-part-heading" className="font-display text-base font-bold text-slate-900">
                Tezkor Yangi Detal Qoʻshish (&ldquo;Baza&rdquo;)
              </h2>
              <p className="text-xs text-slate-500">
                Katalogga darhol qoʻshiladi va Google Sheets &ldquo;Baza&rdquo; varagʻiga yuboriladi
              </p>
            </div>
          </div>

          <form onSubmit={handleAddPartSubmit} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="add-part-artikul"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Artikul / OEM kodi *
                </label>
                <input
                  id="add-part-artikul"
                  type="text"
                  value={artikul}
                  onChange={(e) => setArtikul(e.target.value)}
                  placeholder="Masalan: WG9725520999"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-3 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="add-part-price"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Narxi (soʻm) *
                </label>
                <input
                  id="add-part-price"
                  type="text"
                  inputMode="numeric"
                  value={narxInput}
                  onChange={(e) => setNarxInput(e.target.value)}
                  placeholder="Masalan: 620000"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-3 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="add-part-name"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Rasmiy nomi *
              </label>
              <input
                id="add-part-name"
                type="text"
                value={nomi}
                onChange={(e) => setNomi(e.target.value)}
                placeholder="Masalan: Turbina HX40W (Weichai WP12)"
                className="min-h-[46px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="add-part-jargon"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Usta jargoni
                </label>
                <input
                  id="add-part-jargon"
                  type="text"
                  value={jargon}
                  onChange={(e) => setJargon(e.target.value)}
                  placeholder="turbina, nadduv, holset"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="add-part-model"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Mashina modeli
                </label>
                <input
                  id="add-part-model"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Howo A7, Shacman X3000"
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="add-part-status"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Ombor holati
                </label>
                <select
                  id="add-part-status"
                  value={holati}
                  onChange={(e) => setHolati(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="Buxoro omborida bor">Buxoro omborida bor</option>
                  <option value="Toshkentdan 12 soatda">Toshkentdan 12 soatda</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="add-part-img"
                  className="mb-1 block text-xs font-semibold text-slate-700"
                >
                  Rasm havolasi (ixtiyoriy)
                </label>
                <input
                  id="add-part-img"
                  type="url"
                  value={rasm}
                  onChange={(e) => setRasm(e.target.value)}
                  placeholder="https://..."
                  className="min-h-[46px] w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {partFormError && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {partFormError}
              </p>
            )}
            {partFormSuccess && (
              <p className="text-xs font-semibold text-emerald-700">{partFormSuccess}</p>
            )}

            <button
              type="submit"
              disabled={addingPart}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              <span>{addingPart ? 'Saqlanmoqda...' : 'Katalogga va Google Sheetsga qoʻshish'}</span>
            </button>
          </form>
        </section>
      </div>

      {/* 6. B2B Avtopark Deposit Calculator */}
      <section
        aria-labelledby="b2b-calculator-heading"
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-amber-400">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="b2b-calculator-heading"
                className="font-display text-lg font-bold text-slate-900"
              >
                B2B Avtopark Depozit Kalkulyatori (Buxoro / Navoiy Logistika)
              </h2>
              <p className="text-xs text-slate-500">
                Korporativ shartnoma orqali 15% ulgurji chegirma va Didox EHF (QQS 12%) hisob-faktura
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span>Perechisleniye · Didox EHF</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="fleet-trucks-range">Avtoparkdagi furalar soni</label>
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {truckCount} ta fura
                </span>
              </div>
              <input
                id="fleet-trucks-range"
                type="range"
                min={2}
                max={60}
                value={truckCount}
                onChange={(e) => setTruckCount(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-amber-500"
              />
            </div>

            <div>
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-700">
                <label htmlFor="fleet-spend-range">1 furaning oylik zapchast xarajati</label>
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {formatUZS(monthlySpendPerTruck)}
                </span>
              </div>
              <input
                id="fleet-spend-range"
                type="range"
                min={1000000}
                max={12000000}
                step={250000}
                value={monthlySpendPerTruck}
                onChange={(e) => setMonthlySpendPerTruck(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-amber-500"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <input
                type="checkbox"
                checked={includeDidoxVat}
                onChange={(e) => setIncludeDidoxVat(e.target.checked)}
                className="h-5 w-5 accent-slate-900"
              />
              <span className="text-xs font-semibold text-slate-800">
                Didox orqali 12% QQS (NDS) hisob-faktura bilan rasmiylashtirish
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-7">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="text-xs font-semibold text-emerald-900">
                15% B2B Oylik tejash
              </div>
              <div
                data-testid="b2b-monthly-savings"
                className="mt-1.5 font-mono text-xl font-bold text-emerald-700 tabular-nums"
              >
                {formatUZS(fleetCalc.monthlySavings)}
              </div>
              <div className="mt-1 font-mono text-xs text-emerald-800 tabular-nums">
                Yillik: {formatUZS(fleetCalc.annualSavings)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-600">
                Oylik chegirmali toʻlov
              </div>
              <div className="mt-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {formatUZS(fleetCalc.monthlyNetSpend)}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                Tavsiya depozit: {formatUZS(fleetCalc.recommendedDeposit)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
              <div className="text-xs font-semibold text-slate-300">
                {includeDidoxVat ? 'Didox EHF (12% QQS bilan)' : 'QQS hisobga olinmagan'}
              </div>
              <div className="mt-1.5 font-mono text-xl font-bold text-amber-400 tabular-nums">
                {formatUZS(fleetCalc.netWithVat)}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-300 tabular-nums">
                {includeDidoxVat ? `QQS (12%): ${formatUZS(fleetCalc.vatAmount)}` : 'Naqd / Terminal'}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
