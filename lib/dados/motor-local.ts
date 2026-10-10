import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Customer, EntitlementStatus } from "@/lib/supabase/types";
import type { LinhaSessao, Motor } from "./motor";

/**
 * MODO LOCAL — o motor num arquivo JSON, enquanto o Supabase não existe.
 *
 * Espelha as tabelas do motor, com uma simplificação: o entitlement guarda o
 * SLUG do produto direto (no banco ele aponta para products.id, que tem o
 * slug). Clientes e acessos entram por `npm run liberar` — nunca pela tela.
 *
 * O MESMO formato é lido e escrito por scripts/_motor.mjs. Mudou aqui, muda lá.
 */

export const PASTA_LOCAL = path.join(process.cwd(), ".dados-locais");
const ARQUIVO = path.join(PASTA_LOCAL, "motor.json");

export interface BaseLocal {
  customers: Customer[];
  entitlements: {
    id: string;
    customer_id: string;
    product_slug: string;
    status: EntitlementStatus;
    revoked_at: string | null;
    revoke_reason: string | null;
    created_at: string;
  }[];
  sessions: (LinhaSessao & { id: string; created_at: string })[];
}

function ler(): BaseLocal {
  if (!existsSync(ARQUIVO)) return { customers: [], entitlements: [], sessions: [] };
  return JSON.parse(readFileSync(ARQUIVO, "utf8")) as BaseLocal;
}

/** Grava num temporário e renomeia: um processo derrubado no meio não corrompe o arquivo. */
function gravar(base: BaseLocal) {
  if (!existsSync(PASTA_LOCAL)) mkdirSync(PASTA_LOCAL, { recursive: true });
  const tmp = `${ARQUIVO}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(base, null, 1), "utf8");
  renameSync(tmp, ARQUIVO);
}

export const motorLocal: Motor = {
  async clientePorEmail(email) {
    const alvo = email.trim().toLowerCase();
    return ler().customers.find((c) => c.email === alvo) ?? null;
  },

  async clientePorId(id) {
    return ler().customers.find((c) => c.id === id) ?? null;
  },

  async acessosAtivos(customerId) {
    return ler()
      .entitlements.filter((e) => e.customer_id === customerId && e.status === "active")
      .map((e) => ({ slug: e.product_slug, liberadoEm: e.created_at }));
  },

  async criarSessao(linha) {
    const base = ler();
    base.sessions.push({ ...linha, id: randomUUID(), created_at: new Date().toISOString() });
    // limpa as vencidas de carona, para o arquivo não crescer sem fim
    const agora = Date.now();
    base.sessions = base.sessions.filter((s) => new Date(s.expires_at).getTime() > agora);
    gravar(base);
  },

  async sessaoPorHash(tokenHash) {
    const s = ler().sessions.find((x) => x.token_hash === tokenHash);
    return s ? { customer_id: s.customer_id, expires_at: s.expires_at } : null;
  },

  async apagarSessao(tokenHash) {
    const base = ler();
    const antes = base.sessions.length;
    base.sessions = base.sessions.filter((s) => s.token_hash !== tokenHash);
    if (base.sessions.length !== antes) gravar(base);
  },
};
