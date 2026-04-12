import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAgent, type AgentCustomer } from "@/context/AgentContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Search, UserCheck, X, CalendarIcon, Edit2, Phone, MapPin,
  Building2, Hash, ChevronDown, ChevronUp, Save, Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const AgentBar = () => {
  const { isAgent, user } = useAuth();
  const { customer, setCustomer, deliveryDate, setDeliveryDate, clearAgent } = useAgent();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<AgentCustomer>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  if (!isAgent) return null;

  const search = async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const stripped = q.replace(/\D/g, "");
    const isNumeric = stripped.length >= 3;

    let query = supabase.from("profiles").select("*");

    if (isNumeric) {
      query = query.or(`phone.ilike.%${stripped}%,customer_code.ilike.%${q}%`);
    } else {
      query = query.or(`full_name.ilike.%${q}%,business_name.ilike.%${q}%,customer_code.ilike.%${q}%`);
    }

    const { data } = await query.limit(8);
    setResults(data || []);
    setSearching(false);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const selectCustomer = (p: any) => {
    const c: AgentCustomer = {
      profileId: p.id,
      userId: p.user_id,
      customerCode: p.customer_code || "—",
      fullName: p.full_name || "Sin nombre",
      phone: p.phone,
      address: p.address,
      city: p.city,
      businessType: p.business_type || "detal",
      businessName: p.business_name,
    };
    setCustomer(c);
    setQuery("");
    setResults([]);
    setExpanded(true);
    toast.success(`Cliente seleccionado: ${c.fullName}`);
  };

  const handleSaveEdit = async () => {
    if (!customer) return;
    const updates: any = {};
    if (editData.fullName !== undefined) updates.full_name = editData.fullName;
    if (editData.phone !== undefined) updates.phone = editData.phone;
    if (editData.address !== undefined) updates.address = editData.address;
    if (editData.city !== undefined) updates.city = editData.city;
    if (editData.businessName !== undefined) updates.business_name = editData.businessName;

    if (Object.keys(updates).length === 0) { setEditing(false); return; }

    const { error } = await supabase.from("profiles").update(updates).eq("id", customer.profileId);
    if (error) { toast.error("Error al actualizar"); return; }

    setCustomer({ ...customer, ...editData });
    setEditData({});
    setEditing(false);
    toast.success("Datos actualizados");
  };

  const businessLabel: Record<string, string> = {
    casa: "🏠 Casa",
    detal: "🛒 Detal",
    horeca: "🍽️ HORECA",
    minimercado: "🏪 Minimercado",
    distribuidor: "📦 Distribuidor",
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      {/* Main bar */}
      <div className="bg-primary text-primary-foreground px-3 py-2">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Briefcase size={16} className="shrink-0 opacity-80" />
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Agente</span>

          {!customer ? (
            <div className="flex-1 relative">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Buscar cliente por nombre, tel, código..."
                  className="w-full bg-white/15 backdrop-blur-sm text-primary-foreground placeholder:text-primary-foreground/50 text-xs rounded-lg pl-7 pr-3 py-1.5 outline-none focus:bg-white/25 transition-colors"
                />
              </div>
              {/* Results dropdown */}
              {results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-64 overflow-y-auto z-50">
                  {results.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectCustomer(p)}
                      className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{p.full_name || "Sin nombre"}</span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.customer_code || "—"}</span>
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        {p.phone && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone size={10} />{p.phone}</span>}
                        {p.business_name && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Building2 size={10} />{p.business_name}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searching && <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl p-3 text-center text-xs text-muted-foreground">Buscando...</div>}
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <UserCheck size={14} className="shrink-0 text-secondary" />
              <span className="text-xs font-medium truncate">{customer.fullName}</span>
              <span className="text-[10px] font-mono opacity-60">{customer.customerCode}</span>
              <button onClick={() => setExpanded(!expanded)} className="ml-auto p-1 rounded hover:bg-white/10">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button onClick={clearAgent} className="p-1 rounded hover:bg-white/10">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {customer && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card border-b border-border overflow-hidden"
          >
            <div className="max-w-lg mx-auto px-3 py-3 space-y-3">
              {/* Customer info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {editing ? (
                  <>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase mb-0.5 block">Nombre</label>
                      <input
                        value={editData.fullName ?? customer.fullName}
                        onChange={(e) => setEditData({ ...editData, fullName: e.target.value })}
                        className="w-full bg-muted rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase mb-0.5 block">Teléfono</label>
                      <input
                        value={editData.phone ?? customer.phone ?? ""}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                        className="w-full bg-muted rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground uppercase mb-0.5 block">Dirección</label>
                      <input
                        value={editData.address ?? customer.address ?? ""}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        className="w-full bg-muted rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase mb-0.5 block">Ciudad</label>
                      <input
                        value={editData.city ?? customer.city ?? ""}
                        onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                        className="w-full bg-muted rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase mb-0.5 block">Razón social</label>
                      <input
                        value={editData.businessName ?? customer.businessName ?? ""}
                        onChange={(e) => setEditData({ ...editData, businessName: e.target.value })}
                        className="w-full bg-muted rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Hash size={12} className="text-muted-foreground" />
                      <span className="font-mono">{customer.customerCode}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Building2 size={12} className="text-muted-foreground" />
                      <span>{businessLabel[customer.businessType] || customer.businessType}</span>
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <MapPin size={12} className="text-muted-foreground" />
                        <span className="truncate">{customer.address}{customer.city ? `, ${customer.city}` : ""}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions row */}
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button onClick={handleSaveEdit} className="flex items-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 font-medium">
                      <Save size={12} /> Guardar
                    </button>
                    <button onClick={() => { setEditing(false); setEditData({}); }} className="text-xs text-muted-foreground px-2 py-1.5">
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Edit2 size={12} /> Editar datos
                  </button>
                )}

                <div className="ml-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 text-xs bg-muted rounded-lg px-3 py-1.5 font-medium hover:bg-muted/80 transition-colors">
                        <CalendarIcon size={12} className="text-accent" />
                        <span>{format(deliveryDate, "EEE d MMM", { locale: es })}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={deliveryDate}
                        onSelect={(d) => d && setDeliveryDate(d)}
                        disabled={(d) => d < new Date()}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AgentBar;
