import { isDevBypassEnabled } from "@/modules/auth/lib/devBypass";
import { AlertTriangle } from "lucide-react";

/**
 * Banda visible en la parte superior cuando el bypass dev está activo.
 * Solo se monta si `isDevBypassEnabled()` devuelve true.
 */
export default function DevBypassBanner() {
  if (!isDevBypassEnabled()) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-orange-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 shadow-md">
      <AlertTriangle size={14} />
      <span>
        Dev Bypass activo · sesión simulada de <b>superadmin</b> · sin acceso real a la base de datos
      </span>
    </div>
  );
}
