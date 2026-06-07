import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, ExternalLink, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadItem {
  id: string;
  title: string;
  description: string | null;
  download_url: string;
  file_type: string;
  category: string;
  icon: string | null;
}

export default function ClientDownloadsTab() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any)
      .from("client_downloads").select("*")
      .eq("is_active", true).order("sort_order")
      .then(({ data }: any) => {
        setDownloads((data as DownloadItem[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold">Descargas y Herramientas</h2>
      {downloads.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <FileDown className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No hay descargas disponibles aún.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {downloads.map((d) => (
            <div key={d.id} className="flex items-start gap-4 rounded-lg border bg-card p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Download className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold">{d.title}</h3>
                {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
                <span className="inline-block text-xs text-muted-foreground capitalize">{d.category} · {d.file_type}</span>
              </div>
              <Button size="sm" asChild>
                <a href={d.download_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                  <ExternalLink className="h-3 w-3" />Descargar
                </a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
