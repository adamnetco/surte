import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminHeader = () => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground px-4 py-3.5 flex items-center gap-3">
      <button onClick={() => navigate("/")} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
        <ArrowLeft size={20} />
      </button>
      <div className="flex-1">
        <h1 className="font-heading font-bold text-base tracking-tight">Admin SURTÉ</h1>
        <p className="text-[10px] text-primary-foreground/60 font-medium">Panel de gestión</p>
      </div>
      <button onClick={() => window.location.reload()} className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
        <RefreshCw size={16} />
      </button>
    </header>
  );
};

export default AdminHeader;
