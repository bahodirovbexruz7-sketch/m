export type PartCategory =
  | 'Barchasi'
  | 'Balonlar'
  | 'LED Svetodiod'
  | 'Filtrlar'
  | 'Tormoz va Pnevmo'
  | 'Podshipnik';

export type QualityTier = 'ekonom' | 'oem' | 'original';

export type BuyerRole = 'driver' | 'mechanic';

export type DeliveryMethod = 'pickup' | 'taxi' | 'sos';

export type OrderStatus = 'Yangi' | 'Importchidan olinmoqda' | 'Yetkazildi';

export interface TruckPart {
  id: string;
  artikul: string;
  nomi: string;
  jargon: string;
  model: string;
  narx: number;
  narxFormatted: string;
  holati: string;
  rasm: string;
  category: Exclude<PartCategory, 'Barchasi'>;
  tradeInEligible?: boolean;
}

export interface CartItem {
  part: TruckPart;
  tier: QualityTier;
  quantity: number;
}

export interface GpsLocation {
  lat: number;
  lng: number;
  mapsUrl: string;
  accuracy?: number;
}

export interface OrderRecord {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  truckModel: string;
  buyerRole: BuyerRole;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  gps?: GpsLocation | null;
  tradeInApplied: boolean;
  tradeInDiscount: number;
  itemsSummary: string;
  itemsCount: number;
  subtotal: number;
  deliveryFee: number;
  totalUZS: number;
  cashbackUZS: number;
  status: OrderStatus;
  type: 'order' | 'sos' | 'import_request';
  notes?: string;
}

export interface MissingDemandItem {
  id: string;
  query: string;
  count: number;
  lastSearchedAt: string;
  source: 'search' | 'ai_scan' | 'voice';
  requestedByCustomer?: boolean;
}

export interface AiScanResult {
  isVinCode: boolean;
  vinCode: string;
  partNameUz: string;
  oemCode: string;
  truckBrands: string;
  matchedSlang: string[];
  confidence: number;
  diagnosisUz: string;
  matchedArtikuls: string[];
}

export interface CashbackWithdrawal {
  id: string;
  cardNumber: string;
  provider: 'Click' | 'Payme';
  amountUZS: number;
  requestedAt: string;
  status: 'Kutilmoqda' | 'Oʻtkazildi';
}

export interface SyncStatus {
  mode: 'fallback' | 'apps_script' | 'google_sheets_api';
  connected: boolean;
  lastSyncedAt: string | null;
  message: string;
}
