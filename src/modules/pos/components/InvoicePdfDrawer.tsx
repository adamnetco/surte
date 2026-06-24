import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink, QrCode } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  qrUrl?: string | null;
  cufe?: string | null;
  fullNumber?: string | null;
}

/**
 * Drawer lateral con vista previa de la factura DIAN.
 * AC8 de POS-innapsis-emision-pos.
 */
export default function InvoicePdfDrawer({ open, onOpenChange, pdfUrl, xmlUrl, qrUrl, cufe, fullNumber }: Props) {
  const [iframeError, setIframeError] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4 h-4 text-primary" />
            Factura {fullNumber ?? "DIAN"}
          </SheetTitle>
          <SheetDescription className="text-xs font-mono break-all">
            CUFE: {cufe ?? "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden bg-muted/30">
          {pdfUrl && !iframeError ? (
            <iframe
              src={pdfUrl}
              title="Factura DIAN"
              className="w-full h-full border-0"
              onError={() => setIframeError(true)}
            />
          ) : (
            <div className="h-full grid place-items-center p-8 text-center">
              <div className="space-y-3 max-w-xs">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {pdfUrl
                    ? "El visor no pudo cargar el PDF. Abrir en nueva pestaña."
                    : "PDF aún no disponible. Aparecerá cuando DIAN confirme la emisión."}
                </p>
                {pdfUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 flex flex-wrap gap-2 justify-end bg-background">
          {qrUrl && (
            <Button asChild size="sm" variant="ghost">
              <a href={qrUrl} target="_blank" rel="noopener noreferrer">
                <QrCode className="w-4 h-4 mr-1.5" /> QR
              </a>
            </Button>
          )}
          {xmlUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={xmlUrl} target="_blank" rel="noopener noreferrer" download>
                <Download className="w-4 h-4 mr-1.5" /> XML
              </a>
            </Button>
          )}
          {pdfUrl && (
            <Button asChild size="sm">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download>
                <Download className="w-4 h-4 mr-1.5" /> PDF
              </a>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
