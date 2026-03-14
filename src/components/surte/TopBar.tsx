import { Search, User, MapPin } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import surteLogo from "@/assets/surte-logo.png";

interface TopBarProps {
  onSearch?: (query: string) => void;
}

const TopBar = ({ onSearch }: TopBarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
    if (query.trim()) navigate(`/catalogo?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      {/* Promo banner */}
      <div className="bg-primary text-primary-foreground text-center text-xs font-medium py-1.5 px-4">
        🚚 ENVÍO GRATIS EN COMPRAS DESDE $40.000
      </div>

      <div className="flex items-center justify-between px-4 py-2.5">
        <img src={surteLogo} alt="SURTÉ" className="h-9 w-auto object-contain" />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => navigate("/menu")}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-foreground"
          >
            <User size={18} />
          </button>
        </div>
      </div>

      {/* Location bar */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1.5 text-sm text-muted-foreground">
          <MapPin size={14} className="text-accent shrink-0" />
          <span className="truncate">Medellín y Área Metropolitana</span>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <form onSubmit={handleSearch} className="px-4 pb-3 animate-fade-in">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full bg-muted rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </form>
      )}
    </header>
  );
};

export default TopBar;
