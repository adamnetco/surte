import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Used to namespace the recovery key in localStorage. */
  sessionId?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * POSErrorBoundary
 * - Captura errores de render dentro del POS sin tumbar la app.
 * - Permite al cajero refrescar la pantalla preservando lo que haya en
 *   `pos_ticket_recovery:${sessionId}` (que la línea de tickets debe
 *   mantener sincronizado en cada cambio).
 */
export class POSErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[POSErrorBoundary]", error, info);
  }

  private handleReload = () => {
    // No tocamos localStorage — la recuperación del ticket vive ahí.
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-[100dvh] w-full flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Ocurrió un error en el POS</h2>
            <p className="text-sm text-muted-foreground">
              Tu ticket actual está guardado localmente. Refresca la pantalla
              para continuar donde quedaste.
            </p>
          </div>
          {this.state.error?.message && (
            <pre className="text-xs text-left bg-muted rounded p-2 overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={this.handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recuperar y continuar
            </Button>
            <Button variant="outline" onClick={this.handleReset}>
              Reintentar sin recargar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default POSErrorBoundary;
