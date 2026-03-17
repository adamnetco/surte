import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { ArrowLeft, Save, User, Phone, MapPin, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Perfil = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    business_name: "",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        address: profile.address || "",
        city: profile.city || "",
        business_name: profile.business_name || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(form)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Perfil actualizado");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setSaving(false);
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Cargando...</p></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopBar />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <User size={48} strokeWidth={1.2} className="text-muted-foreground/40 mb-4" />
          <h2 className="font-heading font-bold text-lg text-foreground mb-2">Inicia sesión</h2>
          <p className="text-sm text-muted-foreground mb-6">Necesitas una cuenta para ver tu perfil</p>
          <button onClick={() => navigate("/login")} className="btn-surte px-6 py-3 text-sm">Iniciar Sesión</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const fields = [
    { key: "full_name", label: "Nombre completo", icon: User, placeholder: "Tu nombre" },
    { key: "phone", label: "WhatsApp", icon: Phone, placeholder: "573001234567" },
    { key: "business_name", label: "Negocio / Empresa", icon: Building2, placeholder: "Nombre del negocio" },
    { key: "address", label: "Dirección", icon: MapPin, placeholder: "Tu dirección de entrega" },
    { key: "city", label: "Ciudad", icon: MapPin, placeholder: "Bucaramanga, Floridablanca, Girón, Piedecuesta" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-heading font-bold text-foreground">Mi Perfil</h1>
        </div>

        <div className="bg-card rounded-xl p-4 mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <User size={24} className="text-accent" />
            </div>
            <div>
              <p className="font-heading font-bold text-foreground">{form.full_name || "Sin nombre"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {fields.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key} className="bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
              <div className="relative">
                <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full bg-muted rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-surte w-full mt-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </main>
      <BottomNav />
    </div>
  );
};

export default Perfil;