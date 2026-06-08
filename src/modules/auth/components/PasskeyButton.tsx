import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2 } from "lucide-react";
import { isPlatformAuthenticatorAvailable, isWebAuthnSupported } from "@/modules/auth/lib/webauthn-client";

interface Props {
  onTrigger: () => void | Promise<void>;
  loading?: boolean;
  label?: string;
}

const PasskeyButton = ({ onTrigger, loading, label = "Continuar con Passkey" }: Props) => {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = isWebAuthnSupported() && (await isPlatformAuthenticatorAvailable());
      if (alive) setSupported(ok);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!supported) return null;

  return (
    <Button onClick={() => void onTrigger()} disabled={loading} className="h-12 w-full">
      {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
      <span className="ml-2">{label}</span>
    </Button>
  );
};

export default PasskeyButton;
