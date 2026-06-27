import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminMobileDrawer from "./AdminMobileDrawer";
import SmartAlertsBell from "./SmartAlertsBell";
import { LocationSwitcher } from "@/modules/platform/components/LocationSwitcher";

const AdminHeader = () => {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-40 px-3 py-3 flex items-center gap-2"
      style={{ background: "var(--gradient-hero)" }}
    >
      <AdminMobileDrawer />
      <button
        onClick={() => navigate("/")}
        className="hidden lg:inline-flex text-white/80 hover:text-white transition-colors"
        aria-label="Volver al inicio"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="font-heading font-bold text-base tracking-tight text-white truncate">
          SURTÉ <span className="text-surte-naranja">YA</span>
        </h1>
        <p className="text-[10px] text-white/60 font-medium">Panel de Administración</p>
      </div>
      <LocationSwitcher compact />
      <SmartAlertsBell />
      <button
        onClick={() => window.location.reload()}
        className="text-white/60 hover:text-white transition-colors p-1"
        aria-label="Recargar"
      >
        <RefreshCw size={16} />
      </button>
    </header>
  );
};

export default AdminHeader;

