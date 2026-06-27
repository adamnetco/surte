// Slice 5 — Exports contables (Siigo / Alegra CSV + PDF estados financieros)
import { supabase } from "@/integrations/supabase/client";

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const download = (filename: string, content: string, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

type LineRow = {
  entry_id: string;
  entry_date: string;
  narration: string | null;
  reference_type: string | null;
  reference_id: string | null;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
};

async function fetchJournalLines(orgId: string, from: string, to: string): Promise<LineRow[]> {
  const { data, error } = await supabase
    .from("journal_entries" as any)
    .select(`
      id, entry_date, narration, reference_type, reference_id, status,
      lines:journal_entry_lines(
        debit_amount, credit_amount,
        account:accounting_accounts(code, name)
      )
    `)
    .eq("organization_id", orgId)
    .eq("status", "posted")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date");
  if (error) throw error;
  const rows: LineRow[] = [];
  for (const e of (data ?? []) as any[]) {
    for (const l of (e.lines ?? [])) {
      rows.push({
        entry_id: e.id,
        entry_date: e.entry_date,
        narration: e.narration,
        reference_type: e.reference_type,
        reference_id: e.reference_id,
        account_code: l.account?.code ?? "",
        account_name: l.account?.name ?? "",
        debit_amount: Number(l.debit_amount || 0),
        credit_amount: Number(l.credit_amount || 0),
      });
    }
  }
  return rows;
}

/** Siigo: importación de comprobantes contables (formato simplificado). */
export async function exportSiigoCSV(orgId: string, from: string, to: string) {
  const rows = await fetchJournalLines(orgId, from, to);
  const header = ["Comprobante","Fecha","Cuenta","Nombre","Debito","Credito","Descripcion","TipoOrigen","RefOrigen"];
  const body = rows.map((r) => [
    r.entry_id.slice(0, 8),
    r.entry_date,
    r.account_code,
    r.account_name,
    r.debit_amount.toFixed(2),
    r.credit_amount.toFixed(2),
    r.narration ?? "",
    r.reference_type ?? "",
    r.reference_id ?? "",
  ].map(csvEscape).join(","));
  download(`siigo_${from}_${to}.csv`, [header.join(","), ...body].join("\n"));
}

/** Alegra: exporta asientos de diario para importación. */
export async function exportAlegraCSV(orgId: string, from: string, to: string) {
  const rows = await fetchJournalLines(orgId, from, to);
  const header = ["Numero","Fecha","Cuenta","Descripcion","Debe","Haber"];
  const body = rows.map((r) => [
    r.entry_id.slice(0, 8),
    r.entry_date,
    r.account_code,
    `${r.account_name}${r.narration ? " — " + r.narration : ""}`,
    r.debit_amount.toFixed(2),
    r.credit_amount.toFixed(2),
  ].map(csvEscape).join(","));
  download(`alegra_${from}_${to}.csv`, [header.join(","), ...body].join("\n"));
}

const fmt = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

type PLData = { revenue: number; cogs: number; gross_profit: number; expenses: number; net_income: number };
type BSData = { assets: number; liabilities: number; equity: number; net_income: number; balanced: boolean };
type TBRow  = { code: string; name: string; debit_total: number; credit_total: number; balance: number };

/** Imprime/descarga PDF usando la ventana de impresión del navegador. */
export function printFinancialStatements(opts: {
  orgName: string;
  from: string;
  to: string;
  pl: PLData;
  bs: BSData;
  tb: TBRow[];
}) {
  const { orgName, from, to, pl, bs, tb } = opts;
  const tbRows = tb
    .filter((r) => Number(r.debit_total) + Number(r.credit_total) > 0)
    .map((r) => `<tr>
      <td>${r.code}</td><td>${r.name}</td>
      <td style="text-align:right">${fmt(Number(r.debit_total))}</td>
      <td style="text-align:right">${fmt(Number(r.credit_total))}</td>
      <td style="text-align:right"><b>${fmt(Number(r.balance))}</b></td>
    </tr>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Estados Financieros — ${orgName}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;padding:24px;max-width:780px;margin:auto}
  h1{font-size:18px;margin:0 0 4px;color:#0C4B83}
  h2{font-size:14px;margin:24px 0 8px;color:#0C4B83;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
  .meta{color:#6b7280;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{padding:4px 6px;border-bottom:1px solid #f3f4f6}
  th{background:#f9fafb;text-align:left;font-weight:600}
  .row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
  .row.total{border-top:1px solid #d1d5db;font-weight:bold;margin-top:6px;padding-top:6px}
  .ok{color:#16a34a}.bad{color:#dc2626}
  @media print{ button{display:none} body{padding:8px} }
</style></head><body>
  <button onclick="window.print()" style="float:right;padding:8px 14px;background:#0C4B83;color:#fff;border:0;border-radius:6px;cursor:pointer">Imprimir / PDF</button>
  <h1>${orgName}</h1>
  <div class="meta">Estados Financieros · ${from} a ${to} · Generado ${new Date().toLocaleString("es-CO")}</div>

  <h2>Estado de Resultados</h2>
  <div class="row"><span>Ingresos</span><span>${fmt(pl.revenue)}</span></div>
  <div class="row"><span>(−) Costo de ventas</span><span>${fmt(pl.cogs)}</span></div>
  <div class="row total"><span>Utilidad bruta</span><span>${fmt(pl.gross_profit)}</span></div>
  <div class="row"><span>(−) Gastos operacionales</span><span>${fmt(pl.expenses)}</span></div>
  <div class="row total ${pl.net_income >= 0 ? "ok" : "bad"}"><span>Utilidad neta</span><span>${fmt(pl.net_income)}</span></div>

  <h2>Balance General (al ${to})</h2>
  <div class="row"><span>Activos</span><span>${fmt(bs.assets)}</span></div>
  <div class="row"><span>Pasivos</span><span>${fmt(bs.liabilities)}</span></div>
  <div class="row"><span>Patrimonio</span><span>${fmt(bs.equity)}</span></div>
  <div class="row"><span>Utilidad del ejercicio</span><span>${fmt(bs.net_income)}</span></div>
  <div class="row total ${bs.balanced ? "ok" : "bad"}">
    <span>Ecuación contable</span><span>${bs.balanced ? "Cuadra ✓" : "DESCUADRADA"}</span>
  </div>

  <h2>Balance de Comprobación</h2>
  <table>
    <thead><tr><th>Código</th><th>Cuenta</th><th style="text-align:right">Débitos</th><th style="text-align:right">Créditos</th><th style="text-align:right">Saldo</th></tr></thead>
    <tbody>${tbRows || `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:12px">Sin movimientos</td></tr>`}</tbody>
  </table>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) { alert("Permite las ventanas emergentes para exportar el PDF."); return; }
  w.document.write(html);
  w.document.close();
}
