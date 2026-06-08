import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

/** Recovery codes shape: XXXX-XXXX-XX (10 chars, normalized uppercase). */
const RecoveryCodeInput = ({ value, onChange, disabled }: Props) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="recovery-code">Código de recuperación</Label>
    <Input
      id="recovery-code"
      placeholder="XXXX-XXXX-XX"
      autoComplete="one-time-code"
      maxLength={12}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
      className="font-mono tracking-widest text-center text-lg"
    />
    <p className="text-xs text-muted-foreground">
      Cada código es de un solo uso. Genera uno nuevo desde tu perfil después de usarlo.
    </p>
  </div>
);

export default RecoveryCodeInput;
