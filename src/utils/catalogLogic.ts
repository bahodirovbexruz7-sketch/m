import {
  BuyerRole,
  CartItem,
  DeliveryMethod,
  GpsLocation,
  PartCategory,
  QualityTier,
  TruckPart,
} from '../types';

export const TRADE_IN_DISCOUNT_UZS = 150000;
export const TAXI_DELIVERY_FEE_UZS = 30000;
export const SOS_DELIVERY_FEE_UZS = 120000;
export const MECHANIC_CASHBACK_RATE = 0.05;
export const B2B_BULK_DISCOUNT_RATE = 0.15;
export const DIDOX_VAT_RATE = 0.12;

export function parsePriceUZS(raw: string | number): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  const digits = String(raw).replace(/[^\d]/g, '');
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatUZS(amount: number): string {
  const safe = Math.max(0, Math.round(amount));
  const formatted = safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} so'm`;
}

export function calculateTierPrice(basePriceUZS: number, tier: QualityTier): number {
  const base = Math.max(0, basePriceUZS);
  if (tier === 'ekonom') {
    return Math.round((base * 0.85) / 1000) * 1000;
  }
  if (tier === 'original') {
    return Math.round((base * 1.35) / 1000) * 1000;
  }
  return base;
}

export function getTierLabel(tier: QualityTier): string {
  switch (tier) {
    case 'ekonom':
      return 'Ekonom (Xitoy)';
    case 'oem':
      return 'Zavod OEM (Tavsiya)';
    case 'original':
      return 'Original Yevropa';
  }
}

export function classifyCategory(
  artikul: string,
  nomi: string,
  jargon: string
): Exclude<PartCategory, 'Barchasi'> {
  const text = `${artikul} ${nomi} ${jargon}`.toLowerCase();
  if (
    text.includes('shina') ||
    text.includes('balon') ||
    text.includes('pokrishka') ||
    text.startsWith('tr-')
  ) {
    return 'Balonlar';
  }
  if (
    text.includes('led') ||
    text.includes('svetodiod') ||
    text.includes('fara') ||
    text.includes('fonar') ||
    text.includes('chiroq') ||
    text.includes('gabarit') ||
    text.includes('lampa')
  ) {
    return 'LED Svetodiod';
  }
  if (
    text.includes('filtr') ||
    text.includes('vozduxan') ||
    text.includes('separator')
  ) {
    return 'Filtrlar';
  }
  if (
    text.includes('podshipnik') ||
    text.includes('stupitsa') ||
    text.includes('-brg')
  ) {
    return 'Podshipnik';
  }
  return 'Tormoz va Pnevmo';
}

export function isInBukharaStock(holati: string): boolean {
  const h = holati.toLowerCase();
  return h.includes('buxoro') || h.includes('bor');
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['ʻ’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterParts(
  parts: TruckPart[],
  query: string,
  category: PartCategory
): TruckPart[] {
  const cleanQuery = normalizeSearchText(query).replace(/^#/, '');
  const tokens = cleanQuery ? cleanQuery.split(' ').filter(Boolean) : [];

  return parts.filter((part) => {
    if (category !== 'Barchasi' && part.category !== category) {
      return false;
    }
    if (tokens.length === 0) return true;

    const haystack = normalizeSearchText(
      `${part.artikul} ${part.nomi} ${part.jargon} ${part.model} ${part.category} ${part.holati}`
    );

    return tokens.every((token) => haystack.includes(token));
  });
}

export function getDeliveryFee(method: DeliveryMethod): number {
  switch (method) {
    case 'pickup':
      return 0;
    case 'taxi':
      return TAXI_DELIVERY_FEE_UZS;
    case 'sos':
      return SOS_DELIVERY_FEE_UZS;
  }
}

export interface CartTotals {
  itemsCount: number;
  subtotal: number;
  tradeInDiscount: number;
  deliveryFee: number;
  totalUZS: number;
  cashbackUZS: number;
}

export function calculateCartTotals(
  items: CartItem[],
  options: {
    buyerRole: BuyerRole;
    deliveryMethod: DeliveryMethod;
    tradeInEnabled: boolean;
  }
): CartTotals {
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + calculateTierPrice(item.part.narx, item.tier) * item.quantity,
    0
  );
  const tradeInDiscount =
    options.tradeInEnabled && subtotal > 0
      ? Math.min(TRADE_IN_DISCOUNT_UZS, subtotal)
      : 0;
  const discountedGoods = Math.max(0, subtotal - tradeInDiscount);
  const deliveryFee = itemsCount > 0 ? getDeliveryFee(options.deliveryMethod) : 0;
  const totalUZS = discountedGoods + deliveryFee;
  const cashbackUZS =
    options.buyerRole === 'mechanic'
      ? Math.round(discountedGoods * MECHANIC_CASHBACK_RATE)
      : 0;

  return {
    itemsCount,
    subtotal,
    tradeInDiscount,
    deliveryFee,
    totalUZS,
    cashbackUZS,
  };
}

export function buildTelegramOrderUrl(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  truckModel: string;
  buyerRole: BuyerRole;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  itemsSummary: string;
  tradeInDiscount: number;
  deliveryFee: number;
  totalUZS: number;
  cashbackUZS: number;
  gps?: GpsLocation | null;
  notes?: string;
}): string {
  const deliveryLabels: Record<DeliveryMethod, string> = {
    pickup: "Buxoro M-37 do'kondan olib ketish (Bepul)",
    taxi: "Buxoro / Kogon / G'ijduvon taksi yetkazish",
    sos: "TRASSA SOS (Tezkor yetkazish + Mobil Usta)",
  };

  const lines = [
    `🚚 YANGI BUYURTMA #${params.orderId} — TruckParts AI Uz (Buxoro)`,
    `👤 Mijoz: ${params.customerName} (${params.buyerRole === 'mechanic' ? 'Usta / Avtoservis +5%' : 'Haydovchi'})`,
    `📞 Telefon: ${params.customerPhone}`,
    `🚛 Mashina: ${params.truckModel || 'Koʻrsatilmagan'}`,
    `📦 Detallar: ${params.itemsSummary}`,
    `📍 Yetkazish: ${deliveryLabels[params.deliveryMethod]}`,
    params.deliveryAddress ? `🏠 Manzil: ${params.deliveryAddress}` : '',
    params.gps ? `🗺️ GPS Lokatsiya: ${params.gps.mapsUrl}` : '',
    params.tradeInDiscount > 0
      ? `♻️ Remfond (eski detal): -${formatUZS(params.tradeInDiscount)}`
      : '',
    params.deliveryFee > 0
      ? `🚕 Yetkazish haqi: ${formatUZS(params.deliveryFee)}`
      : '',
    `💰 JAMI TO'LOV: ${formatUZS(params.totalUZS)}`,
    params.cashbackUZS > 0
      ? `💳 Usta keshbeki (5%): +${formatUZS(params.cashbackUZS)}`
      : '',
    params.notes ? `📝 Izoh: ${params.notes}` : '',
  ].filter(Boolean);

  const text = lines.join('\n');
  return `https://t.me/share/url?url=${encodeURIComponent(
    'https://truckparts-buxoro.uz'
  )}&text=${encodeURIComponent(text)}`;
}

