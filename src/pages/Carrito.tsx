import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isWeekend } from "date-fns";
import { es } from "date-fns/locale";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { useCart } from "@/context/CartContext";
import { useAppSettings } from "@/hooks/useStore";
import { useAuth } from "@/context/AuthContext";
import { useAgent } from "@/context/AgentContext";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Minus, Plus, ShoppingCart, AlertTriangle, MessageCircle, Loader2, MapPin, ExternalLink, Ticket, X, CheckCircle2, CalendarIcon, Clock, Banknote, CreditCard, Truck, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trackPurchase } from "@/components/seo/Analytics";
import { mailService } from "@/utils/mailService";
import { orderConfirmationTemplate } from "@/utils/emailTemplates";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const NeighborhoodSearch = ({ zones, selectedId, onSelect }: { zones: any[]; selectedId: string; onSelect: (id: string) => void }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selectedZone = zones.find((z: any) => z.id === selectedId);
  const selectedCity = localStorage.getItem("surte_city") || "Bucaramanga";

  const filtered = zones.filter((z: any) => {
    const matchCity = z.city === selectedCity;
    const matchSearch = !search || z.neighborhood.toLowerCase().includes(search.toLowerCase());
    return matchCity && matchSearch;
  });

  const otherCityZones = search ? zones.filter((z: any) => z.city !== selectedCity && z.neighborhood.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MapPin size={14} className="text-accent" />
        <span className="text-xs font-medium text-muted-foreground">Barrio de entrega</span>
      </div>
      <input
        type="text"
        value={search || (selectedZone ? `${selectedZone.neighborhood} (${selectedZone.city})` : "")}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onSelect(""); }}
        onFocus={() => { setOpen(true); setSearch(""); }}
        placeholder="Escribe tu barrio..."
        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {open && (filtered.length > 0 || otherCityZones.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl max-h-48 overflow-y-auto z-50 shadow-lg">
          {filtered.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase">{selectedCity}</p>
          )}
          {filtered.map((z: any) => (
            <button
              key={z.id}
              onClick={() => { onSelect(z.id); setSearch(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors hover:bg-muted ${selectedId === z.id ? "bg-accent/10 text-accent font-medium" : "text-foreground"}`}
            >
              <span>{z.neighborhood}</span>
              <span className="text-xs text-muted-foreground">{formatPrice(z.delivery_price)}</span>
            </button>
          ))}
          {otherCityZones.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase border-t border-border">Otros municipios</p>
              {otherCityZones.slice(0, 10).map((z: any) => (
                <button
                  key={z.id}
                  onClick={() => { onSelect(z.id); setSearch(""); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors hover:bg-muted text-foreground"
                >
                  <span>{z.neighborhood} <span className="text-muted-foreground text-xs">({z.city})</span></span>
                  <span className="text-xs text-muted-foreground">{formatPrice(z.delivery_price)}</span>
                </button>
              ))}
            </>
          )}
          {filtered.length === 0 && otherCityZones.length === 0 && search && (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">No se encontró "{search}"</p>
          )}
        </div>
      )}
    </div>
  );
};

const Carrito = () => {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const { data: settings } = useAppSettings();
  const { user, isAgent } = useAuth();
  const { customer: agentCustomer, deliveryDate: agentDeliveryDate, clearAgent } = useAgent();
  const navigate = useNavigate();
  const minOrder = Number(settings?.min_order_amount || 40000);
  const meetsMinimum = totalPrice >= minOrder;
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", notes: "", neighborhood_id: "", countryCode: "+57" });
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [preferredDate, setPreferredDate] = useState<Date | undefined>();
  const [timeSlot, setTimeSlot] = useState<"mañana" | "tarde">("mañana");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const estimatedDays = settings?.estimated_delivery_days || "1-2";

  // Compute min delivery date (skip weekends)
  const getMinDeliveryDate = () => {
    const minDaysNum = parseInt(estimatedDays) || 1;
    let date = new Date();
    let added = 0;
    while (added < minDaysNum) {
      date = addDays(date, 1);
      if (!isWeekend(date)) added++;
    }
    return date;
  };

  const { data: shippingZones } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_zones").select("*").eq("is_active", true).order("city").order("neighborhood");
      if (error) throw error;
      return data;
    },
  });

  const handleZoneChange = (zoneId: string) => {
    setForm({ ...form, neighborhood_id: zoneId });
    const zone = shippingZones?.find((z: any) => z.id === zoneId);
    setDeliveryCost(zone ? Number(zone.delivery_price) : 0);
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();
      if (error || !data) { toast.error("Cupón no válido"); setValidatingCoupon(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error("Cupón expirado"); setValidatingCoupon(false); return; }
      if (data.max_uses && data.current_uses >= data.max_uses) { toast.error("Cupón agotado"); setValidatingCoupon(false); return; }
      if (data.min_order_amount && totalPrice < Number(data.min_order_amount)) {
        toast.error(`Pedido mínimo de ${formatPrice(Number(data.min_order_amount))} para este cupón`);
        setValidatingCoupon(false); return;
      }
      const disc = data.discount_type === "percentage"
        ? Math.round(totalPrice * Number(data.discount_value) / 100)
        : Number(data.discount_value);
      setCouponDiscount(disc);
      setAppliedCoupon(data);
      toast.success(`Cupón aplicado: -${formatPrice(disc)}`);
    } catch { toast.error("Error validando cupón"); }
    setValidatingCoupon(false);
  };

  const removeCoupon = () => { setCouponDiscount(0); setAppliedCoupon(null); setCouponCode(""); };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoadingGeo(false);
        toast.success("Ubicación capturada");
      },
      (err) => {
        setLoadingGeo(false);
        toast.error("No se pudo obtener la ubicación. Activa los permisos de ubicación.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFinalize = () => {
    if (!meetsMinimum) return;
    // Pre-fill form with agent customer data or logged-in user data
    if (isAgent && agentCustomer) {
      setForm({
        name: agentCustomer.fullName || "",
        phone: agentCustomer.phone || "",
        email: "",
        address: agentCustomer.address || "",
        notes: "",
        neighborhood_id: "",
        countryCode: "+57",
      });
      setPreferredDate(agentDeliveryDate);
    } else {
      setForm({
        name: user?.user_metadata?.full_name || "",
        phone: user?.user_metadata?.phone || "",
        email: user?.email || "",
        address: "",
        notes: "",
        neighborhood_id: "",
        countryCode: "+57",
      });
    }
    setGeoLocation(null);
    setShowForm(true);
  };

  const handleSubmitOrder = async () => {
    if (!form.name || !form.phone) {
      toast.error("Nombre y teléfono son obligatorios");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Email no válido");
      return;
    }
    const fullPhone = form.phone.startsWith("+") ? form.phone : `${form.countryCode}${form.phone.replace(/^0+/, "")}`;
    setSubmitting(true);
    try {
      const grandTotal = totalPrice + deliveryCost - couponDiscount;
      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          name: i.presentationName ? `${i.product.name} (${i.presentationName})` : i.product.name,
          price: i.unitPrice,
          quantity: i.quantity,
          presentation_id: i.presentationId || null,
          presentation_name: i.presentationName || null,
        })),
        customer_name: form.name,
        customer_phone: fullPhone,
        customer_email: form.email || null,
        customer_address: form.address,
        notes: form.notes,
        delivery_price: deliveryCost,
        delivery_zone_id: form.neighborhood_id || null,
        preferred_delivery_date: preferredDate ? format(preferredDate, "yyyy-MM-dd") : null,
        preferred_time_slot: timeSlot,
        payment_method: paymentMethod,
        geo_location: geoLocation ? `${geoLocation.lat},${geoLocation.lng}` : null,
      };

      const { data, error } = await supabase.functions.invoke("send-whatsapp-order", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Error de conexión al procesar pedido");
      if (data?.error) throw new Error(data.error);

      // Track purchase conversion
      trackPurchase(data.order_number, grandTotal, payload.items);

      // Send order confirmation email
      if (form.email) {
        const trackingUrl = `${window.location.origin}/pedido/${data.order_number}`;
        const emailHtml = orderConfirmationTemplate({
          orderNumber: data.order_number,
          customerName: form.name,
          items: items.map((i) => ({
            name: i.presentationName ? `${i.product.name} (${i.presentationName})` : i.product.name,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
          subtotal: totalPrice,
          deliveryCost,
          couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
          couponCode: appliedCoupon?.code,
          total: grandTotal,
          trackingUrl,
          deliveryDate: preferredDate ? format(preferredDate, "EEEE d 'de' MMMM", { locale: es }) : undefined,
          timeSlot,
          paymentMethod,
          address: form.address || undefined,
        });
        mailService.send({
          to: form.email,
          subject: `✅ Pedido #${data.order_number} confirmado — SURTÉ YA`,
          html: emailHtml,
        }).catch((err) => console.warn("Email confirmation failed:", err));
      }

      toast.success(`¡Pedido #${data.order_number} creado!`);

      // Build WhatsApp message
      const whatsappNumber = settings?.whatsapp_number || "573000000000";
      const trackingUrl = `${window.location.origin}/pedido/${data.order_number}`;
      const orderLines = items.map(
        (i) => `• ${i.quantity}x ${i.product.name} — ${formatPrice(i.unitPrice * i.quantity)}`
      );
      const whatsappMsg = [
        `🛒 *Pedido SURTÉ #${data.order_number}*`,
        "",
        `👤 ${form.name}`,
        `📱 ${form.phone}`,
        form.address ? `📍 ${form.address}` : "",
        form.notes ? `📝 ${form.notes}` : "",
        "",
        ...orderLines,
        "",
        `💰 Subtotal: ${formatPrice(totalPrice)}`,
        couponDiscount > 0 ? `🎟️ Cupón (${appliedCoupon?.code}): -${formatPrice(couponDiscount)}` : "",
        deliveryCost > 0 ? `🚚 Domicilio: ${formatPrice(deliveryCost)}` : "",
        `💰 *Total: ${formatPrice(grandTotal)}*`,
        "",
        preferredDate ? `📅 Entrega: ${format(preferredDate, "EEEE d MMM", { locale: es })} (${timeSlot === "mañana" ? "8am-12pm" : "2pm-6pm"})` : "",
        `💳 Pago: ${paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}`,
        "",
        `📦 Seguimiento: ${trackingUrl}`,
      ].filter(Boolean).join("\n");

      const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMsg)}`;
      
      // Increment coupon usage
      if (appliedCoupon) {
        await supabase.from("coupons").update({ current_uses: (appliedCoupon.current_uses || 0) + 1 }).eq("id", appliedCoupon.id);
      }

      clearCart();
      setShowForm(false);
      removeCoupon();

      // Open WhatsApp so customer confirms with the store
      window.open(waUrl, "_blank");

      // Navigate to tracking page
      navigate(`/pedido/${data.order_number}`);
    } catch (err: any) {
      toast.error(err.message || "Error al crear pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const grandTotal = Math.max(0, totalPrice + deliveryCost - couponDiscount);

  // Summary/CTA block (reused in mobile fixed bar and desktop sidebar)
  const SummaryBlock = ({ className = "" }: { className?: string }) => (
    <div className={className}>
      {/* Coupon input */}
      <div className="flex items-center gap-2 mb-3">
        {appliedCoupon ? (
          <div className="flex-1 flex items-center gap-1.5 bg-secondary/10 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="text-secondary" />
            <span className="text-xs font-medium text-secondary">{appliedCoupon.code}</span>
            <span className="text-xs text-secondary">-{formatPrice(couponDiscount)}</span>
            <button onClick={removeCoupon} className="ml-auto"><X size={14} className="text-muted-foreground" /></button>
          </div>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2">
              <Ticket size={14} className="text-muted-foreground" />
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Código cupón"
                className="flex-1 bg-transparent text-sm outline-none font-mono uppercase"
              />
            </div>
            <button
              onClick={applyCoupon}
              disabled={validatingCoupon || !couponCode.trim()}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {validatingCoupon ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="text-sm font-medium text-foreground">{formatPrice(totalPrice)}</span>
      </div>
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-secondary">Cupón</span>
          <span className="text-sm font-medium text-secondary">-{formatPrice(couponDiscount)}</span>
        </div>
      )}
      {deliveryCost > 0 && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">Domicilio</span>
          <span className="text-sm font-medium text-foreground">{formatPrice(deliveryCost)}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span className="text-xl font-heading font-bold text-foreground">{formatPrice(grandTotal)}</span>
      </div>
      <button
        onClick={handleFinalize}
        disabled={!meetsMinimum}
        className={`w-full flex items-center justify-center gap-2 font-heading font-semibold py-3.5 rounded-xl text-sm transition-all ${
          meetsMinimum ? "btn-surte" : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        <MessageCircle size={18} />
        Finalizar Pedido por WhatsApp
      </button>
    </div>
  );

  // Order form block
  const OrderFormBlock = () => (
    <AnimatePresence>
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="bg-card rounded-xl p-4 mb-4 space-y-3"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h3 className="font-heading font-semibold text-sm text-foreground">Datos del Pedido</h3>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" required />
          
          {/* Email */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">📧 Correo electrónico</span>
            </div>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tucorreo@email.com" type="email" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" />
            <p className="text-[10px] text-muted-foreground mt-0.5">Para confirmación y seguimiento de tu pedido</p>
          </div>

          {/* Phone with country code */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-muted-foreground">📱 WhatsApp *</span>
            </div>
            <div className="flex gap-1.5">
              <select
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                className="bg-muted rounded-lg px-2 py-2.5 text-sm outline-none w-[100px] shrink-0"
              >
                <option value="+57">🇨🇴 +57</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+58">🇻🇪 +58</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+51">🇵🇪 +51</option>
                <option value="+56">🇨🇱 +56</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+593">🇪🇨 +593</option>
                <option value="+507">🇵🇦 +507</option>
                <option value="+34">🇪🇸 +34</option>
              </select>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d]/g, "") })} placeholder="3001234567" className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" required inputMode="tel" />
            </div>
          </div>

          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección de entrega" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" />
          
          {/* Geolocation */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleGetLocation}
              disabled={loadingGeo}
              className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-2 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {loadingGeo ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
              {geoLocation ? "Actualizar ubicación" : "Añadir ubicación actual"}
            </button>
            {geoLocation && (
              <a
                href={`https://www.google.com/maps?q=${geoLocation.lat},${geoLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-accent font-medium hover:underline"
              >
                <MapPin size={12} /> Ver en mapa <ExternalLink size={10} />
              </a>
            )}
          </div>
          {geoLocation && (
            <p className="text-[10px] text-secondary font-medium bg-secondary/10 rounded-lg px-2 py-1">
              📍 Ubicación capturada: {geoLocation.lat.toFixed(6)}, {geoLocation.lng.toFixed(6)}
            </p>
          )}

          {shippingZones && shippingZones.length > 0 && (
            <NeighborhoodSearch
              zones={shippingZones}
              selectedId={form.neighborhood_id}
              onSelect={(zoneId) => handleZoneChange(zoneId)}
            />
          )}
          {deliveryCost > 0 && (
            <p className="text-xs text-accent font-medium">🚚 Domicilio: {formatPrice(deliveryCost)}</p>
          )}
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionales" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" rows={2} />

          {/* Delivery estimate badge */}
          <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
            <Truck size={14} className="text-accent" />
            <span className="text-xs font-medium text-foreground">Entrega en {estimatedDays} días hábiles</span>
          </div>

          {/* Preferred delivery date */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CalendarIcon size={14} className="text-accent" />
              <span className="text-xs font-medium text-muted-foreground">Fecha preferida de entrega</span>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between", !preferredDate && "text-muted-foreground")}>
                  {preferredDate ? format(preferredDate, "EEEE d 'de' MMMM", { locale: es }) : "Seleccionar fecha"}
                  <CalendarIcon size={14} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={preferredDate}
                  onSelect={setPreferredDate}
                  disabled={(date) => date < getMinDeliveryDate() || isWeekend(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time slot */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock size={14} className="text-accent" />
              <span className="text-xs font-medium text-muted-foreground">Horario preferido</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTimeSlot("mañana")}
                className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border", timeSlot === "mañana" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}
              >
                ☀️ Mañana (8-12)
              </button>
              <button
                onClick={() => setTimeSlot("tarde")}
                className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border", timeSlot === "tarde" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}
              >
                🌙 Tarde (2-6)
              </button>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Banknote size={14} className="text-accent" />
              <span className="text-xs font-medium text-muted-foreground">Método de pago</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod("efectivo")}
                className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border flex items-center justify-center gap-1.5", paymentMethod === "efectivo" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}
              >
                <Banknote size={14} /> Efectivo
              </button>
              <button
                onClick={() => setPaymentMethod("transferencia")}
                className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border flex items-center justify-center gap-1.5", paymentMethod === "transferencia" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}
              >
                <CreditCard size={14} /> Transferencia
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 bg-muted rounded-xl py-2.5 text-sm text-muted-foreground font-medium">Cancelar</button>
            <button onClick={handleSubmitOrder} disabled={submitting} className="flex-1 btn-surte py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              {submitting ? "Enviando..." : "Confirmar"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Product list block
  const ProductListBlock = () => (
    <>
      <AnimatePresence>
        {items.map((item) => {
          const lineId = `${item.product.id}${item.presentationId ? `__${item.presentationId}` : ""}`;
          return (
            <motion.div
              key={lineId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 bg-card rounded-xl p-3 mb-3"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {item.product.image_url ? (
                  <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-heading font-bold text-muted-foreground/40">
                    {item.product.name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground truncate">{item.product.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {item.presentationName || item.product.unit} · {formatPrice(item.unitPrice)} c/u
                </p>
                <p className="text-sm font-heading font-bold text-foreground mt-0.5">
                  {formatPrice(item.unitPrice * item.quantity)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.presentationId)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground">
                  <Minus size={14} />
                </button>
                <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                <button
                  onClick={() => {
                    if (item.quantity < item.product.stock) {
                      updateQuantity(item.product.id, item.quantity + 1, item.presentationId);
                    } else {
                      toast.error(`Stock máximo: ${item.product.stock}`);
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-accent text-accent-foreground flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
                <button onClick={() => removeItem(item.product.id, item.presentationId)} className="w-7 h-7 rounded-lg flex items-center justify-center text-destructive ml-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!meetsMinimum && (
        <div className="flex items-start gap-2 bg-surte-naranja/10 border border-surte-naranja/30 rounded-xl p-3 mb-4">
          <AlertTriangle size={18} className="text-surte-naranja shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Pedido mínimo: {formatPrice(minOrder)}</p>
            <p className="text-xs text-muted-foreground">Te faltan {formatPrice(minOrder - totalPrice)}</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <TopBar />
      <main className="px-4 py-4 max-w-7xl mx-auto">
        <SeoBreadcrumbs items={[{ label: "Carrito" }]} className="mb-2" />
        <h1 className="text-xl lg:text-2xl font-heading font-bold text-foreground mb-4">Tu Carrito</h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart size={48} strokeWidth={1.2} className="mb-3 opacity-40" />
            <p className="font-heading font-semibold text-lg mb-1">Carrito vacío</p>
            <p className="text-sm">Agrega productos desde el catálogo</p>
          </div>
        ) : (
          <>
            {/* Desktop: two-column layout */}
            <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
              {/* Left: products + form */}
              <div className="min-w-0">
                <ProductListBlock />
                <OrderFormBlock />
              </div>

              {/* Right: sticky summary (desktop only) */}
              <div className="hidden lg:block">
                <div className="sticky top-24">
                  <div className="bg-card rounded-xl p-5 border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
                    <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
                      <ShoppingCart size={18} className="text-accent" />
                      Resumen ({items.length} {items.length === 1 ? "producto" : "productos"})
                    </h3>
                    <SummaryBlock />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Mobile: fixed bottom bar (hidden on lg+) */}
      {items.length > 0 && !showForm && (
        <div className="fixed bottom-[68px] left-0 right-0 bg-card border-t border-border px-4 py-3 z-40 lg:hidden" style={{ boxShadow: "var(--shadow-nav)" }}>
          <SummaryBlock />
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default Carrito;