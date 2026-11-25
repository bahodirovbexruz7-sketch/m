import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTelegramOrderUrl,
  calculateCartTotals,
  calculateFleetB2BSavings,
  calculateTierPrice,
  classifyCategory,
  filterParts,
  formatUZS,
  hasAdminQueryAccess,
  parsePriceUZS,
  recordLogoTap,
  verifyAdminPin,
} from './catalogLogic';
import { BUKHARA_SEED_PARTS } from '../data/bukharaSeed';

test('parses and formats Uzbek UZS price strings cleanly', () => {
  assert.equal(parsePriceUZS("3 650 000 so'm"), 3650000);
  assert.equal(parsePriceUZS('480000'), 480000);
  assert.equal(formatUZS(3650000), "3 650 000 so'm");
  assert.equal(formatUZS(35000), "35 000 so'm");
});

test('calculates 3-tier quality prices (-15%, base, +35%)', () => {
  assert.equal(calculateTierPrice(480000, 'ekonom'), 408000);
  assert.equal(calculateTierPrice(480000, 'oem'), 480000);
  assert.equal(calculateTierPrice(480000, 'original'), 648000);
});

test('BUKHARA_SEED_PARTS contains all 15 Bukhara items and matches slang queries', () => {
  assert.equal(BUKHARA_SEED_PARTS.length, 15);

  const porosyonok = filterParts(BUKHARA_SEED_PARTS, '#porosyonok', 'Barchasi');
  assert.equal(porosyonok.length, 1);
  assert.equal(porosyonok[0].artikul, 'WG9725520282');

  const balloons = filterParts(BUKHARA_SEED_PARTS, '', 'Balonlar');
  assert.equal(balloons.length, 3);

  const zeroMatch = filterParts(BUKHARA_SEED_PARTS, 'Holset turbina', 'Barchasi');
  assert.equal(zeroMatch.length, 0);
});

test('classifies categories correctly', () => {
  assert.equal(classifyCategory('TR-315-80R225', 'Yuk mashina shinasi', 'balon'), 'Balonlar');
  assert.equal(classifyCategory('LED-H7-24V', 'LED lampochka', 'svetodiod'), 'LED Svetodiod');
  assert.equal(classifyCategory('K2841-AIR', 'Havo filtri', 'vozduxan'), 'Filtrlar');
  assert.equal(classifyCategory('32222-BRG', 'Stupitsa podshipnigi', 'podshipnik'), 'Podshipnik');
  assert.equal(classifyCategory('WG9725520282', 'Tormoz kamerasi', 'porosyonok'), 'Tormoz va Pnevmo');
});

test('calculates cart totals with trade-in, delivery, and 5% mechanic cashback', () => {
  const porosyonok = BUKHARA_SEED_PARTS.find((p) => p.artikul === 'WG9725520282')!;
  const totals = calculateCartTotals(
    [{ part: porosyonok, tier: 'oem', quantity: 2 }],
    {
      buyerRole: 'mechanic',
      deliveryMethod: 'taxi',
      tradeInEnabled: true,
    }
  );
  // 480,000 * 2 = 960,000; trade-in -150,000 = 810,000; delivery +30,000 = 840,000; 5% cashback on 810,000 = 40,500
  assert.equal(totals.subtotal, 960000);
  assert.equal(totals.tradeInDiscount, 150000);
  assert.equal(totals.deliveryFee, 30000);
  assert.equal(totals.totalUZS, 840000);
  assert.equal(totals.cashbackUZS, 40500);
});

test('builds Telegram share URL with itemized receipt and GPS link', () => {
  const url = buildTelegramOrderUrl({
    orderId: 'SOS-9911',
    customerName: 'Akmal',
    customerPhone: '+998901112233',
    truckModel: 'Howo A7',
    buyerRole: 'driver',
    deliveryMethod: 'sos',
    deliveryAddress: 'Gazli 55km',
    itemsSummary: 'Tormoz kamerasi ×1',
    tradeInDiscount: 0,
    deliveryFee: 120000,
    totalUZS: 600000,
    cashbackUZS: 0,
    gps: {
      lat: 39.7747,
      lng: 64.4286,
      mapsUrl: 'https://maps.google.com/?q=39.7747,64.4286',
    },
  });
  assert.ok(url.startsWith('https://t.me/share/url?'));
  assert.ok(decodeURIComponent(url).includes('https://maps.google.com/?q=39.7747,64.4286'));
  assert.ok(decodeURIComponent(url).includes('SOS-9911'));
});

test('calculates B2B Avtopark fleet 15% savings and 12% Didox QQS', () => {
  const res = calculateFleetB2BSavings(10, 4000000, true);
  assert.equal(res.monthlyGrossSpend, 40000000);
  assert.equal(res.monthlySavings, 6000000);
  assert.equal(res.monthlyNetSpend, 34000000);
  assert.equal(res.annualSavings, 72000000);
  assert.equal(res.vatAmount, 4080000);
  assert.equal(res.netWithVat, 38080000);
});

test('admin access gate checks ?admin=buxoro2026 query param, PIN 2026, and 5 logo taps', () => {
  assert.equal(hasAdminQueryAccess(''), false);
  assert.equal(hasAdminQueryAccess('?admin=wrong'), false);
  assert.equal(hasAdminQueryAccess('?admin=buxoro2026'), true);
  assert.equal(hasAdminQueryAccess('?ref=BUX-1&admin=buxoro2026'), true);

  assert.equal(verifyAdminPin('2026'), true);
  assert.equal(verifyAdminPin(' 2026 '), true);
  assert.equal(verifyAdminPin('1234'), false);
  assert.equal(verifyAdminPin(''), false);

  let taps: number[] = [];
  for (let i = 0; i < 4; i++) {
    const res = recordLogoTap(taps, 1000 + i * 250);
    assert.equal(res.unlocked, false);
    taps = res.nextTimestamps;
  }
  const fifth = recordLogoTap(taps, 2100);
  assert.equal(fifth.unlocked, true);
  assert.equal(fifth.nextTimestamps.length, 0);

  // Stale taps older than 4000ms expire and do not trigger unlock
  const stale = recordLogoTap([100, 200, 300, 400], 6000);
  assert.equal(stale.unlocked, false);
  assert.equal(stale.nextTimestamps.length, 1);
});

