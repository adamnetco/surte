import { Search, User, MapPin, ChevronDown, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSettings } from "@/hooks/useStore";
import surteLogo from "@/assets/surte-logo.png";

const CITIES = ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"] as const;

interface TopBarProps {
  onSearch?: (query: string) => void;
}

const TopBar = ({ onSearch }: TopBarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>(() => {
    return localStorage.getItem("surte_city") || "Bucaramanga";
  });
  const navigate = useNavigate();
  const cityRef = useRef<HTMLDivElement>(null);
  const { data: settings } = useAppSettings();

  const showPromoBanner = settings?.show_promo_banner === "true";
  const promoBannerText = settings?.promo_banner_text || "🚚 ENVÍO GRATIS EN COMPRAS DESDE $120.000";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
    if (query.trim()) navigate(`/catalogo?q=${encodeURIComponent(query)}`);
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    localStorage.setItem("surte_city", city);
    setCityOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      {/* Promo banner — configurable */}
      {showPromoBanner && (
        <div className="bg-primary text-primary-foreground text-center text-[11px] font-medium py-1 px-4">
          {promoBannerText}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5">
        <img
          src={surteLogo}
          alt="SURTÉ YA"
          className="h-24 w-auto object-contain cursor-pointer"
          onClick={() => navigate("/")}
        />
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              searchOpen ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
            }`}
          >
            {searchOpen ? <X size={16} /> : <Search size={16} />}
          </button>
          <button
            onClick={() => navigate("/menu")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-foreground"
          >
            <User size={16} />
          </button>
        </div>
      </div>

      {/* Location bar with city selector */}
      <div className="px-3 pb-1.5 relative" ref={cityRef}>
        <button
          onClick={() => setCityOpen(!cityOpen)}
          className="w-full flex items-center gap-1.5 bg-muted rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <MapPin size={12} className="text-accent shrink-0" />
          <span className="truncate flex-1 text-left">{selectedCity} y Área Metropolitana</span>
          <ChevronDown size={12} className={`shrink-0 transition-transform ${cityOpen ? "rotate-180" : ""}`} />
        </button>

        {cityOpen && (
          <div
            className="absolute left-3 right-3 top-full mt-1 bg-card border border-border rounded-xl overflow-hidden z-50"
            style={{ boxShadow: "var(--shadow-card-hover)" }}
          >
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Selecciona tu ciudad
            </p>
            {CITIES.map((city) => (
              <button
                key={city}
                onClick={() => handleCitySelect(city)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  selectedCity === city ? "bg-accent/10 text-accent font-medium" : "text-foreground hover:bg-muted"
                }`}
              >
                <MapPin size={12} className={selectedCity === city ? "text-accent" : "text-muted-foreground"} />
                {city}
                {selectedCity === city && <span className="ml-auto text-xs text-accent">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search bar */}
      {searchOpen && (
        <form onSubmit={handleSearch} className="px-3 pb-2 animate-fade-in">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full bg-muted rounded-full pl-8 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </form>
      )}
    </header>
  );
};

export default TopBar;
