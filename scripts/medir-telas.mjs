#!/usr/bin/env node
/**
 * medir-telas.mjs — mede layout e comportamento num Chrome de verdade
 * (Playwright), em celular e desktop.
 *
 * MEDE, não tira só print: confere getBoundingClientRect(), scrollWidth, a
 * contagem do catálogo, o giro automático do visor, o botão voltar fechando o
 * visor, as setas do teclado e o login. Trave o número, não o olho. Os prints
 * vão para .verificacao/ (fora do Git) para quem precisar ver.
 *
 * Cria um cliente sintético com o plano completo, usa e LIMPA no fim.
 *
 * Uso:
 *   node scripts/medir-telas.mjs [--base http://localhost:3000]
 * Requer o servidor rodando.
 */

import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { motor, nomeDoModo } from "./_motor.mjs";

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");
const BASE = iBase >= 0 ? args[iBase + 1] : "http://localhost:3000";
const EMAIL = "e2e-telas@exemplo.invalid";

if (!existsSync(".verificacao")) mkdirSync(".verificacao");

const testes = [];
const reg = (nome, ok, detalhe = "") => {
  testes.push(ok);
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
};

const DISPOSITIVOS = [
  { nome: "celular", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { nome: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

console.log(`${nomeDoModo} · ${BASE}\n`);

const clienteId = await motor.criarCliente(EMAIL, "Marcos Teste");
await motor.liberar(clienteId, "calistenia-completo");
const cookie = await motor.criarSessao(clienteId);
const [nomeCookie, valorCookie] = cookie.split("=");

const browser = await chromium.launch();

const semRolagemHorizontal = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
/**
 * Print da página inteira esticando a JANELA até a altura do documento, e não
 * com `fullPage: true`: a captura fullPage do Chrome zera a rolagem
 * horizontal do trilho e o print sai com a ficha em branco (artefato da
 * captura — redimensionar de verdade mantém a posição, medido).
 */
async function print(page, nome) {
  const antes = page.viewportSize();
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: antes.width, height: Math.min(altura, 12000) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `.verificacao/${nome}.png` });
  await page.setViewportSize(antes);
  await page.waitForTimeout(200);
}

try {
  for (const disp of DISPOSITIVOS) {
    const { nome, ...opcoes } = disp;
    const context = await browser.newContext(opcoes);
    await context.addCookies([{ name: nomeCookie, value: valorCookie, url: BASE }]);
    const page = await context.newPage();
    const p = `${nome}:`;

    // ── Início ──────────────────────────────────────────────────────────
    await page.goto(`${BASE}/inicio`, { waitUntil: "networkidle" });
    reg(`${p} /inicio sem rolagem horizontal`, await semRolagemHorizontal(page));
    reg(`${p} saudação com o primeiro nome`, (await page.textContent("h1"))?.includes("Olá, Marcos!") ?? false);
    const atalhos = await page.$$eval(".atalhos a.atalho", (els) => els.length);
    reg(`${p} 9 atalhos de categoria`, atalhos === 9, `${atalhos}`);
    const preparando = await page.$$eval("div.atalho-preparando", (els) => els.length);
    reg(`${p} 4 bônus "Preparando" (div, não link)`, preparando === 4, `${preparando}`);
    const capaImgs = await page.$$eval(".capa-arte img", (els) => els.filter((i) => i.naturalWidth > 0).length);
    reg(`${p} capa com 3 miniaturas carregadas`, capaImgs === 3, `${capaImgs}`);
    await print(page, `${nome}_inicio`);

    // ── Catálogo ────────────────────────────────────────────────────────
    await page.goto(`${BASE}/projetos`, { waitUntil: "networkidle" });
    reg(`${p} /projetos sem rolagem horizontal`, await semRolagemHorizontal(page));
    const cards = await page.$$eval(".grade-projetos .card", (els) => els.length);
    reg(`${p} catálogo mostra os 60`, cards === 60, `${cards}`);
    await print(page, `${nome}_projetos`);

    await page.goto(`${BASE}/projetos?categoria=paralelas`, { waitUntil: "networkidle" });
    const paralelas = await page.$$eval(".grade-projetos .card", (els) => els.length);
    reg(`${p} ?categoria=paralelas filtra 7`, paralelas === 7, `${paralelas}`);

    await page.goto(`${BASE}/projetos`, { waitUntil: "networkidle" });
    await page.fill(".pesquisa-campo", "ref-09");
    await page.waitForTimeout(150);
    const umSo = await page.$$eval(".grade-projetos .card", (els) => els.map((e) => e.getAttribute("href")));
    reg(`${p} busca "ref-09" acha só a REF-09 (sem esperar a URL)`, umSo.length === 1 && umSo[0] === "/projetos/REF-09", umSo.join(","));
    await page.fill(".pesquisa-campo", "equilibrio");
    await page.waitForTimeout(150);
    const semAcento = await page.$$eval(".grade-projetos .card", (els) => els.length);
    reg(`${p} busca sem acento ("equilibrio") encontra`, semAcento >= 2, `${semAcento}`);

    // feed duplo: preferência sobrevive ao recarregar
    await page.fill(".pesquisa-campo", "");
    await page.click(".seletor-feed button:nth-child(2)");
    await page.reload({ waitUntil: "networkidle" });
    const feed = await page.getAttribute(".grade-projetos", "data-feed");
    reg(`${p} feed Duplo lembrado depois de recarregar`, feed === "duplo", feed ?? "");
    reg(`${p} /projetos (duplo) sem rolagem horizontal`, await semRolagemHorizontal(page));
    await print(page, `${nome}_projetos-duplo`);
    await page.click(".seletor-feed button:nth-child(1)");

    // ── Página do projeto COM dimensões ─────────────────────────────────
    await page.goto(`${BASE}/projetos/REF-09`, { waitUntil: "networkidle" });
    reg(`${p} /projetos/REF-09 sem rolagem horizontal`, await semRolagemHorizontal(page));
    reg(`${p} REF-09 mostra a planta de dimensões`, (await page.$(".pj-plan")) !== null);
    const fichaOk = await page.$eval(".slide[aria-hidden='false'] .prancha img", (i) => i.complete && i.naturalWidth > 1000);
    reg(`${p} ficha original carregada (> 1000 px)`, fichaOk);
    await print(page, `${nome}_projeto-REF-09`);

    // ── Página do projeto SEM dimensões ─────────────────────────────────
    await page.goto(`${BASE}/projetos/REF-41`, { waitUntil: "networkidle" });
    reg(`${p} REF-41 (sem dado de fabricante) NÃO mostra dimensões`, (await page.$(".pj-plan")) === null);
    reg(`${p} /projetos/REF-41 sem rolagem horizontal`, await semRolagemHorizontal(page));
    if (nome === "desktop") {
      const r = await page.$eval(".slide[aria-hidden='false'] .prancha", (el) => el.getBoundingClientRect().toJSON());
      reg(`${p} ficha inteira cabe na tela (sem rolar)`, r.bottom <= 900, `bottom=${Math.round(r.bottom)}px`);
    }
    // ⚠️ O print de página inteira estica a janela para a altura total e o
    // Chrome zera a rolagem horizontal do trilho — artefato da captura, não do
    // código (redimensionar de verdade mantém a posição). Por isso o print
    // vem DEPOIS das medidas de navegação, e cada uma recarrega a página.
    if (nome === "desktop") {
      // setas do teclado passam de projeto, URL e título acompanham
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(500);
      reg(`${p} → passa para REF-42 (URL)`, page.url().endsWith("/projetos/REF-42"), page.url());
      reg(`${p} título acompanha`, (await page.title()).startsWith("REF-42"), await page.title());
      await page.goto(`${BASE}/projetos/REF-41`, { waitUntil: "networkidle" });
    }
    await print(page, `${nome}_projeto-REF-41`);

    if (nome === "desktop") {
      // entra num projeto com dimensões: a coluna nova muda a largura do trilho
      await page.goto(`${BASE}/projetos/REF-12`, { waitUntil: "networkidle" });
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(700);
      const atual = await page.$eval(".pj-code", (e) => e.textContent);
      const visivel = await page.$eval(".slide[aria-hidden='false'] .prancha img", (i) => i.getAttribute("alt"));
      reg(`${p} REF-12 → REF-13: painel e ficha visível são do mesmo projeto`, atual === "REF-13" && (visivel ?? "").includes("REF-13"), `${atual} / ${visivel}`);
    } else {
      // carrossel: arrastar para o lado troca de projeto
      await page.goto(`${BASE}/projetos/REF-09`, { waitUntil: "networkidle" });
      await page.$eval(".trilho", (t) => t.scrollTo({ left: t.scrollLeft + t.clientWidth, behavior: "instant" }));
      await page.waitForTimeout(500);
      reg(`${p} arrastar o carrossel passa para REF-10`, page.url().endsWith("/projetos/REF-10"), page.url());

      // visor: abre, gira sozinho (ficha deitada em celular em pé), voltar fecha
      await page.click(".slide[aria-hidden='false'] .prancha");
      await page.waitForSelector(".visor");
      await page.waitForTimeout(600);
      const giro = await page.$eval(".visor-palco img", (i) => i.style.transform);
      reg(`${p} visor gira a ficha automaticamente`, giro.includes("rotate(90deg)"), giro || "(sem giro)");
      await page.screenshot({ path: `.verificacao/${nome}_visor.png` });
      await page.goBack();
      await page.waitForTimeout(400);
      reg(`${p} botão voltar fecha o visor`, (await page.$(".visor")) === null);
      reg(`${p} ...e continua na página do projeto`, page.url().endsWith("/projetos/REF-10"), page.url());

      // modo vertical
      await page.click(".seletor-modo button:nth-child(2)");
      await page.waitForTimeout(500);
      const paineis = await page.$$eval(".cartao-vertical", (els) => els.length);
      reg(`${p} modo vertical lista os painéis`, paineis === 60, `${paineis}`);
      reg(`${p} modo vertical sem rolagem horizontal`, await semRolagemHorizontal(page));
      await page.click(".seletor-modo button:nth-child(1)");
    }

    await context.close();
  }

  // ── Login de verdade, pelo formulário ─────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  reg("login: tela sem rolagem horizontal", await semRolagemHorizontal(pg));
  await pg.screenshot({ path: ".verificacao/celular_login.png" });
  await pg.fill("#email", "  E2E-TELAS@exemplo.invalid ");
  await Promise.all([pg.waitForURL("**/inicio", { timeout: 15000 }).catch(() => {}), pg.click("button[type=submit]")]);
  reg("login: e-mail com espaço e maiúscula entra e cai na /inicio", pg.url().endsWith("/inicio"), pg.url());
  await pg.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  reg("login: quem já entrou e abre /login volta para /inicio", pg.url().endsWith("/inicio"), pg.url());
  await pg.click(".nav form button");
  await pg.waitForURL("**/login", { timeout: 15000 }).catch(() => {});
  reg("sair: volta ao /login", pg.url().includes("/login"), pg.url());
  await pg.fill("#email", "ninguem@exemplo.invalid");
  await Promise.all([pg.waitForURL("**/login?erro=*", { timeout: 15000 }).catch(() => {}), pg.click("button[type=submit]")]);
  reg("login: e-mail sem compra não entra", pg.url().includes("erro=sem_acesso"), pg.url());
  await ctx.close();
} finally {
  await browser.close();
  await motor.limparCliente(clienteId);
}

const ok = testes.length > 0 && testes.every(Boolean);
console.log(`\nprints em .verificacao/`);
console.log(ok ? `>>> TELAS OK  (${testes.length} verificações)` : `>>> ${testes.filter((t) => !t).length} FALHA(S) de ${testes.length}`);
process.exitCode = ok ? 0 : 1;
