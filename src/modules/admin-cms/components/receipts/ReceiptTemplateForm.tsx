import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import type { ReceiptTemplate } from "../../hooks/usePosReceiptTemplates";
import { useUpdateReceiptTemplate } from "../../hooks/usePosReceiptTemplates";
import { SECTION_LABEL, type SectionType } from "../../lib/receiptLayoutSchema";

interface Props {
  template: ReceiptTemplate;
  onLocalChange: (next: ReceiptTemplate) => void;
}

function SortableRow({
  section,
  onToggle,
}: {
  section: any;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2"
    >
      <button
        type="button"
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Reordenar sección"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm">{SECTION_LABEL[section.type as SectionType] ?? section.type}</span>
      <button
        type="button"
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground"
        aria-label={section.visible ? "Ocultar sección" : "Mostrar sección"}
      >
        {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
      </button>
    </li>
  );
}

export function ReceiptTemplateForm({ template, onLocalChange }: Props) {
  const [draft, setDraft] = useState<ReceiptTemplate>(template);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateReceiptTemplate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Reset draft when switching to a different template (id changes)
  const lastIdRef = useRef(template.id);
  useEffect(() => {
    if (lastIdRef.current !== template.id) {
      setDraft(template);
      lastIdRef.current = template.id;
    }
  }, [template]);

  // Notify parent for live preview
  useEffect(() => onLocalChange(draft), [draft, onLocalChange]);

  // Autosave with debounce
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await update.mutateAsync({
          id: draft.id,
          name: draft.name,
          paper_width_mm: draft.paper_width_mm,
          font_size_pt: draft.font_size_pt,
          copies: draft.copies,
          show_logo: draft.show_logo,
          show_qr_pago: draft.show_qr_pago,
          show_nit: draft.show_nit,
          header_text: draft.header_text,
          footer_text: draft.footer_text,
          layout: draft.layout,
        });
        setSavedAt(Date.now());
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const sections = useMemo(() => draft.layout?.sections ?? [], [draft.layout]);

  function patch<K extends keyof ReceiptTemplate>(key: K, value: ReceiptTemplate[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function patchLayout(next: any[]) {
    setDraft((d) => ({ ...d, layout: { ...d.layout, sections: next } }));
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s: any) => s.id === active.id);
    const newIdx = sections.findIndex((s: any) => s.id === over.id);
    patchLayout(arrayMove(sections, oldIdx, newIdx));
  }
  function toggleVisible(id: string) {
    patchLayout(sections.map((s: any) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Plantilla</h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </>
          ) : savedAt ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" /> Guardado
            </>
          ) : null}
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Nombre</Label>
          <Input id="tpl-name" value={draft.name} onChange={(e) => patch("name", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Ancho del papel</Label>
            <Select
              value={String(draft.paper_width_mm)}
              onValueChange={(v) => patch("paper_width_mm", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="58">58 mm</SelectItem>
                <SelectItem value="80">80 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Copias</Label>
            <Select value={String(draft.copies)} onValueChange={(v) => patch("copies", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tamaño de fuente: {draft.font_size_pt}pt</Label>
          <Slider
            min={8}
            max={14}
            step={1}
            value={[draft.font_size_pt]}
            onValueChange={([v]) => patch("font_size_pt", v)}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Visibilidad</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-logo">Mostrar logo</Label>
          <Switch id="show-logo" checked={draft.show_logo} onCheckedChange={(v) => patch("show_logo", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-nit">Mostrar NIT</Label>
          <Switch id="show-nit" checked={draft.show_nit} onCheckedChange={(v) => patch("show_nit", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-qr">QR de pago</Label>
          <Switch id="show-qr" checked={draft.show_qr_pago} onCheckedChange={(v) => patch("show_qr_pago", v)} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold">Mensajes</h3>
        <div className="space-y-1.5">
          <Label htmlFor="header">Encabezado</Label>
          <Input id="header" placeholder="Opcional"
            value={draft.header_text ?? ""}
            onChange={(e) => patch("header_text", e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="footer">Pie de página</Label>
          <Input id="footer"
            value={draft.footer_text ?? ""}
            onChange={(e) => patch("footer_text", e.target.value || null)} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Secciones</h3>
          <span className="text-xs text-muted-foreground">Arrastra para reordenar</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {sections.map((s: any) => (
                <SortableRow key={s.id} section={s} onToggle={() => toggleVisible(s.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
}
