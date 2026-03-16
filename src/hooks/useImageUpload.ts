import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useImageUpload = (bucket: string = "product-images") => {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File, folder: string = ""): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const name = `${folder ? folder + "/" : ""}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(name, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(name);
      return data.publicUrl;
    } catch (err: any) {
      toast.error(err.message || "Error subiendo imagen");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
};
