import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

// Stub Fase 2 — base de conocimiento se migrará en Fase 3.
export default function SupportArticlesHub() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">
          Base de ayuda — disponible en Fase 3.
        </p>
      </CardContent>
    </Card>
  );
}
