import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import type { Motor } from "./motor";

/**
 * O motor nas 6 tabelas do Supabase. São as mesmas consultas da área do
 * Outubro Rosa, só reunidas aqui. Todo acesso é server-side com service_role;
 * RLS ligado sem policies.
 */
export const motorSupabase: Motor = {
  async clientePorEmail(email) {
    const { data } = await createServiceClient()
      .from("customers")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    return data ?? null;
  },

  async clientePorId(id) {
    const { data } = await createServiceClient().from("customers").select("*").eq("id", id).maybeSingle();
    return data ?? null;
  },

  async acessosAtivos(customerId) {
    const { data, error } = await createServiceClient()
      .from("entitlements")
      .select("created_at, products!inner(slug)")
      .eq("customer_id", customerId)
      .eq("status", "active");
    if (error) throw new Error("Falha ao ler acessos: " + error.message);
    return (data ?? []).map((linha) => ({
      slug: (linha.products as unknown as { slug: string }).slug,
      liberadoEm: linha.created_at as string,
    }));
  },

  async criarSessao(linha) {
    const { error } = await createServiceClient().from("sessions").insert(linha);
    if (error) throw new Error("Falha ao criar sessao: " + error.message);
  },

  async sessaoPorHash(tokenHash) {
    const { data } = await createServiceClient()
      .from("sessions")
      .select("customer_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    return data ?? null;
  },

  async apagarSessao(tokenHash) {
    await createServiceClient().from("sessions").delete().eq("token_hash", tokenHash);
  },
};
