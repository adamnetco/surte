import { ArrowLeft, RefreshCw, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminHeader = () => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 px-4 py-3.5 flex items-center gap-3" style={{ background: "var(--gradient-hero)" }}>
      <button onClick={() => navigate("/")} className="text-white/80 hover:text-white transition-colors">
        <ArrowLeft size={20} />
      </button>
      <div className="flex-1">
        <h1 className="font-heading font-bold text-base tracking-tight text-white">
          SURTÉ <span className="text-surte-naranja">YA</span>
        </h1>
        <p className="text-[10px] text-white/60 font-medium">Panel de Administración</p>
      </div>
      <button onClick={() => window.location.reload()} className="text-white/60 hover:text-white transition-colors">
        <RefreshCw size={16} />
      </button>
    </header>
  );
};

export default AdminHeader;
