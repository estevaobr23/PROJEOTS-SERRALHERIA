#!/usr/bin/env node
/**
 * testar-catalogo.mjs — invariantes estáticas do catálogo e dos planos.
 *
 * Não precisa de servidor nem de banco: lê os arquivos gerados e as fontes da
 * verdade direto. Nada de importar .ts — os valores dos .ts são lidos por regex
 * (ver references/testes.md da skill area-de-membros).
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const testes = [];
const reg = (nome, ok, detalhe = "") => {
  testes.push(ok);
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? `  ${detalhe}` : ""}`);
};

const projetos = JSON.parse(readFileSync("lib/config/projetos.json", "utf8"));
const arquivos = JSON.parse(readFileSync("lib/config/arquivos.json", "utf8"));
const ofertasSrc = readFileSync("lib/config/ofertas.ts", "utf8");
const categoriasSrc = readFileSync("lib/config/categorias.ts", "utf8");
const migracao = readFileSync("supabase/migrations/0002_produtos_e_bucket.sql", "utf8");

// ── 1. cada projeto tem ficha, e cada ficha tem projeto ────────────────────
const ids = projetos.map((p) => p.id);
reg("60 projetos nos dados", ids.length === 60, `${ids.length}`);
reg("ids únicos REF-01…REF-60", new Set(ids).size === 60 && ids.every((id, i) => id === `REF-${String(i + 1).padStart(2, "0")}`));
const semFicha = ids.filter((id) => !arquivos[id]?.ficha || !arquivos[id]?.miniatura);
reg("todo projeto tem ficha e miniatura no mapa", semFicha.length === 0, `sem: ${semFicha.join(",") || "nenhum"}`);
const orfaos = Object.keys(arquivos).filter((id) => !ids.includes(id));
reg("todo arquivo no mapa tem projeto correspondente", orfaos.length === 0, `órfãos: ${orfaos.join(",") || "nenhum"}`);
const reduzidas = ids.filter((id) => arquivos[id] && (arquivos[id].miniatura.largura !== arquivos[id].ficha.largura || arquivos[id].miniatura.altura !== arquivos[id].ficha.altura));
reg("miniatura tem a MESMA resolução da ficha (qualidade máxima)", reduzidas.length === 0, `reduzidas: ${reduzidas.join(",") || "nenhuma"}`);
// Com o login ligado, NENHUMA ficha pode estar em public/ (a pasta public é pública, sem login).
const vazou = existsSync(path.join("public", "fichas"));
reg("nenhuma ficha em public/fichas (login ligado)", !vazou, vazou ? "public/fichas existe!" : "");
const deitadas = Object.values(arquivos).every((a) => a.ficha.largura > a.ficha.altura);
reg("toda ficha é deitada (giro automático faz sentido)", deitadas);

// ── 2. categoria: toda seção casa com uma categoria de categorias.ts ───────
const secoesCat = [...categoriasSrc.matchAll(/secao: "([^"]+)"/g)].map((m) => m[1]);
reg("9 categorias declaradas", secoesCat.length === 9, `${secoesCat.length}`);
const semCat = projetos.filter((p) => !secoesCat.some((s) => p.secao?.startsWith(s)));
reg("todo projeto cai numa categoria", semCat.length === 0, `sem: ${semCat.map((p) => p.id).join(",") || "nenhum"}`);
const contagem = secoesCat.map((s) => projetos.filter((p) => p.secao?.startsWith(s)).length);
reg(
  "contagem por categoria = a da LISTA (8,7,4,6,2,2,6,5,20)",
  contagem.join(",") === "8,7,4,6,2,2,6,5,20",
  contagem.join(","),
);

// ── 3. dados obrigatórios de cada ficha ────────────────────────────────────
for (const campo of ["nome", "exercicio", "alturaUso", "instalacao"]) {
  const faltando = projetos.filter((p) => !p[campo]);
  reg(`todo projeto tem ${campo}`, faltando.length === 0, `sem: ${faltando.map((p) => p.id).join(",") || "nenhum"}`);
}

// ── 4. REGRA DAS DIMENSÕES ─────────────────────────────────────────────────
const fonte = path.resolve("..", "60 EQUIPAMENTOS DE CALISTENIA FERRAGEM");
const dimsArq = path.join(fonte, "scripts", "dimensoes-fabricantes.json");
if (existsSync(dimsArq)) {
  const dims = JSON.parse(readFileSync(dimsArq, "utf8")).itens;
  const porCodigo = new Map(dims.map((d) => [d.codigo, d]));
  const comZona = projetos.filter((p) => p.referencia?.zona);
  // toda zona vem de um item que EXISTE na fonte e informa zona (A_in/B_in ou zona_seguranca*)
  const inventadas = comZona.filter((p) => {
    const d = porCodigo.get(p.referencia.codigo);
    return !d || !(typeof d.A_in === "number" || d.zona_seguranca || d.zona_seguranca_cm || d.zona_seguranca_m);
  });
  reg("toda área de segurança vem de um item da fonte que a informa", inventadas.length === 0, `suspeitas: ${inventadas.map((p) => p.id).join(",") || "nenhuma"}`);
  // conferência de conversão: o A em mm bate com A_in × 25,4 (± 10 mm)
  const conversaoErrada = comZona.filter((p) => {
    const d = porCodigo.get(p.referencia.codigo);
    return typeof d.A_in === "number" && Math.abs(p.referencia.zona.aMm - d.A_in * 25.4) > 10;
  });
  reg("conversão pol → mm confere", conversaoErrada.length === 0, `erradas: ${conversaoErrada.map((p) => p.id).join(",") || "nenhuma"}`);
} else {
  reg("fonte das dimensões acessível", false, dimsArq);
}
const lista = readFileSync(path.join(fonte, "LISTA-60-EQUIPAMENTOS.md"), "utf8");
const analogias = [...lista.matchAll(/\|\s*\d+\s*\|\s*(REF-\d{2})\s*\|[^|]*\|\s*🟡/g)].map((m) => m[1]);
const analogiaComMedida = analogias.filter((id) => {
  const p = projetos.find((x) => x.id === id);
  return p?.referencia && !p.referencia.codigo.includes("_"); // Benito herdado
});
reg("item 🟡 (analogia) não herda medida da Benito", analogiaComMedida.length === 0, `analogias: ${analogias.join(",")}`);
reg("REF-09 = 5000 × 3650 mm (igual à página de vendas)", JSON.stringify(projetos.find((p) => p.id === "REF-09")?.referencia?.zona) === '{"aMm":5000,"bMm":3650}');

// ── 5. planos: slug IDÊNTICO a products.slug, oferta igual à Cakto ─────────
const planos = [...ofertasSrc.matchAll(/slug: "([^"]+)",\s*nomeOferta: "([^"]+)",\s*ofertaCakto: "([^"]+)",\s*inclui: \[([^\]]*)\]/g)].map(
  (m) => ({ slug: m[1], nome: m[2], oferta: m[3], inclui: m[4].match(/"([a-z]+)"/g)?.map((s) => s.slice(1, -1)) ?? [] }),
);
reg("3 planos em ofertas.ts", planos.length === 3, planos.map((p) => p.slug).join(","));
for (const p of planos) {
  const linha = new RegExp(`\\('${p.slug}',\\s*'${p.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}',\\s*'${p.oferta}'\\)`);
  reg(`plano ${p.slug}: slug, nome e oferta idênticos na migration`, linha.test(migracao));
  reg(`plano ${p.slug}: inclui os projetos`, p.inclui.includes("projetos"));
}
const bonusPor = Object.fromEntries(planos.map((p) => [p.slug, p.inclui.includes("bonus")]));
reg(
  "básico SEM bônus; completo e downsell COM bônus",
  bonusPor["calistenia-basico"] === false && bonusPor["calistenia-completo"] === true && bonusPor["calistenia-downsell"] === true,
);

// ── fim ──────────────────────────────────────────────────────────────────
const ok = testes.every(Boolean);
console.log(ok ? `\n>>> CATALOGO OK  (${testes.length} verificações)` : `\n>>> ${testes.filter((t) => !t).length} FALHA(S) de ${testes.length}`);
process.exitCode = ok ? 0 : 1;
