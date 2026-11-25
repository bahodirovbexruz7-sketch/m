import React, { useState } from 'react';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  Recycle,
  Send,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import {
  BuyerRole,
  CartItem,
  DeliveryMethod,
  GpsLocation,
  OrderRecord,
} from '../types';
import { OPERATOR_PHONE, OPERATOR_PHONE_DISPLAY } from '../data/bukharaSeed';
import {
  buildTelegramOrderUrl,
  calculateCartTotals,
  calculateTierPrice,
  formatUZS,
  getTierLabel,
  SOS_DELIVERY_FEE_UZS,
  TAXI_DELIVERY_FEE_UZS,
  TRADE_IN_DISCOUNT_UZS,
} from '../utils/catalogLogic';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  buyerRole: BuyerRole;
  onBuyerRoleChange: (role: BuyerRole) => void;
  onClose: () => void;
  onUpdateQty: (artikul: string, tier: CartItem['tier'], delta: number) => void;
  onRemoveItem: (artikul: string, tier: CartItem['tier']) => void;
  onSubmitOrder: (order: OrderRecord) => Promise<void>;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  items,
  buyerRole,
  onBuyerRoleChange,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onSubmitOrder,
}) => {
  const [tradeInEnabled, setTradeInEnabled] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [truckModel, setTruckModel] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<GpsLocation | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    order: OrderRecord;
    telegramUrl: string;
  } | null>(null);

  if (!open) return null;

  const totals = calculateCartTotals(items, {
    buyerRole,
    deliveryMethod,
    tradeInEnabled,
  });

  const handleGetGps = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('Brauzeringizda GPS aniqlash qoʻllab-quvvatlanmaydi.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setGps({
          lat,
          lng,
          accuracy: Math.round(pos.coords.accuracy),
          mapsUrl: `https://maps.google.com/?q=${lat},${lng}`,
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        setGpsError(
          err.code === 1
            ? 'GPS ruxsati rad etildi. Manzil maydoniga trassa kilometrini yozing.'
            : 'GPS signalini aniqlab boʻlmadi. Manzilni qoʻlda kiriting.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (!customerName.trim()) {
      setFormError('Iltimos, ismingizni kiriting.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 9) {
      setFormError('Iltimos, toʻgʻri telefon raqamini kiriting (kamida 9 raqam).');
      return;
    }
    if (deliveryMethod !== 'pickup' && !deliveryAddress.trim() && !gps) {
      setFormError('Yetkazish manzilini kiriting yoki GPS lokatsiyangizni ulang.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const prefix = deliveryMethod === 'sos' ? 'SOS' : 'BUX';
    const orderId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const itemsSummary = items
      .map(
        (it) =>
          `${it.part.nomi} [${getTierLabel(it.tier)}] ×${it.quantity}`
      )
      .join(', ');

    const finalAddress =
      deliveryMethod === 'pickup'
        ? "Buxoro M-37 do'kondan olib ketish (15 daqiqa)"
        : deliveryAddress.trim() ||
          (gps ? `GPS: ${gps.lat}, ${gps.lng}` : 'Buxoro viloyati');

    const newOrder: OrderRecord = {
      id: orderId,
      createdAt: `Bugun, ${timeStr}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      truckModel: truckModel.trim() || 'Yuk mashina',
      buyerRole,
      deliveryMethod,
      deliveryAddress: finalAddress,
      gps,
      tradeInApplied: totals.tradeInDiscount > 0,
      tradeInDiscount: totals.tradeInDiscount,
      itemsSummary,
      itemsCount: totals.itemsCount,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      totalUZS: totals.totalUZS,
      cashbackUZS: totals.cashbackUZS,
      status: 'Yangi',
      type: deliveryMethod === 'sos' ? 'sos' : 'order',
      notes: notes.trim() || undefined,
    };

    const telegramUrl = buildTelegramOrderUrl({
      orderId: newOrder.id,
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone,
      truckModel: newOrder.truckModel,
      buyerRole: newOrder.buyerRole,
      deliveryMethod: newOrder.deliveryMethod,
      deliveryAddress: newOrder.deliveryAddress,
      itemsSummary: newOrder.itemsSummary,
      tradeInDiscount: newOrder.tradeInDiscount,
      deliveryFee: newOrder.deliveryFee,
      totalUZS: newOrder.totalUZS,
      cashbackUZS: newOrder.cashbackUZS,
      gps: newOrder.gps,
      notes: newOrder.notes,
    });

    try {
      await onSubmitOrder(newOrder);
      setConfirmedOrder({ order: newOrder, telegramUrl });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDrawer = () => {
    setConfirmedOrder(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="h-5 w-5 text-amber-400" />
            <h2 id="cart-drawer-title" className="font-display text-lg font-bold">
              Savatcha {totals.itemsCount > 0 ? `(${totals.itemsCount})` : ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCloseDrawer}
            aria-label="Savatchani yopish"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {confirmedOrder ? (
            <div className="space-y-5 py-2" data-testid="order-confirmation-view">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-slate-900">
                  Buyurtma qabul qilindi!
                </h3>
                <p className="mt-1 font-mono text-sm font-bold text-emerald-800">
                  Buyurtma #{confirmedOrder.order.id}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Buxoro operatorimiz 5 daqiqa ichida siz bilan bogʻlanadi. Tezlashtirish uchun chekni Telegramdan yuboring.
                </p>
              </div>

              {/* Itemized Receipt */}
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Mijoz</span>
                  <span className="font-semibold text-slate-900">
                    {confirmedOrder.order.customerName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Telefon</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {confirmedOrder.order.customerPhone}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Yetkazish</span>
                  <span className="text-right font-semibold text-slate-900">
                    {confirmedOrder.order.deliveryAddress}
                  </span>
                </div>
                {confirmedOrder.order.gps && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">GPS xarita</span>
                    <a
                      href={confirmedOrder.order.gps.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700 underline"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2">
                  <div className="text-xs text-slate-500">Detallar</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-800">
                    {confirmedOrder.order.itemsSummary}
                  </div>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                  <span>Jami toʻlov</span>
                  <span className="font-mono tabular-nums">
                    {formatUZS(confirmedOrder.order.totalUZS)}
                  </span>
                </div>
                {confirmedOrder.order.cashbackUZS > 0 && (
                  <div className="flex justify-between text-xs font-bold text-emerald-700">
                    <span>Usta hamyoniga keshbek (5%)</span>
                    <span className="font-mono tabular-nums">
                      +{formatUZS(confirmedOrder.order.cashbackUZS)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <a
                  href={confirmedOrder.telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
                  <Send className="h-4 w-4" />
                  <span>Telegramdan operatorga yuborish</span>
                </a>
                <a
                  href={`tel:${OPERATOR_PHONE}`}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <Phone className="h-4 w-4" />
                  <span>Qoʻngʻiroq qilish ({OPERATOR_PHONE_DISPLAY})</span>
                </a>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Katalogga qaytish
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <ShoppingCart className="h-8 w-8" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
                Savatchangiz boʻsh
              </h3>
              <p className="mt-1.5 max-w-xs text-sm text-slate-600">
                Katalogdan kerakli ehtiyot qismni tanlang yoki AI foto-skaner orqali toping.
              </p>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="mt-6 min-h-[48px] rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
              >
                Detallarni koʻrish
              </button>
            </div>
          ) : (
            <form onSubmit={handleCheckoutSubmit} className="space-y-6">
              {/* Items list */}
              <div className="space-y-3">
                {items.map((item) => {
                  const unitPrice = calculateTierPrice(item.part.narx, item.tier);
                  return (
                    <div
                      key={`${item.part.artikul}-${item.tier}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-slate-500">
                          {item.part.artikul} · {getTierLabel(item.tier)}
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-slate-900">
                          {item.part.nomi}
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {formatUZS(unitPrice * item.quantity)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.part.artikul, item.tier, -1)}
                            aria-label={`${item.part.nomi} sonini kamaytirish`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-white"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-7 text-center font-mono text-sm font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.part.artikul, item.tier, 1)}
                            aria-label={`${item.part.nomi} sonini oshirish`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-white"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.part.artikul, item.tier)}
                          aria-label={`${item.part.nomi} o'chirish`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Oʻchirish</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trade-In Remfond Toggle */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={tradeInEnabled}
                    onChange={(e) => setTradeInEnabled(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-emerald-600"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <Recycle className="h-4 w-4 text-emerald-700" />
                      <span>Eski detalni topshirish — 150 000 soʻm chegirma</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Remfond: taʼmirlanadigan tormoz kamera, pnevmokran, turbina va starterlar uchun amal qiladi.
                    </p>
                  </div>
                </label>
              </div>

              {/* Buyer Role Switch */}
              <div>
                <div className="mb-2 text-xs font-bold text-slate-700">Xaridor turi</div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Xaridor turi">
                  <button
                    type="button"
                    onClick={() => onBuyerRoleChange('driver')}
                    aria-pressed={buyerRole === 'driver'}
                    className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                      buyerRole === 'driver'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                    <span>Haydovchi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuyerRoleChange('mechanic')}
                    aria-pressed={buyerRole === 'mechanic'}
                    className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                      buyerRole === 'mechanic'
                        ? 'border-emerald-700 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Wrench className="h-4 w-4" />
                    <span>Usta (+5% Keshbek)</span>
                  </button>
                </div>
                {buyerRole === 'mechanic' && (
                  <div
                    data-testid="live-cashback-banner"
                    className="mt-2.5 flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800"
                  >
                    <span>Usta hamyoningizga 5% keshbek:</span>
                    <span className="font-mono text-sm tabular-nums">
                      +{formatUZS(totals.cashbackUZS)}
                    </span>
                  </div>
                )}
              </div>

              {/* Delivery & Trassa SOS */}
              <div>
                <div className="mb-2 text-xs font-bold text-slate-700">
                  Yetkazib berish va Trassa SOS
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('pickup')}
                    aria-pressed={deliveryMethod === 'pickup'}
                    className={`flex min-h-[56px] w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      deliveryMethod === 'pickup'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Store className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        Buxoro M-37 doʻkondan olib ketish
                      </div>
                      <div
                        className={`text-xs ${
                          deliveryMethod === 'pickup' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Bepul, 15 daqiqada tayyor
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('taxi')}
                    aria-pressed={deliveryMethod === 'taxi'}
                    className={`flex min-h-[56px] w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      deliveryMethod === 'taxi'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Car className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        Buxoro / Kogon / Gʻijduvon taksi yetkazish
                      </div>
                      <div
                        className={`font-mono text-xs ${
                          deliveryMethod === 'taxi' ? 'text-amber-300' : 'text-slate-500'
                        }`}
                      >
                        {formatUZS(TAXI_DELIVERY_FEE_UZS)} · 45 daqiqa ichida
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod('sos')}
                    aria-pressed={deliveryMethod === 'sos'}
                    className={`flex min-h-[60px] w-full items-start gap-3 rounded-xl border p-3.5 text-left ${
                      deliveryMethod === 'sos'
                        ? 'border-red-700 bg-red-600 text-white'
                        : 'border-red-200 bg-red-50/70 text-red-950 hover:bg-red-50'
                    }`}
                  >
                    <AlertTriangle
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        deliveryMethod === 'sos' ? 'text-amber-300' : 'text-red-600'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold">
                        TRASSA SOS — Gazli / Olot / Qorakoʻl tungi yetkazish + Mobil Usta
                      </div>
                      <div
                        className={`font-mono text-xs ${
                          deliveryMethod === 'sos' ? 'text-white/90' : 'text-red-800'
                        }`}
                      >
                        Tezkor chiqish: {formatUZS(SOS_DELIVERY_FEE_UZS)}
                      </div>
                    </div>
                  </button>
                </div>

                {/* GPS Location Capture for SOS / Taxi */}
                {deliveryMethod === 'sos' && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
                    <button
                      type="button"
                      onClick={handleGetGps}
                      disabled={gpsLoading}
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {gpsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      <span>
                        {gpsLoading
                          ? 'GPS aniqlanmoqda...'
                          : gps
                            ? 'GPS lokatsiyani yangilash'
                            : 'Mening GPS lokatsiyamni ulash'}
                      </span>
                    </button>

                    {gps && (
                      <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                        <span className="font-mono font-semibold text-emerald-700">
                          {gps.lat}, {gps.lng}
                        </span>
                        <a
                          href={gps.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-blue-700 underline"
                        >
                          <span>Xaritada koʻrish</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                    {gpsError && (
                      <p className="mt-2 text-xs font-medium text-red-700">{gpsError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="cart-name"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Ismingiz *
                    </label>
                    <input
                      id="cart-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Usta yoki haydovchi ismi"
                      className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cart-phone"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Telefon raqam *
                    </label>
                    <input
                      id="cart-phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="cart-truck"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Yuk mashina rusumi
                  </label>
                  <input
                    id="cart-truck"
                    type="text"
                    value={truckModel}
                    onChange={(e) => setTruckModel(e.target.value)}
                    placeholder="Masalan: Howo A7, Volvo FH13, Schmitz pritsep"
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                {deliveryMethod !== 'pickup' && (
                  <div>
                    <label
                      htmlFor="cart-address"
                      className="mb-1 block text-xs font-semibold text-slate-700"
                    >
                      Manzil / Trassa kilometri *
                    </label>
                    <input
                      id="cart-address"
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Masalan: M-37 Gazli yo'li 42-km, Metan zapravka oldi"
                      className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="cart-notes"
                    className="mb-1 block text-xs font-semibold text-slate-700"
                  >
                    Qoʻshimcha izoh (ixtiyoriy)
                  </label>
                  <input
                    id="cart-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Masalan: mobil usta ham kerak, 24V ulagich bilan"
                    className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Detallar summasi</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatUZS(totals.subtotal)}
                  </span>
                </div>
                {totals.tradeInDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Remfond chegirmasi</span>
                    <span className="font-mono font-bold tabular-nums">
                      -{formatUZS(TRADE_IN_DISCOUNT_UZS)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Yetkazib berish</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {totals.deliveryFee === 0 ? 'Bepul' : formatUZS(totals.deliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2.5 text-base font-bold text-slate-900">
                  <span>Jami toʻlov</span>
                  <span
                    data-testid="cart-total-amount"
                    className="font-mono text-lg tabular-nums"
                  >
                    {formatUZS(totals.totalUZS)}
                  </span>
                </div>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700"
                >
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-bold transition-colors disabled:opacity-60 ${
                  deliveryMethod === 'sos'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                <span>
                  {submitting
                    ? 'Buyurtma yuborilmoqda...'
                    : deliveryMethod === 'sos'
                      ? 'TRASSA SOS buyurtmasini yuborish'
                      : 'Buyurtmani tasdiqlash'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
