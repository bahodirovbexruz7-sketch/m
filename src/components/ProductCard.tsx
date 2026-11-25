import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Cog,
  Disc,
  Filter,
  Lightbulb,
  Plus,
  Recycle,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import { QualityTier, TruckPart } from '../types';
import {
  calculateTierPrice,
  formatUZS,
  isInBukharaStock,
} from '../utils/catalogLogic';

interface ProductCardProps {
  part: TruckPart;
  cartQuantity: number;
  onAddToCart: (part: TruckPart, tier: QualityTier) => void;
  highlightBadge?: string;
}

const TIERS: Array<{ id: QualityTier; short: string; delta: string }> = [
  { id: 'ekonom', short: 'Ekonom', delta: '-15%' },
  { id: 'oem', short: 'Zavod OEM', delta: 'Tavsiya' },
  { id: 'original', short: 'Yevropa', delta: '+35%' },
];

function CategoryFallbackIcon({ category }: { category: TruckPart['category'] }) {
  switch (category) {
    case 'Balonlar':
      return <Disc className="h-12 w-12 text-slate-400" />;
    case 'LED Svetodiod':
      return <Lightbulb className="h-12 w-12 text-amber-500" />;
    case 'Filtrlar':
      return <Filter className="h-12 w-12 text-slate-400" />;
    case 'Podshipnik':
      return <Cog className="h-12 w-12 text-slate-400" />;
    default:
      return <Wrench className="h-12 w-12 text-slate-400" />;
  }
}

export const ProductCard: React.FC<ProductCardProps> = ({
  part,
  cartQuantity,
  onAddToCart,
  highlightBadge,
}) => {
  const [selectedTier, setSelectedTier] = useState<QualityTier>('oem');
  const [imgFailed, setImgFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const inBukhara = isInBukharaStock(part.holati);
  const activePrice = calculateTierPrice(part.narx, selectedTier);
  const slangTerms = part.jargon
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleAdd = () => {
    onAddToCart(part, selectedTier);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1100);
  };

  return (
    <article
      data-testid={`product-card-${part.artikul}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-150 hover:border-slate-300 hover:shadow-md"
    >
      {/* Product Photo Area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50">
        {!imgFailed && part.rasm ? (
          <img
            src={part.rasm}
            alt={part.nomi}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-contain p-4 transition-transform duration-200 hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 p-6 text-center">
            <CategoryFallbackIcon category={part.category} />
            <span className="font-mono text-xs font-semibold text-slate-500">
              {part.artikul}
            </span>
          </div>
        )}

        {/* Top-left Stock Indicator (Color + Icon + Text) */}
        <div
          className={`absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs ${
            inBukhara
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 text-slate-950'
          }`}
        >
          {inBukhara ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Clock className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{part.holati}</span>
        </div>

        {highlightBadge && (
          <div className="absolute right-3 bottom-3 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-amber-400">
            {highlightBadge}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Clean unboxed metadata row */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-mono font-semibold text-slate-700">{part.artikul}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{part.category}</span>
        </div>

        <h3 className="mt-1.5 font-display text-base leading-snug font-bold text-slate-900">
          {part.nomi}
        </h3>

        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Mos modellari:</span> {part.model}
        </p>

        {/* Unboxed mechanic slang metadata */}
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Usta tili:</span>{' '}
          {slangTerms.join(' · ')}
        </p>

        {part.tradeInEligible && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Recycle className="h-3.5 w-3.5 shrink-0" />
            <span>Remfond: eski detalga -150 000 soʻm chegirma</span>
          </div>
        )}

        {/* 3-Tier Quality Switcher */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">Sifat darajasi</span>
            <span className="font-mono text-[11px]">
              {selectedTier === 'ekonom'
                ? 'Ekonom (Xitoy)'
                : selectedTier === 'original'
                  ? 'Original Yevropa'
                  : 'Zavod OEM (Tavsiya)'}
            </span>
          </div>
          <div
            className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
            role="group"
            aria-label={`${part.nomi} sifat darajasi`}
          >
            {TIERS.map((tier) => {
              const active = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedTier(tier.id)}
                  aria-pressed={active}
                  className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg px-1.5 py-1 text-center transition-colors ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <span className="text-[11px] leading-tight font-bold whitespace-nowrap">
                    {tier.short}
                  </span>
                  <span
                    className={`font-mono text-[10px] leading-tight ${
                      active ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    {tier.delta}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Price + Primary Add CTA */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Tanlangan narx</div>
            <div
              data-testid={`product-price-${part.artikul}`}
              className="font-mono text-lg font-bold tracking-tight text-slate-900 tabular-nums"
            >
              {formatUZS(activePrice)}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            aria-label={`${part.nomi} savatchaga qo'shish`}
            className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors active:scale-[0.98] ${
              justAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" />
                <span>Qoʻshildi</span>
              </>
            ) : (
              <>
                {cartQuantity > 0 ? (
                  <Plus className="h-4 w-4" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                <span>{cartQuantity > 0 ? `Yana (${cartQuantity})` : 'Savatchaga'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
