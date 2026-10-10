import "server-only";
import type { Customer } from "@/lib/supabase/types";
import { motorLocal } from "./motor-local";
import { motorSupabase } from "./motor-supabase";

/**
 * O MOTOR DE ACESSO, visto pelo app: só as perguntas que as telas fazem.
 *
 * Duas implementações com o MESMO contrato:
 *   • supabase → as 6 tabelas de supabase/migrations (produção);
 *   • local    → um arquivo JSON em .dados-locais/ (desenvolvimento, enquanto
 *                o projeto Supabase não existe).
 *
 * Quem escolhe é o ambiente: sem NEXT_PUBLIC_SUPABASE_URL e
 * SUPABASE_SERVICE_ROLE_KEY, é local. Ligar o Supabase depois é preencher as
 * duas variáveis — nenhuma tela muda.
 *
 * O modo local é da SUA MÁQUINA: na Vercel o disco é somente leitura e a
 * sessão não teria onde ser gravada. Lá ele se recusa a subir, com mensagem.
 */

export interface LinhaSessao {
  customer_id: string;
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  expires_at: string;
}

export interface Acesso {
  /** idêntico a products.slug — a chave que liga o entitlement ao catálogo */
  slug: string;
  liberadoEm: string;
}

export interface Motor {
  clientePorEmail(email: string): Promise<Customer | null>;
  clientePorId(id: string): Promise<Customer | null>;
  /** só entitlements com status 'active' — 'revoked' não conta */
  acessosAtivos(customerId: string): Promise<Acesso[]>;
  criarSessao(linha: LinhaSessao): Promise<void>;
  sessaoPorHash(tokenHash: string): Promise<{ customer_id: string; expires_at: string } | null>;
  apagarSessao(tokenHash: string): Promise<void>;
}

export const modoLocal = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY;

export function motor(): Motor {
  if (!modoLocal()) return motorSupabase;
  if (process.env.VERCEL) {
    throw new Error(
      "Modo local não roda na Vercel: configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return motorLocal;
}
