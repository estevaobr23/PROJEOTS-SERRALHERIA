/**
 * _motor.mjs — o motor de acesso visto pelos SCRIPTS (testes, liberação local).
 *
 * Mesma regra do app (lib/dados/motor.ts): com NEXT_PUBLIC_SUPABASE_URL e
 * SUPABASE_SERVICE_ROLE_KEY fala com o Supabase; sem elas, com o arquivo
 * .dados-locais/motor.json. O formato do arquivo é o de lib/dados/motor-local.ts
 * — mudou lá, muda aqui.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

if (existsSync(".env.local")) {
  for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const LOCAL = !URL_SUPA && !CHAVE;

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) throw new Error("Faltando SESSION_SECRET em .env.local");
if (!LOCAL && (!URL_SUPA || !CHAVE)) {
  throw new Error("Supabase configurado pela metade: defina as DUAS variáveis, ou nenhuma (modo local).");
}

export const hashToken = (t) => createHmac("sha256", SESSION_SECRET).update(t).digest("hex");

// ── modo local ───────────────────────────────────────────────────────────────

const ARQUIVO = path.join(".dados-locais", "motor.json");

function lerLocal() {
  if (!existsSync(ARQUIVO)) return { customers: [], entitlements: [], sessions: [] };
  return JSON.parse(readFileSync(ARQUIVO, "utf8"));
}
function gravarLocal(base) {
  mkdirSync(".dados-locais", { recursive: true });
  const tmp = `${ARQUIVO}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(base, null, 1), "utf8");
  renameSync(tmp, ARQUIVO);
}

const local = {
  async criarCliente(email, nome = null) {
    const base = lerLocal();
    const alvo = email.trim().toLowerCase();
    let c = base.customers.find((x) => x.email === alvo);
    if (!c) {
      c = { id: randomUUID(), email: alvo, name: nome, created_at: new Date().toISOString() };
      base.customers.push(c);
    } else if (nome) c.name = nome;
    gravarLocal(base);
    return c.id;
  },
  async liberar(customerId, slug) {
    const base = lerLocal();
    const e = base.entitlements.find((x) => x.customer_id === customerId && x.product_slug === slug);
    if (e) Object.assign(e, { status: "active", revoked_at: null, revoke_reason: null });
    else
      base.entitlements.push({
        id: randomUUID(), customer_id: customerId, product_slug: slug, status: "active",
        revoked_at: null, revoke_reason: null, created_at: new Date().toISOString(),
      });
    gravarLocal(base);
  },
  async revogar(customerId, slug, motivo) {
    const base = lerLocal();
    for (const e of base.entitlements) {
      if (e.customer_id === customerId && e.product_slug === slug && e.status === "active") {
        Object.assign(e, { status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: motivo });
      }
    }
    base.sessions = base.sessions.filter((s) => s.customer_id !== customerId);
    gravarLocal(base);
  },
  async criarSessao(customerId) {
    const token = randomBytes(32).toString("hex");
    const base = lerLocal();
    base.sessions.push({
      id: randomUUID(), customer_id: customerId, token_hash: hashToken(token), user_agent: null, ip: null,
      created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 864e5).toISOString(),
    });
    gravarLocal(base);
    return `session_token=${token}`;
  },
  async limparCliente(id) {
    const base = lerLocal();
    base.customers = base.customers.filter((c) => c.id !== id);
    base.entitlements = base.entitlements.filter((e) => e.customer_id !== id);
    base.sessions = base.sessions.filter((s) => s.customer_id !== id);
    gravarLocal(base);
  },
  async listar() {
    return lerLocal();
  },
};

// ── Supabase ─────────────────────────────────────────────────────────────────

async function db() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(URL_SUPA, CHAVE, { auth: { persistSession: false } });
}

async function produtoId(c, slug) {
  const { data } = await c.from("products").select("id").eq("slug", slug).maybeSingle();
  if (!data) throw new Error(`produto "${slug}" não existe na tabela products`);
  return data.id;
}

const supabase = {
  async criarCliente(email, nome = null) {
    const c = await db();
    const linha = { email: email.trim().toLowerCase() };
    if (nome) linha.name = nome;
    const { data, error } = await c.from("customers").upsert(linha, { onConflict: "email" }).select("id").single();
    if (error) throw new Error(`criar cliente: ${error.message}`);
    return data.id;
  },
  async liberar(customerId, slug) {
    const c = await db();
    const { error } = await c.from("entitlements").upsert(
      { customer_id: customerId, product_id: await produtoId(c, slug), status: "active", revoked_at: null, revoke_reason: null },
      { onConflict: "customer_id,product_id" },
    );
    if (error) throw new Error(`liberar: ${error.message}`);
  },
  async revogar(customerId, slug, motivo) {
    const c = await db();
    await c.from("entitlements")
      .update({ status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: motivo })
      .eq("customer_id", customerId).eq("product_id", await produtoId(c, slug)).eq("status", "active");
    await c.from("sessions").delete().eq("customer_id", customerId);
  },
  async criarSessao(customerId) {
    const c = await db();
    const token = randomBytes(32).toString("hex");
    const { error } = await c.from("sessions").insert({
      customer_id: customerId, token_hash: hashToken(token), expires_at: new Date(Date.now() + 864e5).toISOString(),
    });
    if (error) throw new Error(`criar sessao: ${error.message}`);
    return `session_token=${token}`;
  },
  async limparCliente(id) {
    const c = await db();
    await c.from("sessions").delete().eq("customer_id", id);
    await c.from("entitlements").delete().eq("customer_id", id);
    const { data: compras } = await c.from("purchases").select("id").eq("customer_id", id);
    for (const p of compras ?? []) await c.from("purchase_items").delete().eq("purchase_id", p.id);
    await c.from("purchases").delete().eq("customer_id", id);
    await c.from("customers").delete().eq("id", id);
  },
};

export const motor = LOCAL ? local : supabase;
export const nomeDoModo = LOCAL ? "MODO LOCAL (.dados-locais/motor.json)" : "Supabase";
