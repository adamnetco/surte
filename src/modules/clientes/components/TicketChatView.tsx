import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Paperclip, Bot, User, ShieldCheck, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  attachment_url: string | null;
  created_at: string;
}

interface TicketInfo {
  id: string;
  subject: string;
  status: string;
  module: string | null;
  priority: string;
}

interface Props {
  ticket: TicketInfo;
  onBack: () => void;
  ticketSource?: "client" | "reseller";
  senderRole?: string;
}

const roleConfig: Record<string, { label: string; icon: typeof User; className: string }> = {
  customer: { label: "Tú", icon: User, className: "bg-primary text-primary-foreground" },
  admin: { label: "Soporte", icon: ShieldCheck, className: "bg-green-600 text-white" },
  ai_agent: { label: "Asistente IA", icon: Bot, className: "bg-violet-600 text-white" },
};

export default function TicketChatView({ ticket, onBack, ticketSource = "client", senderRole = "customer" }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (supabase as any).from("ticket_messages").select("*")
      .eq("ticket_id", ticket.id).order("created_at", { ascending: true })
      .then(({ data }: any) => {
        setMessages((data as TicketMessage[]) ?? []);
        setLoading(false);
      });
  }, [ticket.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticket.id}` },
        (payload) => {
          const msg = payload.new as TicketMessage;
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticket.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Solo imágenes (JPG, PNG, WebP) o PDF", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Máximo 5 MB", variant: "destructive" });
      return;
    }
    setAttachFile(file);
  };

  const handleSend = async () => {
    if (!user || (!text.trim() && !attachFile)) return;
    setSending(true);
    let attachment_url: string | null = null;
    if (attachFile) {
      const ext = attachFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ticket-attachments").upload(path, attachFile, { upsert: false });
      if (upErr) {
        toast({ title: "Error al subir archivo", variant: "destructive" });
        setSending(false); return;
      }
      const { data: urlData } = supabase.storage.from("ticket-attachments").getPublicUrl(path);
      attachment_url = urlData.publicUrl;
    }

    const { error } = await (supabase as any).from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: senderRole,
      content: text.trim() || (attachment_url ? "📎 Archivo adjunto" : ""),
      attachment_url,
      ticket_source: ticketSource,
    });

    if (error) toast({ title: "Error al enviar mensaje", variant: "destructive" });
    else { setText(""); setAttachFile(null); }
    setSending(false);
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|webp)$/i.test(url);
  const statusLabel = (s: string) => s === "open" ? "Abierto" : s === "resolved" ? "Resuelto" : s;

  return (
    <div className="flex flex-col h-[70vh] max-h-[700px]">
      <div className="flex items-center gap-3 pb-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{ticket.subject}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {ticket.module && <Badge variant="outline" className="text-[10px] py-0">{ticket.module}</Badge>}
            <Badge className={ticket.status === "open" ? "bg-yellow-500 text-white" : "bg-green-600 text-white"}>
              {statusLabel(ticket.status)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-3/4" />)}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">No hay mensajes aún. Escribe el primero.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const rc = roleConfig[msg.sender_role] ?? roleConfig.customer;
            const Icon = rc.icon;
            return (
              <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "")}>
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-full shrink-0", rc.className)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className={cn("max-w-[75%] rounded-lg p-3 text-sm", isMe ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {!isMe && <p className="text-[10px] font-medium mb-1 opacity-70">{rc.label}</p>}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.attachment_url && (
                    <div className="mt-2">
                      {isImage(msg.attachment_url) ? (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.attachment_url} alt="Adjunto" className="max-h-40 rounded border object-contain" />
                        </a>
                      ) : (
                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs underline">
                          <FileText className="h-3 w-3" />Ver archivo
                        </a>
                      )}
                    </div>
                  )}
                  <p className={cn("text-[10px] mt-1", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                    {new Date(msg.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t pt-3 shrink-0 space-y-2">
        {attachFile && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
            {attachFile.type === "application/pdf" ? <FileText className="h-3.5 w-3.5 text-red-500" /> : <ImageIcon className="h-3.5 w-3.5 text-blue-500" />}
            <span className="truncate flex-1 text-xs">{attachFile.name}</span>
            <button onClick={() => setAttachFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} className="shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Escribe un mensaje..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || (!text.trim() && !attachFile)} size="icon" className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
