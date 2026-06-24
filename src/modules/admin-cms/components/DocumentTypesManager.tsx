import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FileText, Receipt, FileCheck2, FileMinus, FileQuestion, Star, Save } from "lucide-react";

interface CatalogRow {
  id: string;
  code: string;
  label: string;
  family: string;
  dian_code: string | null;
  description: string | null;
  goes_to_dian: boolean;
  requires_resolution: boolean;
  applies_to_modules: string[];
}

interface OrgRow {
  id?: string;
  document_type_id: string;
  is_enabled: boolean;
  is_default: boolean;
  numbering_prefix: string | null;
  numbering_from: number | null;
  numbering_to: number | null;
  numbering_current: number | null;
}

function familyIcon(family: string) {
  switch (family) {
    case "factura":     return FileText;
    case "equivalente": return Receipt;
    case "nota":        return FileMinus;
    case "soporte":     return FileCheck2;
    default:            return FileQuestion;
  }
}

interface Props {
  organizationId: string;
}

/**
 * Manager de tipos de documento por organización.
 * Permite activar/desactivar tipos del catálogo global y configurar
 * numeración (prefijo, rango, consecutivo actual) para los que aplican.
 */
export default function DocumentTypesManager({ organizationId }: Props) {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, OrgRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: cat }, { data: org }] = await Promise.all([
      supabase
        .from("document_types")
        .select("id, code, label, family, dian_code, description, goes_to_dian, requires_resolution, applies_to_modules")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("organization_document_types")
        .select("id, document_type_id, is_enabled, is_default, numbering_prefix, numbering_from, numbering_to, numbering_current")
        .eq("organization_id", organizationId),
    ]);

    setCatalog((cat as CatalogRow[]) ?? []);
    const map: Record<string, OrgRow> = {};
    for (const row of (org as OrgRow[]) ?? []) map[row.document_type_id] = row;
    setOrgMap(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [organizationId]);

  const upsertRow = async (docTypeId: string, patch: Partial<OrgRow>) => {
    setSavingId(docTypeId);
    const existing = orgMap[docTypeId];
    const row = {
      organization_id: organizationId,
      document_type_id: docTypeId,
      is_enabled: existing?.is_enabled ?? true,
      is_default: existing?.is_default ?? false,
      numbering_prefix: existing?.numbering_prefix ?? null,
      numbering_from: existing?.numbering_from ?? null,
      numbering_to: existing?.numbering_to ?? null,
      numbering_current: existing?.numbering_current ?? null,
      ...patch,
    };

    const { data, error } = await supabase
      .from("organization_document_types")
      .upsert(row, { onConflict: "organization_id,document_type_id" })
      .select("id, document_type_id, is_enabled, is_default, numbering_prefix, numbering_from, numbering_to, numbering_current")
      .single();

    setSavingId(null);
    if (error) {
      toast({ title: "No se pudo guardar", description: error.message, variant: "destructive" });
      return;
    }
    setOrgMap((prev) => ({ ...prev, [docTypeId]: data as OrgRow }));
  };

  const makeDefault = async (docTypeId: string) => {
    // Desactiva default en otros (single-default por org via unique index parcial)
    const prevDefault = Object.values(orgMap).find((r) => r.is_default && r.document_type_id !== docTypeId);
    if (prevDefault) {
      await supabase
        .from("organization_document_types")
        .update({ is_default: false })
        .eq("organization_id", organizationId)
        .eq("document_type_id", prevDefault.document_type_id);
      setOrgMap((prev) => ({
        ...prev,
        [prevDefault.document_type_id]: { ...prevDefault, is_default: false },
      }));
    }
    await upsertRow(docTypeId, { is_enabled: true, is_default: true });
    toast({ title: "Default actualizado" });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-muted/30 text-xs text-muted-foreground">
        Activa los tipos de documento que tu organización emite. Marca uno como{" "}
        <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-3 w-3" /> default</span>{" "}
        para que el POS lo sugiera automáticamente. Solo los documentos con{" "}
        <Badge variant="outline" className="font-mono">código DIAN</Badge> requieren resolución vigente.
      </Card>

      {catalog.map((doc) => {
        const Icon = familyIcon(doc.family);
        const row = orgMap[doc.id];
        const enabled = row?.is_enabled ?? false;
        const isDefault = row?.is_default ?? false;
        const isSaving = savingId === doc.id;

        return (
          <Card key={doc.id} className={`p-3 transition ${enabled ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">{doc.label}</h3>
                  {doc.dian_code && (
                    <Badge variant="outline" className="text-[10px] font-mono h-5">
                      DIAN {doc.dian_code}
                    </Badge>
                  )}
                  {!doc.goes_to_dian && (
                    <Badge variant="secondary" className="text-[10px] h-5">Interno</Badge>
                  )}
                  {isDefault && (
                    <Badge className="text-[10px] h-5 gap-1">
                      <Star className="h-3 w-3 fill-current" /> Default POS
                    </Badge>
                  )}
                </div>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-1">
                  {doc.applies_to_modules.map((m) => (
                    <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m}</span>
                  ))}
                </div>

                {enabled && doc.requires_resolution && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Prefijo</Label>
                      <Input
                        value={row?.numbering_prefix ?? ""}
                        onChange={(e) => setOrgMap((prev) => ({ ...prev, [doc.id]: { ...row, document_type_id: doc.id, is_enabled: true, is_default: isDefault, numbering_prefix: e.target.value, numbering_from: row?.numbering_from ?? null, numbering_to: row?.numbering_to ?? null, numbering_current: row?.numbering_current ?? null } }))}
                        placeholder="SETP"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Desde</Label>
                      <Input
                        type="number"
                        value={row?.numbering_from ?? ""}
                        onChange={(e) => setOrgMap((prev) => ({ ...prev, [doc.id]: { ...row, document_type_id: doc.id, is_enabled: true, is_default: isDefault, numbering_prefix: row?.numbering_prefix ?? null, numbering_from: Number(e.target.value) || null, numbering_to: row?.numbering_to ?? null, numbering_current: row?.numbering_current ?? null } }))}
                        className="h-8 tabular-nums"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
                      <Input
                        type="number"
                        value={row?.numbering_to ?? ""}
                        onChange={(e) => setOrgMap((prev) => ({ ...prev, [doc.id]: { ...row, document_type_id: doc.id, is_enabled: true, is_default: isDefault, numbering_prefix: row?.numbering_prefix ?? null, numbering_from: row?.numbering_from ?? null, numbering_to: Number(e.target.value) || null, numbering_current: row?.numbering_current ?? null } }))}
                        className="h-8 tabular-nums"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Actual</Label>
                      <Input
                        type="number"
                        value={row?.numbering_current ?? ""}
                        onChange={(e) => setOrgMap((prev) => ({ ...prev, [doc.id]: { ...row, document_type_id: doc.id, is_enabled: true, is_default: isDefault, numbering_prefix: row?.numbering_prefix ?? null, numbering_from: row?.numbering_from ?? null, numbering_to: row?.numbering_to ?? null, numbering_current: Number(e.target.value) || null } }))}
                        className="h-8 tabular-nums"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px]" htmlFor={`enable-${doc.id}`}>
                    {enabled ? "Activo" : "Inactivo"}
                  </Label>
                  <Switch
                    id={`enable-${doc.id}`}
                    checked={enabled}
                    onCheckedChange={(v) => upsertRow(doc.id, { is_enabled: v, ...(v ? {} : { is_default: false }) })}
                    disabled={isSaving}
                  />
                </div>
                {enabled && !isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => makeDefault(doc.id)}
                    disabled={isSaving}
                    className="h-7 text-[11px]"
                  >
                    <Star className="h-3 w-3 mr-1" /> Marcar default
                  </Button>
                )}
                {enabled && doc.requires_resolution && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => upsertRow(doc.id, {
                      numbering_prefix: row?.numbering_prefix ?? null,
                      numbering_from: row?.numbering_from ?? null,
                      numbering_to: row?.numbering_to ?? null,
                      numbering_current: row?.numbering_current ?? null,
                    })}
                    disabled={isSaving}
                    className="h-7 text-[11px]"
                  >
                    <Save className="h-3 w-3 mr-1" /> Guardar numeración
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {catalog.length === 0 && (
        <Card className="p-8 text-center">
          <FileQuestion className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay tipos de documento en el catálogo. Contacta al equipo SistecPOS.
          </p>
        </Card>
      )}
    </div>
  );
}
