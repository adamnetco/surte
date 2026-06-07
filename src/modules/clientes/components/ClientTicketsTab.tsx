import { useEffect, useState, useMemo, useRef, Suspense, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MessageSquare, Paperclip, X, FileText, Image as ImageIcon, Video, Phone } from "lucide-react";
import { POS_MODULES } from "@/data/posModules";

const TicketChatView = lazy(() => import("./TicketChatView"));

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  module: string | null;
  whatsapp: string | null;
  video_url: string | null;
  admin_response: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
}

type TicketFilter = "all" | "open" | "resolved";

export default function ClientTicketsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [chatTicket, setChatTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketFilter>("all");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("client_tickets").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const openCount = useMemo(() => tickets.filter(t => t.status === "open").length, [tickets]);
  const filtered = useMemo(() => statusFilter === "all" ? tickets : tickets.filter(t => t.status === statusFilter), [tickets, statusFilter]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Solo se permiten imágenes (JPG, PNG, WebP) o PDF", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "El archivo no debe superar 5 MB", variant: "destructive" });
      return;
    }
    setAttachFile(file);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);
    const fd = new FormData(e.currentTarget);

    let attachment_url: string | null = null;
    if (attachFile) {
      const ext = attachFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ticket-attachments").upload(path, attachFile, { upsert: false });
      if (upErr) {
        toast({ title: "Error al subir archivo", description: upErr.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("ticket-attachments").getPublicUrl(path);
      attachment_url = urlData.publicUrl;
    }

    const { error } = await (supabase as any).from("client_tickets").insert({
      user_id: user.id,
      subject: fd.get("subject") as string,
      description: fd.get("description") as string,
      priority: fd.get("priority") as string,
      module: (fd.get("module") as string) || null,
      whatsapp: (fd.get("whatsapp") as string)?.trim() || null,
      video_url: (fd.get("video_url") as string)?.trim() || null,
      attachment_url,
    });

    if (error) toast({ title: "Error al crear ticket", variant: "destructive" });
    else { toast({ title: "Ticket creado ✅" }); setShowCreate(false); setAttachFile(null); load(); }
    setUploading(false);
  };

  const statusColor = (s: string) => s === "open" ? "bg-yellow-500 text-white" : s === "resolved" ? "bg-green-600 text-white" : "bg-muted";
  const statusLabel = (s: string) => s === "open" ? "Abierto" : s === "resolved" ? "Resuelto" : s;

  if (chatTicket) {
    return (
      <Suspense fallback={<div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
        <TicketChatView ticket={chatTicket} onBack={() => { setChatTicket(null); load(); }} />
      </Suspense>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Tickets de Soporte</h2>
          {openCount > 0 && <Badge className="bg-yellow-500 text-white">{openCount} abiertos</Badge>}
        </div>
        <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setAttachFile(null); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nuevo Ticket</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Crear Ticket de Soporte</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Módulo del Software *</Label>
                <select name="module" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecciona un módulo</option>
                  {POS_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><Label>Asunto *</Label><Input name="subject" required placeholder="Resumen breve del problema" /></div>
              <div>
                <Label>Prioridad</Label>
                <select name="priority" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div><Label>Descripción *</Label><Textarea name="description" rows={4} required placeholder="Describe tu problema con el mayor detalle posible..." /></div>
              <div>
                <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />WhatsApp (opcional)</Label>
                <div className="flex gap-2">
                  <Input value="+57" disabled className="w-16 text-center" />
                  <Input name="whatsapp" type="tel" placeholder="Número de WhatsApp" className="flex-1" />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />Video (opcional)</Label>
                <Input name="video_url" type="url" placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div>
                <Label>Adjuntar imagen o PDF (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-2">Máx 5 MB.</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
                {attachFile ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    {attachFile.type === "application/pdf" ? <FileText className="h-4 w-4 text-red-500" /> : <ImageIcon className="h-4 w-4 text-blue-500" />}
                    <span className="truncate flex-1">{attachFile.name}</span>
                    <button type="button" onClick={() => setAttachFile(null)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="mr-2 h-4 w-4" />Adjuntar archivo
                  </Button>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? "Enviando..." : "Enviar Ticket"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "open", "resolved"] as TicketFilter[]).map((f) => (
          <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)}>
            {f === "all" ? `Todos (${tickets.length})` : f === "open" ? `Abiertos (${openCount})` : "Resueltos"}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No tienes tickets aún.</p>
          </div>
        ) : filtered.map((t) => (
          <div key={t.id} onClick={() => setChatTicket(t)} className="cursor-pointer rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{t.subject}</h3>
                {t.attachment_url && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
                {t.video_url && <Video className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <Badge className={statusColor(t.status)}>{statusLabel(t.status)}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.module && <Badge variant="outline" className="mr-2 text-[10px] py-0">{t.module}</Badge>}
              {new Date(t.created_at).toLocaleDateString("es-CO")} · Prioridad: {t.priority}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
