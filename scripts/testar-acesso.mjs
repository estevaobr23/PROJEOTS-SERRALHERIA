#!/usr/bin/env node
/**
 * testar-acesso.mjs — quem comprou entra, quem não comprou toma 404 em tudo,
 * e cada plano abre só o que inclui.
 *
 * Cria clientes sintéticos (@exemplo.invalid, nunca existe de verdade):
 *   - "completo": entitlement ativo em calistenia-completo → projetos + bônus
 *   - "basico":   entitlement ativo em calistenia-basico   → só projetos
 *   - "sem":      existe como customer, SEM entitlement
 *   - "revogado": tinha o completo e foi reembolsado
 * Monta sessão gravando o hash direto (não passa pelo login/e-mail).
 * Bate nas rotas com o cookie de cada um e confere quem abre o quê.
 * LIMPA tudo no fim, sempre.
 *
 * Funciona nos dois modos (local e Supabase) — ver scripts/_motor.mjs.
 *
 * Uso:
 *   node scripts/testar-acesso.mjs [--base http://localhost:3000]
 * Requer o servidor rodando (`npm run dev`).
 */

import { motor, nomeDoModo, LOCAL } from "./_motor.mjs";

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");
const BASE = iBase >= 0 ? args[iBase + 1] : "http://localhost:3000";

const testes = [];
const reg = (nome, ok, detalhe = "") => {
  testes.push(ok);
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
};

const get = (caminho, cookie) =>
  fetch(`${BASE}${caminho}`, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });

console.log(`${nomeDoModo} · ${BASE}\n`);

const clientes = {};
async function novo(chave, plano) {
  const id = await motor.criarCliente(`e2e-${chave}@exemplo.invalid`, "Teste Sintético");
  if (plano) await motor.liberar(id, plano);
  clientes[chave] = { id };
}

