import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";

const CustomScriptInjector = () => {
  const isStorefront = isStorefrontTenant(detectTenant());
  const { data: scripts } = useQuery({
    queryKey: ["custom-scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_scripts")
        .select("id, script_content, position")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: isStorefront,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!scripts || scripts.length === 0) return;

    const injectedIds: string[] = [];

    scripts.forEach((script) => {
      const containerId = `custom-script-${script.id}`;
      if (document.getElementById(containerId)) return;

      const wrapper = document.createElement("div");
      wrapper.id = containerId;
      wrapper.innerHTML = script.script_content;

      // Extract and re-create script tags so they actually execute
      const tempScripts = wrapper.querySelectorAll("script");
      const nonScriptContent = wrapper.innerHTML;

      if (script.position === "head") {
        // Add non-script content to head
        const meta = document.createElement("div");
        meta.id = containerId;
        meta.style.display = "none";
        document.head.appendChild(meta);

        tempScripts.forEach((s) => {
          const newScript = document.createElement("script");
          if (s.src) {
            newScript.src = s.src;
            newScript.defer = s.defer;
            newScript.async = s.async;
          } else {
            newScript.textContent = s.textContent;
          }
          if (s.id) newScript.id = s.id;
          newScript.setAttribute("data-custom-script", script.id);
          document.head.appendChild(newScript);
        });
      } else {
        const target = script.position === "body_start"
          ? document.body.firstChild
          : null;

        const container = document.createElement("div");
        container.id = containerId;

        if (target) {
          document.body.insertBefore(container, target);
        } else {
          document.body.appendChild(container);
        }

        tempScripts.forEach((s) => {
          const newScript = document.createElement("script");
          if (s.src) {
            newScript.src = s.src;
            newScript.defer = s.defer;
            newScript.async = s.async;
          } else {
            newScript.textContent = s.textContent;
          }
          if (s.id) newScript.id = s.id;
          newScript.setAttribute("data-custom-script", script.id);
          container.appendChild(newScript);
        });
      }

      injectedIds.push(containerId);
    });

    return () => {
      injectedIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
        // Also remove any head scripts
        document.querySelectorAll(`script[data-custom-script]`).forEach((s) => s.remove());
      });
    };
  }, [scripts]);

  return null;
};

export default CustomScriptInjector;
