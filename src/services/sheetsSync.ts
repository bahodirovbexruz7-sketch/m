import { OrderRecord, TruckPart } from '../types';
import { formatUZS, parsePriceUZS, parseSheetRowToPart } from '../utils/catalogLogic';

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function isPlaceholderAppsScriptUrl(url: string): boolean {
  const trimmed = url.trim();
  return !trimmed || trimmed.includes('AKfycbx-BUXORO-ZAPCHAST-BAZA-DEMO');
}

interface SpreadsheetMetadata {
  title: string;
  sheetTitles: string[];
}

async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        `Google Sheets ulanish xatosi (HTTP ${res.status}). Jadval ID yoki ruxsatni tekshiring.`
    );
  }
  const data = await res.json();
  const title = data?.properties?.title || 'Google Sheet';
  const sheetTitles: string[] = Array.isArray(data?.sheets)
    ? data.sheets
        .map((s: { properties?: { title?: string } }) => s?.properties?.title)
        .filter((t: unknown): t is string => typeof t === 'string')
    : [];
  return { title, sheetTitles };
}

function findTabName(sheetTitles: string[], preferred: string[], fallbackIndex: number): string | null {
  for (const pref of preferred) {
    const found = sheetTitles.find((t) => t.toLowerCase() === pref.toLowerCase());
    if (found) return found;
  }
  return sheetTitles[fallbackIndex] ?? null;
}

export async function createBukharaSpreadsheet(
  accessToken: string,
  parts: TruckPart[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title: 'TruckParts AI Uz — Buxoro Zapchast Baza' },
      sheets: [
        { properties: { title: 'Baza' } },
        { properties: { title: 'Buyurtmalar' } },
      ],
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || 'Yangi Google Sheet yaratib boʻlmadi.');
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string =
    created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  const bazaRows = [
    ['Artikul', 'Rasmiy_nomi', 'Usta_jargoni', 'Mashina_modeli', 'Narxi_som', 'Holati', 'Rasm_silka'],
    ...parts.map((p) => [
      p.artikul,
      p.nomi,
      p.jargon,
      p.model,
      formatUZS(p.narx),
      p.holati,
      p.rasm,
    ]),
  ];

  const orderHeaders = [
    [
      'ID',
      'Sana',
      'Mijoz',
      'Telefon',
      'Mashina',
      'Rol',
      'Yetkazish',
      'Manzil',
      'GPS_Link',
      'Detallar',
      'Remfond',
      'Jami_som',
      'Keshbek_5_foiz',
      'Holat',
    ],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Baza!A1:G100', values: bazaRows },
          { range: 'Buyurtmalar!A1:N1', values: orderHeaders },
        ],
      }),
    }
  );

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: created?.properties?.title || 'TruckParts AI Uz — Buxoro Zapchast Baza',
  };
}