try {
  await novo("completo", "calistenia-completo");
  await novo("basico", "calistenia-basico");
  await novo("sem", null);
  await novo("revogado", "calistenia-completo");
  await motor.revogar(clientes.revogado.id, "calistenia-completo", "refund");
  for (const c of Object.values(clientes)) c.cookie = await motor.criarSessao(c.id);

  const { completo, basico, sem, revogado } = clientes;
  // Local: a própria rota devolve os bytes (200). Supabase: 302 para a URL assinada.
  const entregou = (r) => (LOCAL ? r.status === 200 : r.status === 302);

  // ── quem comprou o completo: projetos + bônus ─────────────────────────
  const rInicio = await get("/inicio", completo.cookie);
  const htmlInicio = await rInicio.text();
  reg("completo: /inicio responde 200", rInicio.status === 200, `HTTP ${rInicio.status}`);
  reg("completo: /inicio mostra a seção de bônus", htmlInicio.includes("Seus bônus"));
  reg("completo: bônus sem arquivo aparecem como Preparando", htmlInicio.includes("Preparando"));

  const rCat = await get("/projetos", completo.cookie);
  reg("completo: /projetos responde 200", rCat.status === 200, `HTTP ${rCat.status}`);

  const rProj = await get("/projetos/REF-09", completo.cookie);
  const htmlProj = await rProj.text();
  reg("completo: /projetos/REF-09 responde 200", rProj.status === 200, `HTTP ${rProj.status}`);
  reg("REF-09 mostra o bloco de dimensões (tem área de segurança na fonte)", htmlProj.includes("Dimensões de referência"));
  reg("REF-09: A = 5,00 m, igual à página de vendas", htmlProj.includes("A = <!-- -->5,00 m") || htmlProj.includes("A = 5,00 m"));

  const rSemDim = await get("/projetos/REF-04", completo.cookie);
  const htmlSemDim = await rSemDim.text();
  reg("REF-04 (analogia 🟡) NÃO mostra dimensões", rSemDim.status === 200 && !htmlSemDim.includes("Dimensões de referência"));

  const rFicha = await get("/api/ficha/REF-09", completo.cookie);
  reg("completo: /api/ficha/REF-09 entrega a ficha", entregou(rFicha), `HTTP ${rFicha.status}`);
  if (LOCAL) reg("ficha sai como image/png", rFicha.headers.get("content-type") === "image/png", rFicha.headers.get("content-type") ?? "");

  const rMini = await get("/api/miniatura/REF-09", completo.cookie);
  const rFichaMini = rMini;
  reg("completo: /api/miniatura/REF-09 entrega a miniatura", entregou(rMini), `HTTP ${rMini.status}`);
  if (LOCAL) {
    const bytes = (await rMini.arrayBuffer()).byteLength;
    reg("miniatura é WebP", rFichaMini.headers.get("content-type") === "image/webp");
    reg("miniatura tem bytes", bytes > 10_000, `${Math.round(bytes / 1024)} KB`);
  }

  const rDown = await get("/api/download/ficha/REF-09", completo.cookie);
  reg("completo: download da ficha", entregou(rDown), `HTTP ${rDown.status}`);
  if (LOCAL) {
    const cd = rDown.headers.get("content-disposition") ?? "";
    reg("download vem como anexo (Content-Disposition)", cd.startsWith("attachment") && cd.includes("REF-09.png"), cd);
  }

  // ── básico: projetos sim, bônus não ───────────────────────────────────
  const rBas = await get("/inicio", basico.cookie);
  const htmlBas = await rBas.text();
  reg("básico: /inicio responde 200", rBas.status === 200, `HTTP ${rBas.status}`);
  reg("básico: NÃO mostra a seção de bônus", !htmlBas.includes("Seus bônus"));
  const rBasFicha = await get("/api/ficha/REF-01", basico.cookie);
  reg("básico: abre a ficha REF-01", entregou(rBasFicha), `HTTP ${rBasFicha.status}`);

  // ── quem não comprou toma 404, nunca 403 ──────────────────────────────
  for (const [quem, c] of [["sem acesso", sem], ["revogado (refund)", revogado]]) {
    const r1 = await get("/inicio", c.cookie);
    reg(`${quem}: /inicio responde 404 (nunca 403)`, r1.status === 404, `HTTP ${r1.status}`);
    const r2 = await get("/projetos/REF-09", c.cookie);
    reg(`${quem}: /projetos/REF-09 responde 404`, r2.status === 404, `HTTP ${r2.status}`);
    const r3 = await get("/api/ficha/REF-09", c.cookie);
    reg(`${quem}: /api/ficha/REF-09 responde 404`, r3.status === 404, `HTTP ${r3.status}`);
  }

  // ── id fora da lista real é 404, não imagem quebrada ──────────────────
  const rFora = await get("/projetos/REF-99", completo.cookie);
  reg("id fora da lista real (/projetos/REF-99) responde 404", rFora.status === 404, `HTTP ${rFora.status}`);
  const rForaApi = await get("/api/ficha/REF-99", completo.cookie);
  reg("/api/ficha/REF-99 responde 404", rForaApi.status === 404, `HTTP ${rForaApi.status}`);
  const rTravessia = await get("/api/ficha/..%2F..%2Fmotor.json", completo.cookie);
  reg("caminho forjado na URL responde 404", rTravessia.status === 404, `HTTP ${rTravessia.status}`);

  // ── sem cookie: /login ────────────────────────────────────────────────
  const rSemCookie = await get("/inicio");
  reg(
    "sem cookie: /inicio redireciona para /login",
    rSemCookie.status >= 300 && rSemCookie.status < 400 && (rSemCookie.headers.get("location") ?? "").includes("/login"),
    `HTTP ${rSemCookie.status} → ${rSemCookie.headers.get("location")}`,
  );

  // ── cookie órfão: sai pela /api/sessao-encerrada, sem laço ────────────
  const orfao = "session_token=" + "0".repeat(64);
  const rOrfao = await get("/inicio", orfao);
  const destino = rOrfao.headers.get("location") ?? "";
  reg("cookie órfão: /inicio manda para /api/sessao-encerrada", destino.includes("/api/sessao-encerrada"), `HTTP ${rOrfao.status} → ${destino}`);
  const rEnc = await get("/api/sessao-encerrada", orfao);
  const setCookie = rEnc.headers.get("set-cookie") ?? "";
  reg(
    "/api/sessao-encerrada apaga o cookie e volta ao /login?erro=",
    (rEnc.headers.get("location") ?? "").includes("/login?erro=sessao_expirada") && /session_token=;/.test(setCookie),
    `HTTP ${rEnc.status}`,
  );
  const rLoginOrfao = await get("/login?erro=sessao_expirada", orfao);
  reg("/login?erro= com cookie órfão abre o login (não volta para /inicio)", rLoginOrfao.status === 200, `HTTP ${rLoginOrfao.status}`);
} finally {
  console.log("\nLimpando dados de teste...");
  for (const c of Object.values(clientes)) await motor.limparCliente(c.id);
  console.log("Limpeza concluída.");
}

const ok = testes.length > 0 && testes.every(Boolean);
console.log(ok ? `\n>>> ACESSO OK  (${testes.length} verificações)` : `\n>>> ${testes.filter((t) => !t).length} FALHA(S) de ${testes.length}`);
process.exitCode = ok ? 0 : 1;
