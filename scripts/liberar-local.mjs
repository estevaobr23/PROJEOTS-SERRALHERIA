#!/usr/bin/env node
/**
 * liberar-local.mjs — dá (ou tira) acesso a um e-mail, para testar a área
 * enquanto o webhook da Cakto não está ligado.
 *
 * Faz à mão o que o webhook vai fazer: cria o cliente e grava UM entitlement
 * no plano comprado. No modo local escreve em .dados-locais/motor.json; com o
 * Supabase configurado escreve nas tabelas.
 *
 * ⚠️ Nunca use isto para liberar cliente REAL em produção — o caminho de
 * verdade é o webhook. Para teste, use e-mail @exemplo.invalid ou o seu.
 *
 * Uso:
 *   npm run liberar -- --email voce@exemplo.com --plano completo [--nome "Ana Souza"]
 *   npm run liberar -- --email voce@exemplo.com --plano basico --revogar
 *   npm run liberar -- --listar            (só no modo local)
 *
 * Planos: completo · basico · downsell  (= slugs calistenia-* de lib/config/ofertas.ts)
 */

import { motor, nomeDoModo, LOCAL } from "./_motor.mjs";

const args = process.argv.slice(2);
const valor = (nome) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const PLANOS = { completo: "calistenia-completo", basico: "calistenia-basico", downsell: "calistenia-downsell" };

console.log(nomeDoModo);

if (args.includes("--listar")) {
  if (!LOCAL) {
    console.error("--listar só existe no modo local. No Supabase, consulte as tabelas.");
    process.exitCode = 1;
  } else {
    const base = await motor.listar();
    for (const c of base.customers) {
      const planos = base.entitlements
        .filter((e) => e.customer_id === c.id)
        .map((e) => `${e.product_slug}${e.status === "active" ? "" : ` (${e.status})`}`);
      console.log(`  ${c.email}${c.name ? ` — ${c.name}` : ""}: ${planos.join(", ") || "sem plano"}`);
    }
    if (!base.customers.length) console.log("  (nenhum cliente)");
  }
} else {
  const email = valor("email");
  const plano = PLANOS[valor("plano") ?? ""];
  if (!email || !plano) {
    console.error('Uso: npm run liberar -- --email voce@exemplo.com --plano completo|basico|downsell [--nome "..."] [--revogar]');
    process.exitCode = 1;
  } else {
    const id = await motor.criarCliente(email, valor("nome") ?? null);
    if (args.includes("--revogar")) {
      await motor.revogar(id, plano, "manual");
      console.log(`✓ revogado: ${email} × ${plano}`);
    } else {
      await motor.liberar(id, plano);
      console.log(`✓ liberado: ${email} × ${plano} — entre em /login com esse e-mail`);
    }
  }
}
