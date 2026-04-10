import { supabase } from "@/integrations/supabase/client";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export const mailService = {
  async send({ to, subject, html, from }: SendEmailParams) {
    const { data, error } = await supabase.functions.invoke("resend-mail-service", {
      body: { to, subject, html, from },
    });

    if (error) throw new Error(error.message || "Error sending email");
    return data;
  },
};
