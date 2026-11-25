import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Gift,
  Loader2,
  Mic,
  MicOff,
  Package,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Wallet,
  X,
} from 'lucide-react';
import {
  BuyerRole,
  CartItem,
  CashbackWithdrawal,
  MissingDemandItem,
  OrderRecord,
  OrderStatus,
  PartCategory,
  QualityTier,
  SyncStatus,
  TruckPart,
} from './types';
import {
  BUKHARA_SEED_PARTS,
  DEFAULT_SHEETS_API_URL,
  INITIAL_MISSING_DEMAND,
  INITIAL_ORDERS,
  OPERATOR_PHONE,
  OPERATOR_PHONE_DISPLAY,
  SLANG_CHIPS,
} from './data/bukharaSeed';
import {
  calculateCartTotals,
  filterParts,
  formatUZS,
  hasAdminQueryAccess,
  recordLogoTap,
} from './utils/catalogLogic';
import {
  getAccessToken,
  googleSignIn,
  logout,
} from './services/googleAuth';
import {
  appendOrderToGoogleSheetsApi,
  appendPartToGoogleSheetsApi,
  createBukharaSpreadsheet,
  extractSpreadsheetId,
  fetchFromAppsScript,
  fetchFromGoogleSheetsApi,
  isPlaceholderAppsScriptUrl,
  postToAppsScript,
} from './services/sheetsSync';
import { ProductCard } from './components/ProductCard';
import { AiScannerModal } from './components/AiScannerModal';
import { CartDrawer } from './components/CartDrawer';
import { MechanicWalletModal, ReferralModal } from './components/GrowthModals';
import { OperatorPanel } from './components/OperatorPanel';
import { AdminPinModal } from './components/AdminPinModal';
import {
  ConfirmSheetMutationModal,
  PendingSheetMutation,
} from './components/ConfirmSheetMutationModal';

