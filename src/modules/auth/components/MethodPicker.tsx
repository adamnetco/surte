import { Button } from "@/components/ui/button";
import { KeyRound, Mail, ShieldCheck, Sparkles, LifeBuoy } from "lucide-react";
import type { AuthMethod, FactorSummary } from "@/modules/auth/state/loginMachine";

const ICONS: Record<AuthMethod, JSX.Element> = {
  passkey: <KeyRound />,
  google: <Sparkles />,
  password_totp: <ShieldCheck />,
  magic_link: <Mail />,
  recovery: <LifeBuoy />,
};

interface Props {
  factors: FactorSummary[];
  onChoose: (method: AuthMethod) => void;
  onRecovery: () => void;
}

const MethodPicker = ({ factors, onChoose, onRecovery }: Props) => {
  const enrolled = factors.filter((f) => f.enrolled && f.method !== "recovery");
  const recovery = factors.find((f) => f.method === "recovery");

  return (
    <div className="flex flex-col gap-2">
      {enrolled.map((f) => (
        <Button
          key={f.method}
          variant={f.method === "passkey" ? "default" : "outline"}
          className="justify-start h-12"
          onClick={() => onChoose(f.method)}
        >
          {ICONS[f.method]}
          <span className="ml-2">{f.label}</span>
        </Button>
      ))}
      {recovery?.enrolled && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={onRecovery}
        >
          <LifeBuoy className="mr-1" /> Usar código de recuperación
        </Button>
      )}
    </div>
  );
};

export default MethodPicker;