export async function fetchFromGoogleSheetsApi(
  accessToken: string,
  rawId: string
): Promise<{ title: string; items: TruckPart[]; orders: OrderRecord[] }> {
  const spreadsheetId = extractSpreadsheetId(rawId);
  if (!spreadsheetId) {
    throw new Error('Google Sheets ID yoki havolasini kiriting.');
  }

  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const bazaTab = findTabName(meta.sheetTitles, ['Baza', 'Parts', 'Katalog'], 0);
  const ordersTab = findTabName(meta.sheetTitles, ['Buyurtmalar', 'Orders'], 1);

  const items: TruckPart[] = [];
  const orders: OrderRecord[] = [];

  if (bazaTab) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`'${bazaTab}'!A1:G500`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const json = await res.json();
      const rows: string[][] = json.values || [];
      if (rows.length > 1) {
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] ?? '';
          });
          // Fallback positional mapping if headers differ slightly
          const mapped = parseSheetRowToPart(
            {
              artikul: rowObj.artikul || cols[0] || '',
              nomi: rowObj.rasmiy_nomi || rowObj.nomi || cols[1] || '',
              jargon: rowObj.usta_jargoni || rowObj.jargon || cols[2] || '',
              model: rowObj.mashina_modeli || rowObj.model || cols[3] || '',
              narx: rowObj.narxi_som || rowObj.narx || cols[4] || '0',
              holati: rowObj.holati || cols[5] || 'Buxoro omborida bor',
              rasm: rowObj.rasm_silka || rowObj.rasm || cols[6] || '',
            },
            i
          );
          if (mapped) items.push(mapped);
        }
      }
    }
  }

  if (ordersTab && ordersTab !== bazaTab) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`'${ordersTab}'!A2:N500`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const json = await res.json();
      const rows: string[][] = json.values || [];
      rows.forEach((cols, idx) => {
        if (!cols[0] && !cols[2]) return;
        const gpsUrl = cols[8] || '';
        const latLngMatch = gpsUrl.match(/q=([-\d.]+),([-\d.]+)/);
        const total = parsePriceUZS(cols[11] || '0');
        const cashback = parsePriceUZS(cols[12] || '0');
        const tradeIn = parsePriceUZS(cols[10] || '0');
        const rawStatus = cols[13] || 'Yangi';
        const status: OrderRecord['status'] =
          rawStatus === 'Yetkazildi' || rawStatus === 'Importchidan olinmoqda'
            ? rawStatus
            : 'Yangi';
        const deliveryRaw = (cols[6] || '').toLowerCase();
        const deliveryMethod: OrderRecord['deliveryMethod'] = deliveryRaw.includes('sos')
          ? 'sos'
          : deliveryRaw.includes('taksi')
            ? 'taxi'
            : 'pickup';

        orders.push({
          id: cols[0] || `SH-${idx + 1}`,
          createdAt: cols[1] || 'Bugun',
          customerName: cols[2] || 'Mijoz',
          customerPhone: cols[3] || '',
          truckModel: cols[4] || '',
          buyerRole: (cols[5] || '').toLowerCase().includes('usta') ? 'mechanic' : 'driver',
          deliveryMethod,
          deliveryAddress: cols[7] || '',
          gps: latLngMatch
            ? {
                lat: Number(latLngMatch[1]),
                lng: Number(latLngMatch[2]),
                mapsUrl: gpsUrl,
              }
            : null,
          itemsSummary: cols[9] || '',
          itemsCount: 1,
          tradeInApplied: tradeIn > 0,
          tradeInDiscount: tradeIn,
          subtotal: total + tradeIn,
          deliveryFee: 0,
          totalUZS: total,
          cashbackUZS: cashback,
          status,
          type: deliveryMethod === 'sos' ? 'sos' : 'order',
        });
      });
    }
  }

  return { title: meta.title, items, orders };
}

export async function appendOrderToGoogleSheetsApi(
  accessToken: string,
  rawId: string,
  order: OrderRecord
): Promise<void> {
  const spreadsheetId = extractSpreadsheetId(rawId);
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const ordersTab = findTabName(meta.sheetTitles, ['Buyurtmalar', 'Orders'], 1) || meta.sheetTitles[0];

  const row = [
    order.id,
    order.createdAt,
    order.customerName,
    order.customerPhone,
    order.truckModel,
    order.buyerRole === 'mechanic' ? 'Usta (+5%)' : 'Haydovchi',
    order.deliveryMethod === 'sos'
      ? 'TRASSA SOS'
      : order.deliveryMethod === 'taxi'
        ? 'Taksi'
        : "Do'kondan olib ketish",
    order.deliveryAddress,
    order.gps?.mapsUrl || '',
    order.itemsSummary,
    order.tradeInDiscount > 0 ? formatUZS(order.tradeInDiscount) : '0',
    formatUZS(order.totalUZS),
    formatUZS(order.cashbackUZS),
    order.status,
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`'${ordersTab}'!A:N`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || 'Buyurtmani Google Sheetsga yozib boʻlmadi.');
  }
}

