/**
 * SubdomainPreview — input de slug con vista previa en vivo y check de
 * disponibilidad contra public.organizations.
 */
import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESERVED = new Set([
  "admin", "app", "www", "api", "mi", "pos", "blog", "help", "soporte",
  "sistecpos", "core", "auth", "cdn", "static", "mail",
]);

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export type SlugStatus = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onStatusChange?: (status: SlugStatus) => void;
  /** Slug actual (al editar una tienda existente). Se considera disponible. */
  currentSlug?: string;
  autoFocus?: boolean;
}

export function SubdomainPreview({ value, onChange, onStatusChange, currentSlug, autoFocus }: Props) {
  const [status, setStatus] = useState<SlugStatus>("idle");

  useEffect(() => {
    const slug = slugify(value);
    if (!slug || slug.length < 3) {
      setStatus("idle");
      onStatusChange?.("idle");
      return;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
      setStatus("invalid");
      onStatusChange?.("invalid");
      return;
    }
    if (RESERVED.has(slug)) {
      setStatus("reserved");
      onStatusChange?.("reserved");
      return;
    }
    if (currentSlug && slug === currentSlug) {
      setStatus("available");
      onStatusChange?.("available");
      return;
    }
    setStatus("checking");
    onStatusChange?.("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
      const next: SlugStatus = data ? "taken" : "available";
      setStatus(next);
      onStatusChange?.(next);
    }, 350);
    return () => clearTimeout(t);
  }, [value, currentSlug, onStatusChange]);

  const slug = slugify(value);

  return (
    <div className="space-y-2">
      <Label htmlFor="slug-input" className="text-sm font-medium">
        Dirección web de tu tienda
      </Label>
      <div className="relative">
        <Input
          id="slug-input"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(slugify(e.target.value))}
          placeholder="minegocio"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          className="h-12 pr-10 text-base"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === "available" && <Check className="h-5 w-5 text-success" />}
          {(status === "taken" || status === "reserved" || status === "invalid") && (
            <X className="h-5 w-5 text-destructive" />
          )}
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm flex items-baseline gap-1">
        <span className="text-muted-foreground">https://</span>
        <span className="font-mono font-semibold text-foreground">
          {slug || "tu-tienda"}
        </span>
        <span className="text-muted-foreground">.sistecpos.com</span>
      </div>

      <p className="text-xs min-h-[1rem]">
        {status === "available" && <span className="text-success">Disponible — esta será la URL de tu tienda.</span>}
        {status === "taken" && <span className="text-destructive">Esta dirección ya está en uso. Prueba con otra.</span>}
        {status === "reserved" && <span className="text-destructive">Esta palabra está reservada por el sistema.</span>}
        {status === "invalid" && <span className="text-destructive">Usa solo letras, números y guiones. Debe empezar por letra.</span>}
        {status === "idle" && <span className="text-muted-foreground">Mínimo 3 caracteres. Solo letras, números y guiones.</span>}
        {status === "checking" && <span className="text-muted-foreground">Comprobando disponibilidad…</span>}
      </p>
    </div>
  );
}