const CATEGORIES: PartCategory[] = [
  'Barchasi',
  'Balonlar',
  'LED Svetodiod',
  'Filtrlar',
  'Tormoz va Pnevmo',
  'Podshipnik',
];

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export default function App() {
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() =>
    typeof window !== 'undefined' && hasAdminQueryAccess(window.location.search)
  );
  const [activeView, setActiveView] = useState<'customer' | 'operator'>(() =>
    typeof window !== 'undefined' && hasAdminQueryAccess(window.location.search)
      ? 'operator'
      : 'customer'
  );
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const logoTapTimestampsRef = useRef<number[]>([]);

  // Catalog & Orders state
  const [parts, setParts] = useState<TruckPart[]>(BUKHARA_SEED_PARTS);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [missingDemand, setMissingDemand] = useState<MissingDemandItem[]>(INITIAL_MISSING_DEMAND);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PartCategory>('Barchasi');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastLoggedZeroQueryRef = useRef<string>('');

  // Zero-result Toshkent import request inline form
  const [missingReqName, setMissingReqName] = useState('');
  const [missingReqPhone, setMissingReqPhone] = useState('');
  const [missingReqSent, setMissingReqSent] = useState(false);
  const [missingReqError, setMissingReqError] = useState<string | null>(null);

  // Cart & Role state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyerRole, setBuyerRole] = useState<BuyerRole>('driver');
  const [cartOpen, setCartOpen] = useState(false);

  // Modals state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  // Growth Engine: Referral + Mechanic Cashback Wallet
  const [referralCode] = useState('BUX-8421');
  const [invitedCount, setInvitedCount] = useState(3);
  const [walletBalanceUZS, setWalletBalanceUZS] = useState(215000);
  const [withdrawals, setWithdrawals] = useState<CashbackWithdrawal[]>([
    {
      id: 'WDR-101',
      cardNumber: '8600 12** **** 4821',
      provider: 'Click',
      amountUZS: 180000,
      requestedAt: 'Kecha, 15:40',
      status: 'Oʻtkazildi',
    },
  ]);

  // Google Sheets Sync & OAuth state
  const [sheetsApiUrl, setSheetsApiUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('truckparts_sheets_api_url') || DEFAULT_SHEETS_API_URL;
    } catch {
      return DEFAULT_SHEETS_API_URL;
    }
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    try {
      return localStorage.getItem('truckparts_spreadsheet_id') || '';
    } catch {
      return '';
    }
  });
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    mode: 'fallback',
    connected: false,
    lastSyncedAt: null,
    message:
      'Buxoro Zapchast Baza (15 detal) yuklandi. Jonli sinxronizatsiya uchun Apps Script havolasini kiriting yoki ixtiyoriy Google Sheets ulang.',
  });

  // Mandatory confirmation dialog for mutating user's Google Sheets via Workspace API
  const [pendingMutation, setPendingMutation] = useState<PendingSheetMutation | null>(null);
  const [isMutatingSheet, setIsMutatingSheet] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Persist URL & Spreadsheet ID (never OAuth token!)
  useEffect(() => {
    try {
      localStorage.setItem('truckparts_sheets_api_url', sheetsApiUrl);
    } catch {
      // ignore storage errors
    }
  }, [sheetsApiUrl]);

  useEffect(() => {
    try {
      localStorage.setItem('truckparts_spreadsheet_id', spreadsheetId);
    } catch {
      // ignore storage errors
    }
  }, [spreadsheetId]);

  // Customers enter immediately without any automatic Google Auth or login popups.
  // Firebase Google Auth is initialized strictly on explicit operator click inside the PIN-protected panel.

  // Load live data on initial mount if user configured a real Apps Script URL
  useEffect(() => {
    if (!isPlaceholderAppsScriptUrl(sheetsApiUrl)) {
      void handleSyncDatabase(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredParts = useMemo(
    () => filterParts(parts, searchQuery, selectedCategory),
    [parts, searchQuery, selectedCategory]
  );

  // Track zero-result searches automatically in Importer Demand Analytics
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3 || filteredParts.length > 0) {
      setMissingReqSent(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (lastLoggedZeroQueryRef.current.toLowerCase() === trimmed.toLowerCase()) return;
      lastLoggedZeroQueryRef.current = trimmed;
      logMissingDemand(trimmed, 'search');
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filteredParts.length]);

  const logMissingDemand = (
    query: string,
    source: MissingDemandItem['source'],
    requestedByCustomer = false
  ) => {
    const clean = query.trim();
    if (!clean) return;
    const now = new Date();
    const timeStr = `Bugun, ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    setMissingDemand((prev) => {
      const existingIdx = prev.findIndex(
        (d) => d.query.toLowerCase() === clean.toLowerCase()
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          count: updated[existingIdx].count + 1,
          lastSearchedAt: timeStr,
          requestedByCustomer:
            updated[existingIdx].requestedByCustomer || requestedByCustomer,
        };
        return updated;
      }
      return [
        {
          id: `dem-${Date.now()}`,
          query: clean,
          count: 1,
          lastSearchedAt: timeStr,
          source,
          requestedByCustomer,
        },
        ...prev,
      ];
    });
  };

  const formatTimeNow = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleGoogleSignInClick = async () => {
    setIsGoogleLoggingIn(true);
    try {
      const res = await googleSignIn(() => {
        setGoogleUser(null);
        setHasGoogleToken(false);
      });
      if (res) {
        setGoogleUser(res.user);
        setHasGoogleToken(true);
        showToast(`Google Sheets hisobiga ulanildi: ${res.user.email}`);
        if (spreadsheetId.trim()) {
          await handleSyncGoogleSheetWithToken(res.accessToken, spreadsheetId);
        }
      }
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Google hisobga kirishda xatolik yuz berdi.'
      );
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  const handleGoogleSignOutClick = async () => {
    await logout();
    setGoogleUser(null);
    setHasGoogleToken(false);
    setSyncStatus((prev) =>
      prev.mode === 'google_sheets_api'
        ? {
            mode: 'fallback',
            connected: false,
            lastSyncedAt: prev.lastSyncedAt,
            message: 'Google hisobdan chiqildi. Buxoro mahalliy bazasi faol.',
          }
        : prev
    );
    showToast('Google hisobdan chiqildi.');
  };

  const handleSyncGoogleSheetWithToken = async (token: string, rawId: string) => {
    setIsSyncing(true);
    try {
      const { title, items, orders: fetchedOrders } = await fetchFromGoogleSheetsApi(
        token,
        rawId
      );
      if (items.length > 0) setParts(items);
      if (fetchedOrders.length > 0) setOrders(fetchedOrders);
      setSyncStatus({
        mode: 'google_sheets_api',
        connected: true,
        lastSyncedAt: formatTimeNow(),
        message: `Google Sheets ("${title}") bilan jonli ulandi (${items.length || parts.length} detal).`,
      });
      showToast(`"${title}" jadvalidan baza yangilandi!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sheets oʻqishda xatolik.';
      setSyncStatus({
        mode: 'fallback',
        connected: false,
        lastSyncedAt: formatTimeNow(),
        message: `${msg} Buxoro zaxira bazasi ishlamoqda.`,
      });
      showToast(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncDatabase = async (notify = true) => {
    const token = await getAccessToken();
    if (token && spreadsheetId.trim()) {
      await handleSyncGoogleSheetWithToken(token, spreadsheetId);
      return;
    }

    if (isPlaceholderAppsScriptUrl(sheetsApiUrl)) {
      setParts((prev) => (prev.length > 0 ? prev : BUKHARA_SEED_PARTS));
      setSyncStatus({
        mode: 'fallback',
        connected: false,
        lastSyncedAt: formatTimeNow(),
        message:
          'Buxoro Zapchast Baza (15 detal) faol. Operator panelida Google Sheets yoki Apps Script URL ulang.',
      });
      if (notify) {
        showToast('Buxoro mahalliy bazasi (15 detal) yangilandi.');
      }
      return;
    }

    setIsSyncing(true);
    try {
      const { items, orders: remoteOrders } = await fetchFromAppsScript(sheetsApiUrl);
      if (items.length > 0) setParts(items);
      if (remoteOrders.length > 0) setOrders(remoteOrders);
      setSyncStatus({
        mode: 'apps_script',
        connected: true,
        lastSyncedAt: formatTimeNow(),
        message: `Apps Script Web App bilan jonli ulandi (${items.length || parts.length} detal).`,
      });
      if (notify) showToast('Google Sheets bazasi muvaffaqiyatli yangilandi!');
    } catch {
      setSyncStatus({
        mode: 'fallback',
        connected: false,
        lastSyncedAt: formatTimeNow(),
        message:
          'Apps Script havolasiga ulanib boʻlmadi — Buxoro 15 ta zaxira baza avtomatik ishlamoqda.',
      });
      if (notify) {
        showToast('Havolaga ulanib boʻlmadi. Buxoro zaxira bazasi faol.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Explicit user confirmation before creating a new Google Sheet via Workspace API
  const requestCreateGoogleSheet = async () => {
    const token = await getAccessToken();
    if (!token) {
      showToast('Avval Google hisobingiz bilan kiring.');
      return;
    }
    setPendingMutation({
      title: 'Yangi Google Sheet yaratilsinmi?',
      description:
        'Sizning Google hisobingizda "TruckParts AI Uz — Buxoro Zapchast Baza" nomli yangi jadval yaratiladi va unga 15 ta Buxoro detali yoziladi.',
      details: [
        'Jadval nomi: TruckParts AI Uz — Buxoro Zapchast Baza',
        `Varoqlar: "Baza" (${parts.length} ta detal) va "Buyurtmalar" (sarlavhalar)`,
      ],
      confirmLabel: 'Yaratish va yozish',
      onConfirm: async () => {
        const created = await createBukharaSpreadsheet(token, parts);
        setSpreadsheetId(created.spreadsheetId);
        setSyncStatus({
          mode: 'google_sheets_api',
          connected: true,
          lastSyncedAt: formatTimeNow(),
          message: `Yangi "${created.title}" Google Sheet yaratildi va ulandi.`,
        });
        showToast(`Yangi Google Sheet yaratildi! ID: ${created.spreadsheetId.slice(0, 12)}...`);
      },
    });
  };

  const executePendingMutation = async () => {
    if (!pendingMutation) return;
    setIsMutatingSheet(true);
    try {
      await pendingMutation.onConfirm();
      setPendingMutation(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Google Sheetsga yozishda xatolik.');
    } finally {
      setIsMutatingSheet(false);
    }
  };

  // Voice Search (Web Speech API uz-UZ / ru-RU fallback)
  const toggleVoiceSearch = () => {
    if (isListeningVoice) {
      recognitionRef.current?.stop();
      setIsListeningVoice(false);
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceMessage(
        'Brauzeringiz ovozli qidiruvni qoʻllab-quvvatlamaydi. Qidiruv maydoniga yozing.'
      );
      window.setTimeout(() => setVoiceMessage(null), 4000);
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = 'uz-UZ';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      if (transcript) {
        setSearchQuery(transcript);
        setSelectedCategory('Barchasi');
        setVoiceMessage(`Eshitildi: "${transcript}"`);
        const matches = filterParts(parts, transcript, 'Barchasi');
        if (matches.length === 0) {
          logMissingDemand(transcript, 'voice');
        }
        window.setTimeout(() => setVoiceMessage(null), 3500);
      }
    };

    recognition.onerror = (ev) => {
      if (ev.error === 'language-not-supported' && recognition.lang === 'uz-UZ') {
        recognition.lang = 'ru-RU';
        try {
          recognition.start();
          return;
        } catch {
          // fall through
        }
      }
      setIsListeningVoice(false);
      setVoiceMessage('Ovoz aniqlanmadi. Mikrofon ruxsatini tekshiring va qayta bosing.');
      window.setTimeout(() => setVoiceMessage(null), 3500);
    };

    recognition.onend = () => {
      setIsListeningVoice(false);
    };

    recognitionRef.current = recognition;
    setVoiceMessage('Gapiring: masalan, "Howo porosyonok" yoki "315 balon"...');
    setIsListeningVoice(true);
    try {
      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  // Cart Actions
  const handleAddToCart = (part: TruckPart, tier: QualityTier) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (item) => item.part.artikul === part.artikul && item.tier === tier
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { part, tier, quantity: 1 }];
    });
  };

  const handleUpdateCartQty = (artikul: string, tier: QualityTier, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.part.artikul === artikul && item.tier === tier
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (artikul: string, tier: QualityTier) => {
    setCart((prev) =>
      prev.filter((item) => !(item.part.artikul === artikul && item.tier === tier))
    );
  };

  // Submit Order (updates local state immediately + posts to Apps Script or confirms Google Sheets API append)
  const handleSubmitOrder = async (newOrder: OrderRecord) => {
    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    if (newOrder.cashbackUZS > 0) {
      setWalletBalanceUZS((prev) => prev + newOrder.cashbackUZS);
    }

    // Apps Script live POST
    if (!isPlaceholderAppsScriptUrl(sheetsApiUrl)) {
      try {
        await postToAppsScript(sheetsApiUrl, {
          action: 'add_order',
          ...newOrder,
          gpsUrl: newOrder.gps?.mapsUrl || '',
        });
      } catch {
        // Local order already recorded safely
      }
    }

    // Only offer direct Google Sheets API append if operator explicitly signed in
    const token = isAdminUnlocked ? await getAccessToken() : null;
    if (token && extractSpreadsheetId(spreadsheetId)) {
      setPendingMutation({
        title: 'Buyurtmani Google Sheetsga yozilsinmi?',
        description:
          'Buyurtma mahalliy tizimda saqlandi. Uni ulangan Google Sheets jadvalining "Buyurtmalar" varagʻiga ham qoʻshasizmi?',
        details: [
          `Buyurtma: #${newOrder.id} · ${newOrder.customerName}`,
          `Summa: ${formatUZS(newOrder.totalUZS)}`,
          `Varoq: Buyurtmalar`,
        ],
        confirmLabel: 'Sheetsga yozish',
        onConfirm: async () => {
          await appendOrderToGoogleSheetsApi(token, spreadsheetId, newOrder);
          showToast(`Buyurtma #${newOrder.id} Google Sheets "Buyurtmalar" varagʻiga yozildi!`);
        },
      });
    }
  };

  const handleTashkentImportRequest = (params: {
    partName: string;
    oemCode: string;
    truckModel: string;
    customerName: string;
    customerPhone: string;
    diagnosis: string;
  }) => {
    const now = new Date();
    const timeStr = `Bugun, ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    const order: OrderRecord = {
      id: `IMP-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: timeStr,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      truckModel: params.truckModel,
      buyerRole,
      deliveryMethod: 'pickup',
      deliveryAddress: 'Toshkent importchi omboridan 12 soatda Buxoroga',
      gps: null,
      tradeInApplied: false,
      tradeInDiscount: 0,
      itemsSummary: `[12 SOAT IMPORT] ${params.partName} (${params.oemCode})`,
      itemsCount: 1,
      subtotal: 0,
      deliveryFee: 0,
      totalUZS: 0,
      cashbackUZS: 0,
      status: 'Importchidan olinmoqda',
      type: 'import_request',
      notes: params.diagnosis,
    };
    setOrders((prev) => [order, ...prev]);
    logMissingDemand(params.partName, 'ai_scan', true);
    if (!isPlaceholderAppsScriptUrl(sheetsApiUrl)) {
      void postToAppsScript(sheetsApiUrl, { action: 'add_order', ...order });
    }
    showToast(`Toshkent 12 soatlik import soʻrovi (#${order.id}) operatorga yuborildi!`);
  };

  const handleInlineMissingRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!missingReqName.trim() || !missingReqPhone.trim()) {
      setMissingReqError('Ismingiz va telefon raqamingizni kiriting.');
      return;
    }
    setMissingReqError(null);
    handleTashkentImportRequest({
      partName: searchQuery.trim(),
      oemCode: 'QIDIRUV',
      truckModel: 'Fura',
      customerName: missingReqName.trim(),
      customerPhone: missingReqPhone.trim(),
      diagnosis: `Mijoz katalogdan "${searchQuery.trim()}" qidirdi va 12 soatlik yetkazish soʻradi.`,
    });
    setMissingReqSent(true);
    setMissingReqName('');
    setMissingReqPhone('');
  };

  const handleAddPartFromOperator = async (newPart: TruckPart) => {
    setParts((prev) => [newPart, ...prev]);

    if (!isPlaceholderAppsScriptUrl(sheetsApiUrl)) {
      try {
        await postToAppsScript(sheetsApiUrl, {
          action: 'add_part',
          artikul: newPart.artikul,
          nomi: newPart.nomi,
          jargon: newPart.jargon,
          model: newPart.model,
          narx: newPart.narxFormatted,
          holati: newPart.holati,
          rasm: newPart.rasm,
        });
      } catch {
        // already added locally
      }
    }

    const token = await getAccessToken();
    if (token && extractSpreadsheetId(spreadsheetId)) {
      setPendingMutation({
        title: 'Yangi detalni Google Sheetsga yozilsinmi?',
        description:
          'Detal ilova katalogiga qoʻshildi. Uni ulangan Google Sheets jadvalining "Baza" varagʻiga ham yozasizmi?',
        details: [
          `Artikul: ${newPart.artikul}`,
          `Nomi: ${newPart.nomi}`,
          `Narxi: ${newPart.narxFormatted}`,
        ],
        confirmLabel: 'Baza varagʻiga yozish',
        onConfirm: async () => {
          await appendPartToGoogleSheetsApi(token, spreadsheetId, newPart);
          showToast(`"${newPart.nomi}" Google Sheets "Baza" varagʻiga yozildi!`);
        },
      });
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  };

  const handleWalletWithdraw = (params: {
    cardNumber: string;
    provider: 'Click' | 'Payme';
    amountUZS: number;
  }) => {
    const newW: CashbackWithdrawal = {
      id: `WDR-${Math.floor(200 + Math.random() * 800)}`,
      cardNumber: params.cardNumber,
      provider: params.provider,
      amountUZS: params.amountUZS,
      requestedAt: `Bugun, ${formatTimeNow()}`,
      status: 'Kutilmoqda',
    };
    setWithdrawals((prev) => [newW, ...prev]);
    setWalletBalanceUZS(0);
    showToast(`${params.provider} kartaga yechish soʻrovi yuborildi!`);
  };

  const cartSummary = useMemo(
    () =>
      calculateCartTotals(cart, {
        buyerRole,
        deliveryMethod: 'pickup',
        tradeInEnabled: false,
      }),
    [cart, buyerRole]
  );

  const getPartCartQuantity = (artikul: string) =>
    cart
      .filter((item) => item.part.artikul === artikul)
      .reduce((sum, item) => sum + item.quantity, 0);

  const switchView = (view: 'customer' | 'operator') => {
    if (view === 'operator' && !isAdminUnlocked) return;
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLogoTap = () => {
    if (activeView === 'operator') {
      switchView('customer');
      return;
    }
    if (!isAdminUnlocked) {
      const { nextTimestamps, unlocked } = recordLogoTap(
        logoTapTimestampsRef.current,
        Date.now()
      );
      logoTapTimestampsRef.current = nextTimestamps;
      if (unlocked) {
        setAdminPinModalOpen(true);
      }
    }
  };

  const handleAdminPinSuccess = () => {
    setAdminPinModalOpen(false);
    setIsAdminUnlocked(true);
    setActiveView('operator');
    window.scrollTo({ top: 0, behavior: 'instant' });
    showToast('Sotuvchi-Operator Paneli ochildi.');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Bar Contract: Deep Navy #0F172A, 3 clean single-line zones */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0F172A] text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Wordmark (5 taps unlocks Operator PIN modal) */}
          <button
            type="button"
            onClick={handleLogoTap}
            data-testid="app-logo-button"
            className="font-display text-sm font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 select-none sm:text-xl"
          >
            TruckParts <span className="text-amber-400">AI Uz</span>
          </button>

          {/* Zone 2: Primary App Nav (Operator Panel tab hidden by default) */}
          <nav
            aria-label="Asosiy bo'limlar"
            className="flex items-center gap-0.5 rounded-xl bg-slate-800/90 p-1 sm:gap-1"
          >
            <button
              type="button"
              onClick={() => switchView('customer')}
              aria-current={activeView === 'customer' ? 'page' : undefined}
              className={`min-h-[40px] rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-colors sm:px-4 sm:text-sm ${
                activeView === 'customer'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              Mijoz Ilovasi
            </button>
            {isAdminUnlocked && (
              <button
                type="button"
                onClick={() => switchView('operator')}
                aria-current={activeView === 'operator' ? 'page' : undefined}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold whitespace-nowrap transition-colors sm:px-4 sm:text-sm ${
                  activeView === 'operator'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                <Settings className="hidden h-4 w-4 md:inline" />
                <span className="sm:hidden">Operator</span>
                <span className="hidden sm:inline">Sotuvchi-Operator Paneli</span>
              </button>
            )}
          </nav>

          {/* Zone 3: Single Primary Action (Cart) */}
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Savatchani ochish, ${cartSummary.itemsCount} ta detal`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-2.5 py-2 text-xs font-bold text-slate-950 whitespace-nowrap transition-colors hover:bg-amber-400 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Savatcha</span>
            <span
              data-testid="header-cart-count"
              className="rounded-md bg-slate-950 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-400 tabular-nums"
            >
              {cartSummary.itemsCount}
            </span>
          </button>
        </div>
      </header>

      {/* Live Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 bottom-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {isAdminUnlocked && activeView === 'operator' ? (
        <main>
          <OperatorPanel
            parts={parts}
            orders={orders}
            missingDemand={missingDemand}
            sheetsApiUrl={sheetsApiUrl}
            onSheetsApiUrlChange={setSheetsApiUrl}
            spreadsheetId={spreadsheetId}
            onSpreadsheetIdChange={setSpreadsheetId}
            syncStatus={syncStatus}
            isSyncing={isSyncing}
            googleUser={googleUser}
            hasGoogleToken={hasGoogleToken}
            isGoogleLoggingIn={isGoogleLoggingIn}
            onGoogleSignIn={handleGoogleSignInClick}
            onGoogleSignOut={handleGoogleSignOutClick}
            onTestAppsScript={() => void handleSyncDatabase(true)}
            onSyncGoogleSheet={() => void handleSyncDatabase(true)}
            onCreateGoogleSheet={() => void requestCreateGoogleSheet()}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAddPart={handleAddPartFromOperator}
          />
        </main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 pt-5 pb-16 sm:px-6 lg:px-8">
          {/* Hero & 3-in-1 AI Search Hub */}
          <section
            aria-label="Qidiruv va AI skaner markazi"
            className="rounded-2xl border border-slate-200 bg-[#0F172A] p-5 text-white sm:p-7"
          >
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
              <div className="max-w-xl">
                <p className="text-xs font-semibold text-amber-400">
                  Buxoro M-37 / E-40 tranzit yoʻli · Howo · Shacman · Volvo · MAN · DAF · Scania · Schmitz · Krone
                </p>
                <h1 className="mt-1.5 font-display text-2xl leading-tight font-extrabold tracking-tight text-white [text-wrap:balance] sm:text-3xl lg:text-4xl">
                  Ogʻir yuk mashina zapchastlari — 15 daqiqada Buxoro omboridan
                </h1>
              </div>

              {/* Utility Row: Single-line on mobile (scrollable) & desktop */}
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto pb-1 no-scrollbar xl:pb-0">
                <button
                  type="button"
                  onClick={() => setReferralOpen(true)}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-amber-300 whitespace-nowrap hover:bg-slate-700"
                >
                  <Gift className="h-4 w-4 shrink-0" />
                  <span>50 000 soʻm Referal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-emerald-300 whitespace-nowrap hover:bg-slate-700"
                >
                  <Wallet className="h-4 w-4 shrink-0" />
                  <span className="font-mono tabular-nums">
                    Keshbek: {formatUZS(walletBalanceUZS)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSyncDatabase(true)}
                  disabled={isSyncing}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-100 whitespace-nowrap hover:bg-slate-700 disabled:opacity-60"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-amber-400" />
                  )}
                  <span>Bazani yangilash</span>
                </button>
              </div>
            </div>

            {/* 3-in-1 Search Command Row: Text/Slang + Voice + AI Vision Photo/VIN */}
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
              <div className="relative lg:col-span-6">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Artikul, detal nomi, usta jargoni yoki fura markasi bo'yicha qidirish"
                  placeholder="Masalan: porosyonok, 315 balon, WG9725520282, Howo..."
                  className="min-h-[54px] w-full rounded-xl border border-slate-700 bg-white pr-11 pl-12 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Qidiruvni tozalash"
                    className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={toggleVoiceSearch}
                className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors lg:col-span-3 ${
                  isListeningVoice
                    ? 'bg-red-600 text-white'
                    : 'border border-slate-600 bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {isListeningVoice ? (
                  <MicOff className="h-5 w-5 shrink-0" />
                ) : (
                  <Mic className="h-5 w-5 shrink-0 text-amber-400" />
                )}
                <span>{isListeningVoice ? 'Tinglanmoqda...' : 'Ovoz bilan qidirish'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-slate-950 whitespace-nowrap transition-colors hover:bg-amber-400 lg:col-span-3"
              >
                <Camera className="h-5 w-5 shrink-0" />
                <span>Detal / VIN rasmga olish</span>
              </button>
            </div>

            {voiceMessage && (
              <div
                role="status"
                className="mt-3 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-medium text-amber-300"
              >
                {voiceMessage}
              </div>
            )}

            {/* Quick-Tap Slang Chips (Interactive Filter Buttons) */}
            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="shrink-0 text-xs font-medium text-slate-400">Usta jargoni:</span>
              {SLANG_CHIPS.map((chip) => {
                const isActive =
                  searchQuery.trim().toLowerCase() === chip.query.toLowerCase();
                return (
                  <button
                    key={chip.query}
                    type="button"
                    onClick={() => {
                      setSearchQuery(isActive ? '' : chip.query);
                      setSelectedCategory('Barchasi');
                    }}
                    className={`min-h-[40px] shrink-0 rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Trassa SOS Urgent Strip (Direct 1-Tap Access to Emergency Call / Cart SOS) */}
          <section
            aria-label="Trassa SOS tezkor yordam"
            className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5"
          >
            <div className="flex items-start gap-3 sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-red-950">
                  TRASSA SOS 24/7 — Gazli / Olot / Qorakoʻl yoʻlida toʻxtab qoldingizmi?
                </div>
                <p className="text-xs text-red-800">
                  GPS lokatsiyangizni ulab tungi tezkor yetkazish va Mobil Usta chaqiring.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`tel:${OPERATOR_PHONE}`}
                className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white whitespace-nowrap hover:bg-red-700"
              >
                <Phone className="h-4 w-4" />
                <span>SOS Qoʻngʻiroq</span>
              </a>
            </div>
          </section>

          {/* Category Tabs & Results Count */}
          <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
              role="tablist"
              aria-label="Detal kategoriyalari"
            >
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-bold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span data-testid="catalog-results-count" className="font-mono text-slate-900">
                {filteredParts.length}
              </span>
              <span>ta detal topildi</span>
              {(searchQuery || selectedCategory !== 'Barchasi') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('Barchasi');
                  }}
                  className="ml-1 font-bold text-amber-700 underline hover:text-amber-800"
                >
                  Hammasini koʻrsatish
                </button>
              )}
            </div>
          </div>

          {/* Product Grid OR Toshkent 12-Hour Import Fallback */}
          {filteredParts.length > 0 ? (
            <section
              aria-label="Ehtiyot qismlar katalogi"
              className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredParts.map((part) => (
                <ProductCard
                  key={part.artikul}
                  part={part}
                  cartQuantity={getPartCartQuantity(part.artikul)}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </section>
          ) : (
            <section
              data-testid="tashkent-import-fallback"
              aria-label="Toshkent importchi omboridan buyurtma"
              className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Package className="h-4 w-4 text-amber-700" />
                    <span>Buxoro omborida topilmadi: &ldquo;{searchQuery}&rdquo;</span>
                  </div>
                  <h2 className="mt-2 font-display text-2xl font-extrabold text-slate-900">
                    Toshkent Importchi Omboridan 12 soatda keltiramiz!
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    Qidiruvingiz importchilar talab roʻyxatiga avtomatik qoʻshildi. Raqamingizni qoldiring — Toshkentdagi toʻgʻridan-toʻgʻri importchidan narxini aniqlab, tungi reys bilan Buxoroga yetkazib beramiz.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAiModalOpen(true)}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Camera className="h-4 w-4 text-amber-400" />
                      <span>Detalni rasmga olib AI bilan aniqlash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('Barchasi');
                      }}
                      className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      Barcha 15 ta detalni koʻrish
                    </button>
                  </div>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5">
                  {missingReqSent ? (
                    <div className="flex items-start gap-2.5 text-sm font-semibold text-emerald-800">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <span>
                        12 soatlik import buyurtmangiz operatorga yuborildi! Tez orada aloqaga chiqamiz.
                      </span>
                    </div>
                  ) : (
                    <form onSubmit={handleInlineMissingRequestSubmit} className="space-y-3">
                      <div className="font-display text-sm font-bold text-slate-900">
                        1 bosishda operatorga buyurtma qoldiring
                      </div>
                      <div>
                        <label
                          htmlFor="missing-req-name"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Ismingiz
                        </label>
                        <input
                          id="missing-req-name"
                          type="text"
                          value={missingReqName}
                          onChange={(e) => setMissingReqName(e.target.value)}
                          placeholder="Masalan: Rustam usta"
                          className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="missing-req-phone"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Telefon raqamingiz
                        </label>
                        <input
                          id="missing-req-phone"
                          type="tel"
                          value={missingReqPhone}
                          onChange={(e) => setMissingReqPhone(e.target.value)}
                          placeholder="+998 90 123 45 67"
                          className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      {missingReqError && (
                        <p className="text-xs font-semibold text-red-700">{missingReqError}</p>
                      )}
                      <button
                        type="submit"
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
                      >
                        <Send className="h-4 w-4" />
                        <span>12 soatda keltirishni soʻrash</span>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <span className="font-display font-bold text-slate-900">
              TruckParts AI Uz — Buxoro
            </span>{' '}
            · M-37 / E-40 tranzit yoʻli, Kogon burilishi, Buxoro
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`tel:${OPERATOR_PHONE}`}
              className="font-mono font-semibold text-slate-800 hover:text-amber-600"
            >
              {OPERATOR_PHONE_DISPLAY}
            </a>
            <span>24/7 Trassa SOS xizmati</span>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <AiScannerModal
        open={aiModalOpen}
        parts={parts}
        onClose={() => setAiModalOpen(false)}
        onAddToCart={handleAddToCart}
        onRequestTashkentImport={handleTashkentImportRequest}
        onLogMissingDemand={(q, src) => logMissingDemand(q, src, false)}
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        buyerRole={buyerRole}
        onBuyerRoleChange={setBuyerRole}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onSubmitOrder={handleSubmitOrder}
      />

      <ReferralModal
        open={referralOpen}
        referralCode={referralCode}
        invitedCount={invitedCount}
        onSimulateInvite={() => {
          setInvitedCount((c) => c + 1);
          setWalletBalanceUZS((b) => b + 50000);
          showToast('Yangi doʻst xaridi tasdiqlandi: +50 000 soʻm hamyoningizga qoʻshildi!');
        }}
        onClose={() => setReferralOpen(false)}
      />

      <MechanicWalletModal
        open={walletOpen}
        balanceUZS={walletBalanceUZS}
        withdrawals={withdrawals}
        onRequestWithdraw={handleWalletWithdraw}
        onClose={() => setWalletOpen(false)}
      />

      <ConfirmSheetMutationModal
        mutation={pendingMutation}
        isProcessing={isMutatingSheet}
        onCancel={() => setPendingMutation(null)}
        onConfirm={() => void executePendingMutation()}
      />

      <AdminPinModal
        open={adminPinModalOpen}
        onClose={() => setAdminPinModalOpen(false)}
        onSuccess={handleAdminPinSuccess}
      />
    </div>
  );
}
