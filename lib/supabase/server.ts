import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client com a service_role key — só em código de servidor. Ignora RLS: as
 * tabelas têm RLS ligado SEM policies (deny-all para anon) e a autorização é
 * da aplicação.
 *
 * O `import "server-only"` quebra o build se alguém importar isto num client
 * component — a chave nunca chega ao browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Mensagem específica: em produção, "faltando X" economiza horas de debug.
  if (!url || !serviceRoleKey) {
    const faltando = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(`Supabase nao configurado: faltando ${faltando.join(", ")}.`);
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