export interface FleetSavingsResult {
  monthlyGrossSpend: number;
  monthlySavings: number;
  monthlyNetSpend: number;
  annualSavings: number;
  recommendedDeposit: number;
  vatAmount: number;
  netWithVat: number;
}

export function calculateFleetB2BSavings(
  truckCount: number,
  monthlySpendPerTruckUZS: number,
  includeDidoxVat: boolean
): FleetSavingsResult {
  const trucks = Math.max(1, Math.round(truckCount));
  const perTruck = Math.max(0, monthlySpendPerTruckUZS);
  const monthlyGrossSpend = trucks * perTruck;
  const monthlySavings = Math.round(monthlyGrossSpend * B2B_BULK_DISCOUNT_RATE);
  const monthlyNetSpend = monthlyGrossSpend - monthlySavings;
  const annualSavings = monthlySavings * 12;
  const recommendedDeposit = Math.round(monthlyNetSpend * 0.5);
  const vatAmount = includeDidoxVat ? Math.round(monthlyNetSpend * DIDOX_VAT_RATE) : 0;
  const netWithVat = monthlyNetSpend + vatAmount;

  return {
    monthlyGrossSpend,
    monthlySavings,
    monthlyNetSpend,
    annualSavings,
    recommendedDeposit,
    vatAmount,
    netWithVat,
  };
}

export function parseSheetRowToPart(row: Record<string, unknown>, index: number): TruckPart | null {
  const artikul = String(row.artikul ?? row.Artikul ?? '').trim();
  const nomi = String(row.nomi ?? row.Rasmiy_nomi ?? '').trim();
  if (!artikul || !nomi) return null;

  const jargon = String(row.jargon ?? row.Usta_jargoni ?? '').trim();
  const model = String(row.model ?? row.Mashina_modeli ?? '').trim();
  const narx = parsePriceUZS(String(row.narx ?? row.Narxi_som ?? '0'));
  const holati = String(row.holati ?? row.Holati ?? 'Buxoro omborida bor').trim();
  const rasm = String(row.rasm ?? row.Rasm_silka ?? '').trim();
  const category = classifyCategory(artikul, nomi, jargon);

  return {
    id: artikul || `ROW-${index}`,
    artikul,
    nomi,
    jargon,
    model,
    narx,
    narxFormatted: formatUZS(narx),
    holati,
    rasm,
    category,
    tradeInEligible:
      category === 'Tormoz va Pnevmo' ||
      artikul.toUpperCase().includes('WABCO') ||
      artikul.toUpperCase().includes('WG9725'),
  };
}

export const ADMIN_QUERY_PARAM = 'admin';
export const ADMIN_QUERY_VALUE = 'buxoro2026';
export const ADMIN_PIN_CODE = '2026';
export const ADMIN_LOGO_TAP_TARGET = 5;
export const ADMIN_LOGO_TAP_WINDOW_MS = 4000;

export function hasAdminQueryAccess(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search);
  return params.get(ADMIN_QUERY_PARAM) === ADMIN_QUERY_VALUE;
}

export function verifyAdminPin(pinInput: string): boolean {
  return pinInput.trim() === ADMIN_PIN_CODE;
}

export function recordLogoTap(
  previousTimestamps: number[],
  nowMs: number,
  windowMs = ADMIN_LOGO_TAP_WINDOW_MS,
  target = ADMIN_LOGO_TAP_TARGET
): { nextTimestamps: number[]; unlocked: boolean } {
  const recent = previousTimestamps.filter((ts) => nowMs - ts <= windowMs);
  const updated = [...recent, nowMs];
  if (updated.length >= target) {
    return { nextTimestamps: [], unlocked: true };
  }
  return { nextTimestamps: updated, unlocked: false };
}

