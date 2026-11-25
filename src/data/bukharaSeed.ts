import { MissingDemandItem, OrderRecord, TruckPart } from '../types';
import { classifyCategory, formatUZS, parsePriceUZS } from '../utils/catalogLogic';

export const DEFAULT_SHEETS_API_URL =
  'https://script.google.com/macros/s/AKfycbx-BUXORO-ZAPCHAST-BAZA-DEMO/exec';

export const OPERATOR_PHONE = '+998905123700';
export const OPERATOR_PHONE_DISPLAY = '+998 90 512 37 00';
export const OPERATOR_TELEGRAM_USERNAME = 'truckparts_buxoro';

interface RawBukharaRow {
  artikul: string;
  nomi: string;
  jargon: string;
  model: string;
  narx: string;
  holati: string;
  rasm: string;
}

const RAW_BUKHARA_ITEMS: RawBukharaRow[] = [
  {
    artikul: 'TR-315-80R225',
    nomi: 'Yuk mashina shinasi 315/80 R22.5 (old/vedushiy)',
    jargon: 'balon, shina, pokrishka, 22.5 balon',
    model: 'Howo, Shacman, Volvo, MAN, DAF',
    narx: "3 650 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://encrypted-tbn2.gstatic.com/licensed-image?q=tbn:ANd9GcTsyLDdmInej-EBVLv8EnnAgxGRCh0RcGqoyCvMWHnxyr-k0IJsoIkn2gIxSiyGfNMjGEBIQ0-QAi31nnA',
  },
  {
    artikul: 'TR-385-65R225',
    nomi: 'Pritsep shinasi 385/65 R22.5 (bochka balon)',
    jargon: 'keng balon, pritsep balon, bochka shina, 385 balon',
    model: 'Shmitz, Krone, Wielton, Howo pritsep',
    narx: "4 100 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://encrypted-tbn2.gstatic.com/licensed-image?q=tbn:ANd9GcSalhcLH9c73J02bzkJKMp8IV6ZYphpCl_EX7BM5Zz1cZLrYKC6RoKqd4VJily5yOt9Qq4Om848NBz_Zl0',
  },
  {
    artikul: 'TR-1200R20-18PR',
    nomi: 'Yuk mashina kamerasiz/kamerali shinasi 12.00 R20',
    jargon: '12 lik balon, xitoy balon, kamaz balon, karer balon',
    model: 'Howo A7, Shacman X3000, FAW',
    narx: "3 250 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://encrypted-tbn1.gstatic.com/licensed-image?q=tbn:ANd9GcTCXmr5yWlk4CytFAiq3MO5YCY4nL6Afprx3WCt2_wGl_DbFmP-xDKQhpfgJuaW4cr2cO5GNeTRZpq9CoQ',
  },
  {
    artikul: 'LED-24V-BAR72',
    nomi: 'LED tumanka fara 24V (72W, kuchli oq nur)',
    jargon: "svetodiod, led fara, tumanka, qo'shimcha fara, proyektor",
    model: 'Barcha furalar (24V: Howo, Volvo, MAN, DAF)',
    narx: "280 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://encrypted-tbn1.gstatic.com/licensed-image?q=tbn:ANd9GcTxrCJ2Dy1mUCf_Uy23dFpzJtcajc-nOdTrhzoqQnph5P_Diu4Pe-RnDG81XwMHwVbFAPDTZ-pYsyN_4i8',
  },
  {
    artikul: 'LED-24V-TAIL',
    nomi: 'Orqa LED stop-signal chiroqlar komplekti (24V)',
    jargon: 'orqa fonar, svetodiod stop, led stop, pritsep fonar',
    model: 'Howo, Shacman, Pritseplar (24V)',
    narx: "340 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://encrypted-tbn1.gstatic.com/licensed-image?q=tbn:ANd9GcR4BmVCMMA3fyo4EuK5QDwHZgPW0obq9Ruu7u6XtFWBorj7zvRHMUyWYcvFRjHhGXfRBk675ch_dyOBOmg',
  },
  {
    artikul: 'LED-24V-SIDE',
    nomi: "Yon gabarit LED chiroq (sariq/qizil, 24V, suv o'tkazmas)",
    jargon: 'gabarit, svetodiod gabarit, mitti chiroq, yon lampa',
    model: 'Barcha yuk mashinalari va pritseplar (24V)',
    narx: "35 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://encrypted-tbn2.gstatic.com/licensed-image?q=tbn:ANd9GcSHKt-YAYqIyqImaeSjxn1W-iDIwgY9Tkp1Fqc_DlCKuRQl_e9OrdXFEuGVlHMLy8Jl2oYLWHvTz5-qtBI',
  },
  {
    artikul: 'LED-H7-24V',
    nomi: "LED lampochka H7 24V (blijniy/dalniy, super yorug')",
    jargon: 'led lampa, svetodiod lampochka, H7 lampa, oq lampa',
    model: 'Volvo FH, MAN TGA/TGX, DAF XF, Scania',
    narx: "160 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://www.ledperf.co.uk/images/products/ledperf/64/W500/34699_h7-led-bulbs-24v-for-truck.jpg',
  },
  {
    artikul: 'WG9725520282',
    nomi: 'Tormoz kamerasi (energakkumulyator 30/30)',
    jargon: 'porosyonok, bochka, tormoz kamera, energo',
    model: 'Howo A7, Shacman F2000/X3000',
    narx: "480 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://image.made-in-china.com/2f0j00dpvcMPzICruB/Sinotruk-HOWO-Truck-Spring-Air-Brake-Chamber-Wg9100360303.webp',
  },
  {
    artikul: '612600081335',
    nomi: "Yoqilg'i filtri (separator + tonkiy ochistka komplekt)",
    jargon: 'salyarka filtr, separator, filtr howo, plunjer filtr',
    model: 'Howo, Shacman (Weichai WP10/WP12)',
    narx: "185 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://image.made-in-china.com/2f0j00rfDYuclJaOgH/612600081335-Euro-III-Weichai-Diesel-Engine-Fuel-Filter-Water-Separator.webp',
  },
  {
    artikul: '61000070005',
    nomi: 'Moy filtri (dvigatel moy filtri, 2 talik komplekt)',
    jargon: 'moy filtr, maslyaniy filtr, weichai filtr',
    model: 'Howo, Shacman, FAW, Camc',
    narx: "140 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://www.epartshub.co.ke/wp-content/uploads/2024/05/wo.png',
  },
  {
    artikul: 'K2841-AIR',
    nomi: 'Havo filtri (katta korpusli havo filtri)',
    jargon: 'vozduxan, havo filtr, bochka filtr',
    model: 'Howo A7, Shacman X3000',
    narx: "260 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://image.made-in-china.com/202f0j00hrjoEDAWHIgV/K2841-Air-Filter-for-Sinotruck-HOWO-Weichai-Engine-Parts-Wg9725190102-Wg9725190103.webp',
  },
  {
    artikul: 'WABCO-973011',
    nomi: 'Tezlashtiruvchi pnevmokran (uskortelniy kran)',
    jargon: 'pnevmokran, uskortelniy, havo kran, tormoz kran',
    model: 'Volvo, MAN, DAF, Shacman, Howo',
    narx: "420 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://www.wabco-customercentre.com/catalog/productImage/9730110020-2_tif.png',
  },
  {
    artikul: '1R12-603',
    nomi: 'Pnevmopodushka (pritsep va kabina yostiqchasi)',
    jargon: 'podushka, pnevmo podushka, rezina podushka, grusha',
    model: 'Shmitz, Krone, BPW, SAF, Volvo',
    narx: "550 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://www.allprodiesel.net/cdn/shop/products/good-year-1r12-603-air-spring-replaces-freightliner-16-13801-00016-16773-000-829434.jpg?v=1663079422&width=4096',
  },
  {
    artikul: 'WG9231342068',
    nomi: 'Tormoz kolodkasi (orqa baraban nakladka komplekt)',
    jargon: 'kolodka, nakladka, tormoz nakladka, baraban kolodka',
    model: 'Howo, Shacman, Steyr',
    narx: "390 000 so'm",
    holati: 'Buxoro omborida bor',
    rasm: 'https://image.made-in-china.com/2f0j00bDoeqCykkRcv/14-Holes-Wg9231342068-9-19244-Si-1-1-Brake-Lining-with-Glass-Ceramic-Fibre-for-HOWO.webp',
  },
  {
    artikul: '32222-BRG',
    nomi: "G'ildirak stupitsa podshipnigi (kuchaytirilgan)",
    jargon: 'podshipnik, stupitsa podshipnik, rolikli podshipnik',
    model: 'Howo, Shacman, BPW, SAF',
    narx: "310 000 so'm",
    holati: 'Toshkentdan 12 soatda',
    rasm: 'https://image.made-in-china.com/2f0j00YGicmfMSgVrz/Original-32222-Wg9981032222-Tapered-Roller-Bearing-for-Sinotruk-Truck-Spare-Parts-1900033226167-54100052-Rear-Wheel-Bearing.jpg',
  },
];

