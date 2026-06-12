import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, isWeekend } from "date-fns";
import { es } from "date-fns/locale";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import { useCart } from "@/modules/cart/context/CartContext";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useAgent } from "@/modules/pos/context/AgentContext";
import { supabase } from "@/integrations/supabase/client";
import { useTenantOrgId } from "@/modules/tenant/lib/useTenantSite";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Trash2, Minus, Plus, ShoppingCart, AlertTriangle, MessageCircle, Loader2, MapPin, ExternalLink, Ticket, X, CheckCircle2, CalendarIcon, Clock, Banknote, CreditCard, Truck, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trackPurchase } from "@/modules/marketing/seo/Analytics";
import { mailService } from "@/modules/email/mailService";
import { orderConfirmationTemplate } from "@/modules/email/emailTemplates";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

/* ── Neighborhood typeahead — extracted to its own stable component ── */
const NeighborhoodSearch = ({ zones, selectedId, onSelect }: { zones: any[]; selectedId: string; onSelect: (id: string) => void }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selectedZone = zones.find((z: any) => z.id === selectedId);
  const selectedCity = localStorage.getItem("tenant_city") || "";

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
        <label className="text-xs font-medium text-muted-foreground">Barrio de entrega</label>
      </div>
      <input
        type="text"
        value={search || (selectedZone ? `${selectedZone.neighborhood} (${selectedZone.city})` : "")}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); if (!e.target.value) onSelect(""); }}
        onFocus={() => { setOpen(true); setSearch(""); }}
        placeholder="Escribe tu barrio..."
        autoComplete="off"
        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
      />
      {open && (filtered.length > 0 || otherCityZones.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl max-h-48 overflow-y-auto z-50 shadow-lg">
          {filtered.length > 0 && (
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase">{selectedCity}</p>
          )}
          {filtered.map((z: any) => (
            <button
              key={z.id}
              type="button"
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
                  type="button"
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

const COUNTRY_CODES = [
  { code: "+57", flag: "🇨🇴" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+58", flag: "🇻🇪" },
  { code: "+52", flag: "🇲🇽" },
  { code: "+51", flag: "🇵🇪" },
  { code: "+56", flag: "🇨🇱" },
  { code: "+54", flag: "🇦🇷" },
  { code: "+593", flag: "🇪🇨" },
  { code: "+507", flag: "🇵🇦" },
  { code: "+34", flag: "🇪🇸" },
];

const Carrito = () => {
  const { items, removeItem, updateQuantity, totalPrice, clearCart, cartToken, attachPhone } = useCart();
  const tenantOrgId = useTenantOrgId();
  const { data: settings } = useAppSettings();
  const { user, isAgent } = useAuth();
  const { customer: agentCustomer, deliveryDate: agentDeliveryDate, clearAgent } = useAgent();
  const navigate = useNavigate();
  const minOrder = Number(settings?.min_order_amount || 40000);
  const meetsMinimum = totalPrice >= minOrder;
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Split form state into individual primitives so each input only re-renders when its own value changes.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [countryCode, setCountryCode] = useState("+57");

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

  // Checkout visibility toggles (admin-managed). Default: all visible (true) unless explicitly "false".
  const showDeliveryDate = settings?.checkout_show_delivery_date !== "false";
  const showTimeSlot = settings?.checkout_show_time_slot !== "false";
  const showPaymentMethod = settings?.checkout_show_payment_method !== "false";
  const showGeolocation = settings?.checkout_show_geolocation !== "false";

  const getMinDeliveryDate = useCallback(() => {
    const minDaysNum = parseInt(estimatedDays) || 1;
    let date = new Date();
    let added = 0;
    while (added < minDaysNum) {
      date = addDays(date, 1);
      if (!isWeekend(date)) added++;
    }
    return date;
  }, [estimatedDays]);

  const { data: shippingZones } = useQuery({
    queryKey: ["shipping-zones", tenantOrgId],
    queryFn: async () => {
      let q: any = supabase.from("shipping_zones").select("*").eq("is_active", true).order("city").order("neighborhood");
      if (tenantOrgId) q = q.eq("organization_id", tenantOrgId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: municipalitiesCfg } = useQuery({
    queryKey: ["municipalities-free-shipping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipality_settings")
        .select("city, free_shipping_enabled, free_shipping_threshold")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const selectedZone = shippingZones?.find((z: any) => z.id === neighborhoodId);
  const cityCfg = selectedZone
    ? municipalitiesCfg?.find((m: any) => m.city === selectedZone.city)
    : null;
  const freeShippingActive = !!(cityCfg?.free_shipping_enabled && totalPrice >= Number(cityCfg.free_shipping_threshold || 0));
  const finalDeliveryCost = freeShippingActive ? 0 : deliveryCost;
  const freeShippingMissing = cityCfg?.free_shipping_enabled
    ? Math.max(0, Number(cityCfg.free_shipping_threshold || 0) - totalPrice)
    : 0;

  const handleZoneChange = useCallback((zoneId: string) => {
    setNeighborhoodId(zoneId);
    const zone = shippingZones?.find((z: any) => z.id === zoneId);
    setDeliveryCost(zone ? Number(zone.delivery_price) : 0);
  }, [shippingZones]);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase.rpc("validate_coupon", {
        _code: couponCode.toUpperCase().trim(),
        _order_total: totalPrice,
      });
      if (error || !data || !data[0]) {
        const msg = error?.message || "";
        if (msg.includes("expired_coupon")) toast.error("Cupón expirado");
        else if (msg.includes("exhausted_coupon")) toast.error("Cupón agotado");
        else if (msg.includes("min_order_not_met")) toast.error("Pedido mínimo no alcanzado para este cupón");
        else toast.error("Cupón no válido");
        setValidatingCoupon(false);
        return;
      }
      const row = data[0];
      const disc = Number(row.discount_amount);
      setCouponDiscount(disc);
      setAppliedCoupon({ id: row.id, code: row.code });
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
      () => {
        setLoadingGeo(false);
        toast.error("No se pudo obtener la ubicación. Activa los permisos.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFinalize = () => {
    if (!meetsMinimum) return;
    if (isAgent && agentCustomer) {
      setName(agentCustomer.fullName || "");
      setPhone(agentCustomer.phone || "");
      setEmail("");
      setAddress(agentCustomer.address || "");
      setNotes("");
      setNeighborhoodId("");
      setCountryCode("+57");
      setPreferredDate(agentDeliveryDate);
    } else {
      setName(user?.user_metadata?.full_name || "");
      setPhone(user?.user_metadata?.phone || "");
      setEmail(user?.email || "");
      setAddress("");
      setNotes("");
      setNeighborhoodId("");
      setCountryCode("+57");
    }
    setGeoLocation(null);
    setShowForm(true);
    // Smooth-scroll to form on mobile
    setTimeout(() => {
      document.getElementById("checkout-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSubmitOrder = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Nombre y teléfono son obligatorios");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email no válido");
      return;
    }
    const fullPhone = phone.startsWith("+") ? phone : `${countryCode}${phone.replace(/^0+/, "")}`;
    attachPhone(fullPhone);
    setSubmitting(true);
    try {
      const grandTotal = totalPrice + finalDeliveryCost - couponDiscount;
      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          name: i.presentationName ? `${i.product.name} (${i.presentationName})` : i.product.name,
          price: i.unitPrice,
          quantity: i.quantity,
          presentation_id: i.presentationId || null,
          presentation_name: i.presentationName || null,
        })),
        customer_name: name,
        customer_phone: fullPhone,
        customer_email: email || null,
        customer_address: address,
        notes,
        delivery_price: finalDeliveryCost,
        delivery_zone_id: neighborhoodId || null,
        preferred_delivery_date: preferredDate ? format(preferredDate, "yyyy-MM-dd") : null,
        preferred_time_slot: timeSlot,
        payment_method: paymentMethod,
        geo_location: geoLocation ? `${geoLocation.lat},${geoLocation.lng}` : null,
        agent_id: isAgent ? user?.id : null,
        customer_profile_id: isAgent && agentCustomer ? agentCustomer.profileId : null,
      };

      const { data, error } = await supabase.functions.invoke("send-whatsapp-order", { body: payload });

      if (error) throw new Error(error.message || "Error de conexión al procesar pedido");
      if (data?.error) throw new Error(data.error);

      trackPurchase(data.order_number, grandTotal, payload.items);

      if (email) {
        const trackingUrl = `${window.location.origin}/pedido/${data.order_number}`;
        const emailHtml = orderConfirmationTemplate({
          orderNumber: data.order_number,
          customerName: name,
          items: items.map((i) => ({
            name: i.presentationName ? `${i.product.name} (${i.presentationName})` : i.product.name,
            quantity: i.quantity,
            price: i.unitPrice,
          })),
          subtotal: totalPrice,
          deliveryCost: finalDeliveryCost,
          couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
          couponCode: appliedCoupon?.code,
          total: grandTotal,
          trackingUrl,
          deliveryDate: preferredDate ? format(preferredDate, "EEEE d 'de' MMMM", { locale: es }) : undefined,
          timeSlot,
          paymentMethod,
          address: address || undefined,
        });
        mailService.send({
          to: email,
          subject: `Pedido #${data.order_number} confirmado${settings?.store_name ? ` — ${settings.store_name}` : ""}`,
          html: emailHtml,
        }).catch((err) => console.warn("Email confirmation failed:", err));
      }

      toast.success(`¡Pedido #${data.order_number} creado!`);

      const whatsappNumber = settings?.whatsapp_number || "573000000000";
      const trackingUrl = `${window.location.origin}/pedido/${data.order_number}`;
      const orderLines = items.map(
        (i) => `• ${i.quantity}x ${i.product.name} — ${formatPrice(i.unitPrice * i.quantity)}`
      );
      const whatsappMsg = [
        `🛒 *Pedido SURTÉ #${data.order_number}*`,
        isAgent && agentCustomer ? `🧑‍💼 *Agente:* ${user?.user_metadata?.full_name || "Agente"} | Cliente: ${agentCustomer.customerCode}` : "",
        "",
        `👤 ${name}`,
        `📱 ${fullPhone}`,
        address ? `📍 ${address}` : "",
        notes ? `📝 ${notes}` : "",
        "",
        ...orderLines,
        "",
        `💰 Subtotal: ${formatPrice(totalPrice)}`,
        couponDiscount > 0 ? `🎟️ Cupón (${appliedCoupon?.code}): -${formatPrice(couponDiscount)}` : "",
        finalDeliveryCost > 0 ? `🚚 Domicilio: ${formatPrice(finalDeliveryCost)}` : (freeShippingActive ? `🚚 Domicilio: GRATIS 🎉` : ""),
        `💰 *Total: ${formatPrice(grandTotal)}*`,
        "",
        preferredDate ? `📅 Entrega: ${format(preferredDate, "EEEE d MMM", { locale: es })} (${timeSlot === "mañana" ? "8am-12pm" : "2pm-6pm"})` : "",
        `💳 Pago: ${paymentMethod === "efectivo" ? "Efectivo" : "Transferencia"}`,
        "",
        `📦 Seguimiento: ${trackingUrl}`,
      ].filter(Boolean).join("\n");

      // Append cart_token so the WhatsApp Flow webhook can resolve the cart
      const waText = `${whatsappMsg}\n\nCART:${cartToken}`;
      const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waText)}`;

      if (appliedCoupon) {
        await supabase.rpc("redeem_coupon", { _coupon_id: appliedCoupon.id });
      }

      // Mark the persistent cart as completed (best-effort, non-blocking)
      try { await supabase.rpc("complete_persistent_cart", { _cart_token: cartToken }); } catch { /* ignore */ }

      clearCart();
      if (isAgent) clearAgent();
      setShowForm(false);
      removeCoupon();

      // Skip WhatsApp window when agent chose "register only"
      if (!(window as any).__skipWhatsApp) {
        window.open(waUrl, "_blank");
      }
      navigate(`/pedido/${data.order_number}`);
    } catch (err: any) {
      toast.error(err.message || "Error al crear pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const grandTotal = Math.max(0, totalPrice + finalDeliveryCost - couponDiscount);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <TopBar />
      <main className="px-4 py-4 max-w-7xl mx-auto">
        <SeoBreadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Carrito" }]} className="mb-2" />
        <button
          onClick={() => navigate("/catalogo")}
          className="flex items-center gap-1.5 text-sm text-accent font-medium mb-3 active:scale-95"
        >
          <ExternalLink size={14} className="rotate-180" /> Continuar comprando
        </button>
        <h1 className="text-xl lg:text-2xl font-heading font-bold text-foreground mb-4">Tu Carrito</h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart size={48} strokeWidth={1.2} className="mb-3 opacity-40" />
            <p className="font-heading font-semibold text-lg mb-1">Carrito vacío</p>
            <p className="text-sm">Agrega productos desde el catálogo</p>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
            {/* Left column: products + form */}
            <div className="min-w-0">
              {/* Product list (inline JSX — NOT a sub-component, to avoid remounts) */}
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
                      className="flex items-center gap-3 bg-card rounded-xl p-3 mb-3 border border-border"
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
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.presentationId)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground" aria-label="Disminuir">
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
                          aria-label="Aumentar"
                        >
                          <Plus size={14} />
                        </button>
                        <button onClick={() => removeItem(item.product.id, item.presentationId)} className="w-7 h-7 rounded-lg flex items-center justify-center text-destructive ml-1" aria-label="Eliminar">
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

              {/* Order Form (inline — no sub-component to keep input identity stable) */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    id="checkout-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading font-semibold text-base text-foreground">Datos del pedido</h3>
                      <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
                        <X size={18} />
                      </button>
                    </div>

                    {/* Name */}
                    <div>
                      <label htmlFor="ck-name" className="text-xs font-medium text-muted-foreground mb-1 block">Nombre completo *</label>
                      <input
                        id="ck-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu nombre"
                        autoComplete="name"
                        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
                        required
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="ck-email" className="text-xs font-medium text-muted-foreground mb-1 block">📧 Correo electrónico</label>
                      <input
                        id="ck-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tucorreo@email.com"
                        autoComplete="email"
                        inputMode="email"
                        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Para confirmación y seguimiento</p>
                    </div>

                    {/* Phone */}
                    <div>
                      <label htmlFor="ck-phone" className="text-xs font-medium text-muted-foreground mb-1 block">📱 WhatsApp *</label>
                      <div className="flex gap-1.5">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="bg-muted rounded-lg px-2 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring w-[100px] shrink-0 text-foreground"
                          aria-label="Código de país"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                          ))}
                        </select>
                        <input
                          id="ck-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="3001234567"
                          autoComplete="tel"
                          inputMode="tel"
                          className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
                          required
                        />
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label htmlFor="ck-address" className="text-xs font-medium text-muted-foreground mb-1 block">📍 Dirección de entrega</label>
                      <input
                        id="ck-address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle 123 #45-67"
                        autoComplete="street-address"
                        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground"
                      />
                    </div>

                    {/* Geolocation */}
                    {showGeolocation && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
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
                    )}

                    {shippingZones && shippingZones.length > 0 && (
                      <NeighborhoodSearch
                        zones={shippingZones}
                        selectedId={neighborhoodId}
                        onSelect={handleZoneChange}
                      />
                    )}
                    {deliveryCost > 0 && !freeShippingActive && (
                      <p className="text-xs text-accent font-medium">🚚 Domicilio: {formatPrice(deliveryCost)}</p>
                    )}
                    {freeShippingActive && (
                      <p className="text-xs text-secondary font-bold">🎉 ¡Envío GRATIS aplicado!</p>
                    )}

                    {/* Notes */}
                    <div>
                      <label htmlFor="ck-notes" className="text-xs font-medium text-muted-foreground mb-1 block">📝 Notas (opcional)</label>
                      <textarea
                        id="ck-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Indicaciones para el repartidor..."
                        rows={2}
                        className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none text-foreground"
                      />
                    </div>

                    {/* Delivery estimate */}
                    <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                      <Truck size={14} className="text-accent" />
                      <span className="text-xs font-medium text-foreground">Entrega en {estimatedDays} días hábiles</span>
                    </div>

                    {showDeliveryDate && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <CalendarIcon size={14} className="text-accent" />
                          <span className="text-xs font-medium text-muted-foreground">Fecha preferida de entrega</span>
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className={cn("w-full bg-muted rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between", !preferredDate && "text-muted-foreground")}>
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
                    )}

                    {showTimeSlot && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Clock size={14} className="text-accent" />
                          <span className="text-xs font-medium text-muted-foreground">Horario preferido</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setTimeSlot("mañana")} className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border", timeSlot === "mañana" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}>
                            ☀️ Mañana (8-12)
                          </button>
                          <button type="button" onClick={() => setTimeSlot("tarde")} className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border", timeSlot === "tarde" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}>
                            🌙 Tarde (2-6)
                          </button>
                        </div>
                      </div>
                    )}

                    {showPaymentMethod && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Banknote size={14} className="text-accent" />
                          <span className="text-xs font-medium text-muted-foreground">Método de pago</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setPaymentMethod("efectivo")} className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border flex items-center justify-center gap-1.5", paymentMethod === "efectivo" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}>
                            <Banknote size={14} /> Efectivo
                          </button>
                          <button type="button" onClick={() => setPaymentMethod("transferencia")} className={cn("rounded-lg py-2.5 text-sm font-medium transition-colors border flex items-center justify-center gap-1.5", paymentMethod === "transferencia" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent")}>
                            <CreditCard size={14} /> Transferencia
                          </button>
                        </div>
                      </div>
                    )}

                    {isAgent && agentCustomer ? (
                      <div className="space-y-2 pt-2">
                        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-start gap-2">
                          <span className="text-base shrink-0">🧑‍💼</span>
                          <div className="text-[11px] text-muted-foreground leading-tight">
                            <span className="font-semibold text-primary">Modo Agente:</span> Eliges cómo cerrar la venta para <span className="font-semibold text-foreground">{agentCustomer.fullName}</span>.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSubmitOrder}
                          disabled={submitting}
                          className="w-full btn-surte py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                          title="Crea el pedido y abre WhatsApp para confirmar con el cliente"
                        >
                          {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                          {submitting ? "Procesando..." : "Registrar venta + Enviar WhatsApp"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            (window as any).__skipWhatsApp = true;
                            await handleSubmitOrder();
                            (window as any).__skipWhatsApp = false;
                          }}
                          disabled={submitting}
                          className="w-full bg-secondary text-secondary-foreground rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-secondary/90 transition-colors"
                          title="Solo registra la venta, sin enviar mensaje al cliente"
                        >
                          <CheckCircle2 size={16} />
                          Solo registrar venta (sin WhatsApp)
                        </button>
                        <button type="button" onClick={() => setShowForm(false)} className="w-full bg-muted rounded-xl py-2 text-xs text-muted-foreground font-medium">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-muted rounded-xl py-3 text-sm text-muted-foreground font-medium">
                          Cancelar
                        </button>
                        <button type="button" onClick={handleSubmitOrder} disabled={submitting} className="flex-1 btn-surte py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                          {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                          {submitting ? "Enviando..." : "Confirmar y enviar por WhatsApp"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right column: sticky summary on desktop */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <div className="bg-card rounded-xl p-5 border border-border">
                  <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
                    <ShoppingCart size={18} className="text-accent" />
                    Resumen
                  </h3>
                  <SummaryBlock
                    couponCode={couponCode}
                    setCouponCode={setCouponCode}
                    appliedCoupon={appliedCoupon}
                    couponDiscount={couponDiscount}
                    validatingCoupon={validatingCoupon}
                    applyCoupon={applyCoupon}
                    removeCoupon={removeCoupon}
                    totalPrice={totalPrice}
                    deliveryCost={deliveryCost}
                    freeShippingActive={freeShippingActive}
                    cityCfg={cityCfg}
                    freeShippingMissing={freeShippingMissing}
                    grandTotal={grandTotal}
                    meetsMinimum={meetsMinimum}
                    onFinalize={handleFinalize}
                  />
                </div>
              </div>
            </div>

            {/* Mobile: fixed bottom summary bar */}
            <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-card border-t border-border px-4 py-3 z-30">
              <SummaryBlock
                couponCode={couponCode}
                setCouponCode={setCouponCode}
                appliedCoupon={appliedCoupon}
                couponDiscount={couponDiscount}
                validatingCoupon={validatingCoupon}
                applyCoupon={applyCoupon}
                removeCoupon={removeCoupon}
                totalPrice={totalPrice}
                deliveryCost={deliveryCost}
                freeShippingActive={freeShippingActive}
                cityCfg={cityCfg}
                freeShippingMissing={freeShippingMissing}
                grandTotal={grandTotal}
                meetsMinimum={meetsMinimum}
                onFinalize={handleFinalize}
                compact
              />
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

/* ── Summary block — pure props, no internal state, safe to render anywhere ── */
interface SummaryProps {
  couponCode: string;
  setCouponCode: (v: string) => void;
  appliedCoupon: any;
  couponDiscount: number;
  validatingCoupon: boolean;
  applyCoupon: () => void;
  removeCoupon: () => void;
  totalPrice: number;
  deliveryCost: number;
  freeShippingActive: boolean;
  cityCfg: any;
  freeShippingMissing: number;
  grandTotal: number;
  meetsMinimum: boolean;
  onFinalize: () => void;
  compact?: boolean;
}

const SummaryBlock = ({
  couponCode, setCouponCode, appliedCoupon, couponDiscount, validatingCoupon,
  applyCoupon, removeCoupon, totalPrice, deliveryCost, freeShippingActive, cityCfg,
  freeShippingMissing, grandTotal, meetsMinimum, onFinalize, compact,
}: SummaryProps) => (
  <div>
    {!compact && (
      <div className="flex items-center gap-2 mb-3">
        {appliedCoupon ? (
          <div className="flex-1 flex items-center gap-1.5 bg-secondary/10 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="text-secondary" />
            <span className="text-xs font-medium text-secondary">{appliedCoupon.code}</span>
            <span className="text-xs text-secondary">-{formatPrice(couponDiscount)}</span>
            <button onClick={removeCoupon} className="ml-auto" aria-label="Quitar cupón"><X size={14} className="text-muted-foreground" /></button>
          </div>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2">
              <Ticket size={14} className="text-muted-foreground" />
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Código cupón"
                className="flex-1 bg-transparent text-sm outline-none font-mono uppercase text-foreground"
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
    )}

    {!compact && (
      <>
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
        {(deliveryCost > 0 || freeShippingActive) && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Domicilio</span>
            {freeShippingActive ? (
              <span className="text-sm font-bold text-secondary">GRATIS 🎉</span>
            ) : (
              <span className="text-sm font-medium text-foreground">{formatPrice(deliveryCost)}</span>
            )}
          </div>
        )}
        {!freeShippingActive && cityCfg?.free_shipping_enabled && freeShippingMissing > 0 && deliveryCost > 0 && (
          <div className="bg-secondary/10 border border-secondary/30 rounded-lg px-2.5 py-1.5 mb-2">
            <p className="text-[11px] text-secondary font-medium">
              🚚 Te faltan {formatPrice(freeShippingMissing)} para envío gratis
            </p>
          </div>
        )}
      </>
    )}

    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-semibold text-foreground">Total</span>
      <span className="text-xl font-heading font-bold text-foreground">{formatPrice(grandTotal)}</span>
    </div>
    <button
      onClick={onFinalize}
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

export default Carrito;
