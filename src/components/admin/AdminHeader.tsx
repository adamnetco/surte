import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminHeader = () => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
      <button onClick={() => navigate("/")} className="text-primary-foreground"><ArrowLeft size={20} /></button>
      <h1 className="font-heading font-bold text-lg">Admin SURTÉ</h1>
    </header>
  );
};

export default AdminHeader;
