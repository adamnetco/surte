import { useEffect, useRef } from "react";

interface Props {
  onScan: (code: string) => void;
  /** Bloquear cuando hay diálogos abiertos para que no robe foco al input visible. */
  disabled?: boolean;
}

/**
 * Listener invisible para lectores de código de barras tipo "teclado".
 * Captura tipeos rápidos terminados en Enter, incluso cuando ningún input está enfocado.
 * Heurística: si > 4 caracteres ingresan en < 80ms entre teclas → es scanner, no humano.
 */
export default function POSScannerListener({ onScan, disabled }: Props) {
  const buf = useRef("");
  const lastKey = useRef(0);

  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un campo real.
      const t = e.target as HTMLElement | null;
      if (
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable
      ) {
        return;
      }
      // Ignorar combinaciones (Cmd/Ctrl/Alt) y teclas de función.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.startsWith("F") && e.key.length > 1) return;

      const now = performance.now();
      const dt = now - lastKey.current;
      lastKey.current = now;

      if (e.key === "Enter") {
        const code = buf.current.trim();
        buf.current = "";
        if (code.length >= 4) {
          e.preventDefault();
          onScan(code);
        }
        return;
      }

      // Reset si la última tecla fue hace mucho (tipeo humano).
      if (dt > 200) buf.current = "";

      if (e.key.length === 1) {
        buf.current += e.key;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onScan, disabled]);

  return null;
}