export async function appendPartToGoogleSheetsApi(
  accessToken: string,
  rawId: string,
  part: TruckPart
): Promise<void> {
  const spreadsheetId = extractSpreadsheetId(rawId);
  const meta = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const bazaTab = findTabName(meta.sheetTitles, ['Baza', 'Parts', 'Katalog'], 0) || meta.sheetTitles[0];

  const row = [
    part.artikul,
    part.nomi,
    part.jargon,
    part.model,
    formatUZS(part.narx),
    part.holati,
    part.rasm,
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`'${bazaTab}'!A:G`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || 'Yangi detalni Google Sheetsga yozib boʻlmadi.');
  }
}

export async function fetchFromAppsScript(
  url: string
): Promise<{ items: TruckPart[]; orders: OrderRecord[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Apps Script HTTP ${res.status}`);
    }
    const data = await res.json();
    const rawItems: Array<Record<string, unknown>> = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.baza)
        ? data.baza
        : Array.isArray(data)
          ? data
          : [];

    const items = rawItems
      .map((r, i) => parseSheetRowToPart(r, i))
      .filter((x): x is TruckPart => x !== null);

    const rawOrders: Array<Record<string, unknown>> = Array.isArray(data?.orders)
      ? data.orders
      : Array.isArray(data?.buyurtmalar)
        ? data.buyurtmalar
        : [];

    const orders: OrderRecord[] = rawOrders.map((o, idx) => {
      const gpsUrl = String(o.gpsUrl ?? o.gps ?? '');
      const latLng = gpsUrl.match(/q=([-\d.]+),([-\d.]+)/);
      const deliveryRaw = String(o.deliveryMethod ?? o.yetkazish ?? 'pickup').toLowerCase();
      const deliveryMethod: OrderRecord['deliveryMethod'] = deliveryRaw.includes('sos')
        ? 'sos'
        : deliveryRaw.includes('taxi') || deliveryRaw.includes('taksi')
          ? 'taxi'
          : 'pickup';
      const total = parsePriceUZS(String(o.totalUZS ?? o.jami ?? '0'));
      return {
        id: String(o.id ?? `GS-${idx + 1}`),
        createdAt: String(o.createdAt ?? o.sana ?? 'Bugun'),
        customerName: String(o.customerName ?? o.mijoz ?? 'Mijoz'),
        customerPhone: String(o.customerPhone ?? o.telefon ?? ''),
        truckModel: String(o.truckModel ?? o.mashina ?? ''),
        buyerRole: String(o.buyerRole ?? o.rol ?? '').toLowerCase().includes('usta')
          ? 'mechanic'
          : 'driver',
        deliveryMethod,
        deliveryAddress: String(o.deliveryAddress ?? o.manzil ?? ''),
        gps: latLng
          ? { lat: Number(latLng[1]), lng: Number(latLng[2]), mapsUrl: gpsUrl }
          : null,
        tradeInApplied: Boolean(o.tradeInApplied),
        tradeInDiscount: parsePriceUZS(String(o.tradeInDiscount ?? '0')),
        itemsSummary: String(o.itemsSummary ?? o.detallar ?? ''),
        itemsCount: Number(o.itemsCount ?? 1),
        subtotal: total,
        deliveryFee: 0,
        totalUZS: total,
        cashbackUZS: parsePriceUZS(String(o.cashbackUZS ?? o.keshbek ?? '0')),
        status:
          o.status === 'Yetkazildi' || o.status === 'Importchidan olinmoqda'
            ? o.status
            : 'Yangi',
        type: deliveryMethod === 'sos' ? 'sos' : 'order',
      };
    });

    return { items, orders };
  } finally {
    clearTimeout(timer);
  }
}

export async function postToAppsScript(
  url: string,
  payload: Record<string, unknown>
): Promise<{ sent: boolean; mode: 'cors' | 'no-cors' }> {
  if (isPlaceholderAppsScriptUrl(url)) {
    return { sent: false, mode: 'no-cors' };
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { sent: true, mode: 'cors' };
  } catch {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return { sent: true, mode: 'no-cors' };
  }
}
