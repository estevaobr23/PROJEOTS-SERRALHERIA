#!/usr/bin/env node
/**
 * testar-tudo.mjs — build + todas as suítes + medição, num comando só, e
 * PROPAGA o exit code (um runner que engole falha já anunciou "TUDO PASSOU"
 * com teste vermelho na tela).
 *
 *   1. testar-catalogo   (estático, sem servidor)
 *   2. tsc + next build
 *   3. sobe `next start` numa porta própria
 *   4. testar-acesso e medir-telas contra ele
 *   5. testar-webhook    (no modo local avisa PENDENTE e não conta)
 *   6. derruba o servidor, sempre
 *
 * Uso: npm run testar   [-- --sem-build]
 */

import { spawn, spawnSync } from "node:child_process";

// Os testes de acesso precisam do login LIGADO, e o valor entra já no BUILD (o
// Next pode embutir variáveis do .env.local no proxy). Variável de ambiente
// vence o .env.local, então forçamos aqui para o processo inteiro e os filhos.
process.env.ACESSO_ABERTO = "0";

const PORTA = 3107;
const BASE = `http://localhost:${PORTA}`;
const semBuild = process.argv.includes("--sem-build");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const resultados = [];
function rodar(nome, cmd, args) {
  console.log(`\n${"=".repeat(70)}\n${nome}\n${"=".repeat(70)}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  resultados.push({ nome, ok: r.status === 0 });
  return r.status === 0;
}

rodar("testar-catalogo", "node", ["scripts/testar-catalogo.mjs"]);
const compilou = semBuild || (rodar("tsc", npx, ["tsc", "--noEmit", "-p", "."]) && rodar("next build", npx, ["next", "build"]));

let servidor = null;
if (compilou) {
  console.log(`\nsubindo next start em ${BASE}...`);
  // ACESSO_ABERTO=0 vence o .env.local: os testes de acesso precisam do login LIGADO.
  servidor = spawn(npx, ["next", "start", "-p", String(PORTA)], {
    stdio: "ignore",
    shell: process.platform === "win32",
    env: { ...process.env, ACESSO_ABERTO: "0" },
  });
  let pronto = false;
  for (let i = 0; i < 60 && !pronto; i++) {
    await new Promise((r) => setTimeout(r, 500));
    pronto = await fetch(`${BASE}/login`).then((r) => r.ok).catch(() => false);
  }
  if (!pronto) resultados.push({ nome: "servidor subiu", ok: false });
  else {
    rodar("testar-acesso", "node", ["scripts/testar-acesso.mjs", "--base", BASE]);
    rodar("medir-telas", "node", ["scripts/medir-telas.mjs", "--base", BASE]);
  }
}

rodar("testar-webhook (Plano Básico)", "node", ["scripts/testar-webhook.mjs", "--titulo", "Plano Básico"]);

if (servidor) {
  // no Windows o next start roda num shell: derruba a árvore inteira
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
  else servidor.kill();
}

console.log(`\n${"=".repeat(70)}`);
for (const r of resultados) console.log(`${r.ok ? "OK   " : "FALHA"} ${r.nome}`);
const falhas = resultados.filter((r) => !r.ok).length;
console.log(falhas === 0 ? `\nTUDO PASSOU (${resultados.length} etapas)` : `\n${falhas} de ${resultados.length} etapa(s) com falha`);
process.exitCode = falhas === 0 ? 0 : 1;
