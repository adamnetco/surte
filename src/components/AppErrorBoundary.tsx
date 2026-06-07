import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Etiqueta para diferenciar logs entre boundaries (ej: "AdminDashboard"). */
  label?: string;
  /** Render alternativo opcional. Si no se provee, usa la UI por defecto. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * AppErrorBoundary — captura errores de render de toda la app
 * para que un crash en una sección no tumbe el shell completo.
 * Muestra un mensaje amigable + opciones de recuperación.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[AppErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  private reset = () => this.setState({ hasError: false, error: undefined });
  private reload = () => window.location.reload();
  private goHome = () => {
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }

    const isDev = import.meta.env.DEV;
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 space-y-4 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground">
              Tuvimos un problema cargando esta sección. Puedes reintentar o volver al inicio.
            </p>
          </div>
          {isDev && this.state.error?.message && (
            <pre className="text-xs text-left bg-muted rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={this.reset} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
            <Button onClick={this.reload} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Recargar
            </Button>
            <Button onClick={this.goHome} variant="ghost" className="gap-2">
              <Home className="h-4 w-4" /> Inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
