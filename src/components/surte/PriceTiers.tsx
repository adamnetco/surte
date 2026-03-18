import { Tag, TrendingDown, Crown } from "lucide-react";
import { useAppSettings } from "@/hooks/useStore";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

interface PriceTiersProps {
  price: number;
  priceWholesale?: number | null;
  priceDistributor?: number | null;
  compact?: boolean;
}

const tiers = [
  { key: "detal" as const, label: "Detal", icon: Tag, color: "text-foreground" },
  { key: "mayor" as const, label: "Mayor", icon: TrendingDown, color: "text-accent" },
  { key: "distribuidor" as const, label: "Distribuidor", icon: Crown, color: "text-surte-orange" },
];

const PriceTiers = ({ price, priceWholesale, priceDistributor, compact = false }: PriceTiersProps) => {
  const { data: settings } = useAppSettings();

  if (settings?.show_price_tiers === "false") return null;

  const prices = {
    detal: price,
    mayor: priceWholesale,
    distribuidor: priceDistributor,
  };

  const activeTiers = tiers.filter((t) => prices[t.key] != null);

  if (activeTiers.length <= 1) return null;

  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap mt-1">
        {activeTiers.map((tier) => {
          const p = prices[tier.key]!;
          return (
            <span
              key={tier.key}
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-muted ${tier.color}`}
            >
              {tier.label}: {formatPrice(p)}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-xl p-3 space-y-2">
      <p className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Precios por volumen</p>
      <div className="grid grid-cols-3 gap-2">
        {activeTiers.map((tier) => {
          const Icon = tier.icon;
          const p = prices[tier.key]!;
          return (
            <div key={tier.key} className="text-center bg-card rounded-lg py-2 px-1">
              <Icon size={14} className={`mx-auto mb-1 ${tier.color}`} />
              <p className={`text-xs font-heading font-bold ${tier.color}`}>{formatPrice(p)}</p>
              <p className="text-[10px] text-muted-foreground">{tier.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PriceTiers;