export const BUKHARA_SEED_PARTS: TruckPart[] = RAW_BUKHARA_ITEMS.map((row) => {
  const numericPrice = parsePriceUZS(row.narx);
  const category = classifyCategory(row.artikul, row.nomi, row.jargon);
  const tradeInEligible =
    category === 'Tormoz va Pnevmo' ||
    row.artikul.includes('WABCO') ||
    row.artikul.includes('WG9725520282');

  return {
    id: row.artikul,
    artikul: row.artikul,
    nomi: row.nomi,
    jargon: row.jargon,
    model: row.model,
    narx: numericPrice,
    narxFormatted: formatUZS(numericPrice),
    holati: row.holati,
    rasm: row.rasm,
    category,
    tradeInEligible,
  };
});

export const INITIAL_ORDERS: OrderRecord[] = [
  {
    id: 'BUX-2409',
    createdAt: 'Bugun, 10:15',
    customerName: 'Usta Dilshod (Kogon Servis)',
    customerPhone: '+998 91 445 88 21',
    truckModel: 'Howo A7 371',
    buyerRole: 'mechanic',
    deliveryMethod: 'taxi',
    deliveryAddress: 'Kogon halqa yoʻli, 4-boks',
    gps: null,
    tradeInApplied: true,
    tradeInDiscount: 150000,
    itemsSummary: 'Tormoz kamerasi 30/30 (Zavod OEM) ×2, Yoqilgʻi filtri ×1',
    itemsCount: 3,
    subtotal: 1145000,
    deliveryFee: 30000,
    totalUZS: 1025000,
    cashbackUZS: 49750,
    status: 'Yangi',
    type: 'order',
  },
  {
    id: 'SOS-2408',
    createdAt: 'Bugun, 08:42',
    customerName: 'Shuhrat Haydovchi',
    customerPhone: '+998 93 680 12 04',
    truckModel: 'Volvo FH13 + Schmitz',
    buyerRole: 'driver',
    deliveryMethod: 'sos',
    deliveryAddress: 'A-380 Gazli trassasi, 45-km',
    gps: {
      lat: 40.0412,
      lng: 63.7824,
      mapsUrl: 'https://maps.google.com/?q=40.0412,63.7824',
    },
    tradeInApplied: false,
    tradeInDiscount: 0,
    itemsSummary: 'Pnevmopodushka 1R12-603 (Original Yevropa) ×1, Uskortelniy kran ×1',
    itemsCount: 2,
    subtotal: 1165000,
    deliveryFee: 120000,
    totalUZS: 1285000,
    cashbackUZS: 0,
    status: 'Importchidan olinmoqda',
    type: 'sos',
    notes: 'Mobil usta bilan birga chiqish kerak, havo tizimi tushib ketgan.',
  },
  {
    id: 'BUX-2407',
    createdAt: 'Kecha, 18:20',
    customerName: 'Buxoro Trans Logistics',
    customerPhone: '+998 90 714 55 00',
    truckModel: 'Shacman X3000',
    buyerRole: 'mechanic',
    deliveryMethod: 'pickup',
    deliveryAddress: 'Buxoro M-37 doʻkondan olib ketish',
    gps: null,
    tradeInApplied: false,
    tradeInDiscount: 0,
    itemsSummary: 'Yuk mashina shinasi 315/80 R22.5 (Zavod OEM) ×2',
    itemsCount: 2,
    subtotal: 7300000,
    deliveryFee: 0,
    totalUZS: 7300000,
    cashbackUZS: 365000,
    status: 'Yetkazildi',
    type: 'order',
  },
];

