import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

// Stub Fase 2 — el hub real se migrará/implementará en Fase 3
// junto con la tabla `client_trainings`.
export default function TrainingVideoHub({ userRole = "customer" }: { userRole?: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">
          Centro de entrenamientos ({userRole}) — disponible en Fase 3.
        </p>
      </CardContent>
    </Card>
  );
}
