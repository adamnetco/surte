import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}

const TotpInput = ({ value, onChange, label = "Código de 6 dígitos", disabled }: Props) => (
  <div className="flex flex-col gap-2 items-center">
    <Label>{label}</Label>
    <InputOTP maxLength={6} value={value} onChange={onChange} disabled={disabled}>
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  </div>
);

export default TotpInput;