export const INITIAL_MISSING_DEMAND: MissingDemandItem[] = [
  {
    id: 'dem-1',
    query: 'Holset HX40W turbina (Weichai WP12)',
    count: 7,
    lastSearchedAt: 'Bugun, 09:50',
    source: 'search',
    requestedByCustomer: true,
  },
  {
    id: 'dem-2',
    query: 'Volvo FH13 Nox datchik 24V',
    count: 5,
    lastSearchedAt: 'Bugun, 08:12',
    source: 'ai_scan',
    requestedByCustomer: true,
  },
  {
    id: 'dem-3',
    query: 'Shacman X3000 radiatori alyuminiy',
    count: 4,
    lastSearchedAt: 'Kecha, 21:30',
    source: 'voice',
    requestedByCustomer: false,
  },
  {
    id: 'dem-4',
    query: 'MAN TGX starter Bosch 24V',
    count: 3,
    lastSearchedAt: 'Kecha, 16:05',
    source: 'search',
    requestedByCustomer: true,
  },
];

export const SLANG_CHIPS: Array<{ label: string; query: string }> = [
  { label: '#porosyonok', query: 'porosyonok' },
  { label: '#balon', query: 'balon' },
  { label: '#svetodiod', query: 'svetodiod' },
  { label: '#grusha', query: 'grusha' },
  { label: '#filtr', query: 'filtr' },
  { label: '#howo', query: 'howo' },
  { label: '#volvo', query: 'volvo' },
];
