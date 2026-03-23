import { TrendingUp, AlertTriangle } from "lucide-react";

const formatCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);

const getMarginColor = (margin: number) => {
  if (margin < 15) return "text-destructive";
  if (margin < 25) return "text-surte-naranja";
  return "text-surte-verde";
};

const getMarginBg = (margin: number) => {
  if (margin < 15) return "bg-destructive/10";
  if (margin < 25) return "bg-surte-naranja/10";
  return "bg-surte-verde/10";
};

interface MarginCalculatorProps {
  costPrice: string;
  price: string;
  priceWholesale: string;
  priceDistributor: string;
}

const MarginCalculator = ({ costPrice, price, priceWholesale, priceDistributor }: MarginCalculatorProps) => {
  const cost = Number(costPrice) || 0;
  if (cost <= 0) return null;

  const calcMargin = (sell: number) => (sell > 0 ? ((sell - cost) / sell) * 100 : 0);
  const calcProfit = (sell: number) => (sell > 0 ? sell - cost : 0);

  const pDetal = Number(price) || 0;
  const pMayor = Number(priceWholesale) || 0;
  const pDist = Number(priceDistributor) || 0;

  const margins = [
    { label: "Detal", sell: pDetal, margin: calcMargin(pDetal), profit: calcProfit(pDetal) },
    ...(pMayor > 0 ? [{ label: "HORECA / Mayorista", sell: pMayor, margin: calcMargin(pMayor), profit: calcProfit(pMayor) }] : []),
    ...(pDist > 0 ? [{ label: "Distribuidor", sell: pDist, margin: calcMargin(pDist), profit: calcProfit(pDist) }] : []),
  ];

  const hasWarning = (pMayor > 0 && pMayor <= cost) || (pDist > 0 && pDist <= cost);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <TrendingUp size={14} className="text-accent" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Análisis de Rentabilidad</p>
      </div>

      <div className="grid gap-2">
        {margins.map((m) => (
          <div key={m.label} className={`rounded-lg px-3 py-2.5 ${getMarginBg(m.margin)} border border-border`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{m.label}</span>
              <span className={`text-sm font-bold font-mono ${getMarginColor(m.margin)}`}>
                {m.margin.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-muted-foreground">Ganancia/ud</span>
              <span className={`text-xs font-semibold font-mono ${getMarginColor(m.margin)}`}>
                {formatCOP(m.profit)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {hasWarning && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="text-destructive shrink-0" />
          <p className="text-[11px] text-destructive font-medium">
            ¡Alerta! Precio de venta igual o inferior al costo. Estás perdiendo dinero.
          </p>
        </div>
      )}
    </div>
  );
};

export default MarginCalculator;
