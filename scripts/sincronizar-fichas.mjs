#!/usr/bin/env node
/**
 * sincronizar-fichas.mjs — leva a pasta da oferta para a área de membros.
 *
 * FONTE DA VERDADE (nada é digitado à mão na área):
 *   scripts/equipamentos-60.json      → código, nome, exercício, altura de uso
 *   PROMPT-GPT-FICHAS.md (tabela)     → instalação de cada REF
 *   LISTA-60-EQUIPAMENTOS.md          → categoria (a seção ## em que a REF está),
 *                                       status ✅/🟡 e o modelo de referência
 *   scripts/dimensoes-fabricantes.json→ medidas do modelo equivalente de OUTRO
 *                                       fabricante (área livre de segurança)
 *   assets/fichas/REF-NN.png          → as fichas ORIGINAIS (ignora -v1…-v4 e web/)
 *
 * GERA:
 *   lib/config/projetos.json  → os dados de cada projeto, já normalizados
 *   lib/config/arquivos.json  → quais fichas EXISTEM no armazenamento, com a
 *                               dimensão real lida do cabeçalho do PNG
 *
 * SITE ABERTO: o original também é copiado para public/fichas/ficha/ — é de lá
 * que o site (sem banco, sem login) serve as fichas, inclusive na Vercel.
 *
 * ARMAZENAMENTO (mesma regra do app, lib/dados/motor.ts):
 *   • com NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → sobe para o
 *     bucket PRIVADO `fichas`; arquivo que já está lá com o mesmo tamanho é
 *     pulado (retomável).
 *   • sem elas (MODO LOCAL) → copia para .dados-locais/fichas/.
 *   A ficha sobe ORIGINAL, byte a byte. A "miniatura" (usada nos cards do
 *   catálogo) NÃO perde nada: mesma resolução da ficha, WebP SEM PERDA
 *   (lossless) — pixel por pixel igual ao original, só com menos bytes.
 *   Decisão do dono: qualidade máxima, velocidade não importa.
 *
 * REGRA DAS DIMENSÕES: A e B só entram quando o modelo de referência informa a
 * ZONA DE SEGURANÇA. Item 🟡 (analogia) não herda medida de ninguém. Campo
 * ausente fica null — nunca estimado. Conversão de unidade (pol → mm, ft² → m²)
 * é só troca de unidade, arredondada a 10 mm / 0,1 m².
 *
 * Uso:
 *   node scripts/sincronizar-fichas.mjs
 *   node scripts/sincronizar-fichas.mjs --fonte "C:/caminho/da/pasta"
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const FONTE_PADRAO = path.resolve("..", "60 EQUIPAMENTOS DE CALISTENIA FERRAGEM");
const BUCKET = "fichas";

const args = process.argv.slice(2);
const iFonte = args.indexOf("--fonte");
const FONTE = iFonte >= 0 ? path.resolve(args[iFonte + 1]) : FONTE_PADRAO;

if (existsSync(".env.local")) {
  for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL = !URL_SUPA && !CHAVE;

const problemas = [];

function lerTexto(rel) {
  const arq = path.join(FONTE, rel);
  if (!existsSync(arq)) throw new Error(`não encontrado: ${arq}`);
  return readFileSync(arq, "utf8");
}

/** Linhas de tabela markdown → arrays de células (sem as bordas). */
function linhasDeTabela(texto) {
  return texto
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("|"))
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
}

/**
 * LISTA-60: cada seção "## Título (N)" e as REFs da tabela dela.
 * Confere que a seção tem exatamente as N linhas que o título promete.
 */
function lerLista() {
  const texto = lerTexto("LISTA-60-EQUIPAMENTOS.md");
  const porRef = new Map();
  const secoes = [];
  let atual = null;

  for (const linha of texto.split(/\r?\n/)) {
    const titulo = linha.match(/^##\s+(.+?)\s*\((\d+)\)/);
    if (titulo) {
      atual = { secao: titulo[1].replace(/\s+—.*$/, "").trim(), prometido: Number(titulo[2]), refs: [] };
      secoes.push(atual);
      continue;
    }
    if (/^##\s/.test(linha)) {
      atual = null;
      continue;
    }
    if (!atual || !linha.trim().startsWith("|")) continue;
    const c = linha.trim().replace(/^\||\|$/g, "").split("|").map((x) => x.trim());
    const ref = c[1]?.match(/^REF-\d{2}$/)?.[0];
    if (!ref) continue;
    atual.refs.push(ref);
    porRef.set(ref, { secao: atual.secao, status: c[3] ?? "", fonte: c[4] ?? "" });
  }

  for (const s of secoes) {
    if (s.refs.length !== s.prometido) {
      problemas.push(`LISTA: seção "${s.secao}" promete ${s.prometido} e tem ${s.refs.length}`);
    }
  }
  return { porRef, secoes };
}

/** PROMPT-GPT-FICHAS: | Código | Arquivo | Nome | Exercício | Altura | Instalação | */
function lerInstalacao() {
  const mapa = new Map();
  for (const c of linhasDeTabela(lerTexto("PROMPT-GPT-FICHAS.md"))) {
    if (/^REF-\d{2}$/.test(c[0]) && c.length >= 6) mapa.set(c[0], c[5]);
  }
  return mapa;
}

const FABRICANTES = [
  [/^JSW/, "Benito"],
  [/^KOMPAN_/, "Kompan"],
  [/^SKOR_/, "SKOR"],
  [/^KENGURU_/, "Kenguru"],
  [/^TITAN_/, "Titan Fitness"],
  [/^TORQUE_/, "Torque Fitness"],
  [/^VALOR_/, "Valor Fitness"],
];
const fabricanteDe = (codigo) => FABRICANTES.find(([re]) => re.test(codigo))?.[1] ?? null;

const arred = (n, passo) => Math.round(n / passo) * passo;
const umaCasa = (n) => Math.round(n * 10) / 10;

/** "378x246 cm", "361 x 942", "18.80 x 8.00" → [a, b] na unidade dada */
function parDeMedidas(texto) {
  const m = String(texto).match(/([\d.,]+)\s*x\s*([\d.,]+)/i);
  return m ? [Number(m[1].replace(",", ".")), Number(m[2].replace(",", "."))] : null;
}

/**
 * Qual item de dimensoes-fabricantes.json é a referência desta REF:
 *   1. o item que declara `ref: "REF-NN"` (Kompan/SKOR/Kenguru/Valor novos);
 *   2. senão, o código Benito (JSWnn) ou Kompan (FSW/PCM) citado na coluna
 *      Fonte da LISTA — SÓ se o status for ✅. 🟡 é analogia: mudou a fixação,
 *      a medida do outro não vale para ele.
 */
function referenciaDe(ref, lista, dims) {
  const direto = dims.find((d) => d.ref === ref);
  if (direto) return direto;

  const item = lista.porRef.get(ref);
  if (!item || !item.status.includes("✅")) return null;

  const benito = item.fonte.match(/Benito\s+(JSW\d{2})/);
  if (benito) return dims.find((d) => d.codigo === benito[1]) ?? null;

  const kompan = item.fonte.match(/Kompan\s+((?:FSW|PCM)\d+)/);
  if (kompan) return dims.find((d) => d.codigo === `KOMPAN_${kompan[1]}`) ?? null;

  return null;
}

/** Normaliza o item do fabricante para o que a tela usa. Ausente = null. */
function normalizarReferencia(d) {
  let aMm = null;
  let bMm = null;
  if (typeof d.A_in === "number" && typeof d.B_in === "number") {
    aMm = arred(d.A_in * 25.4, 10);
    bMm = arred(d.B_in * 25.4, 10);
  } else if (d.zona_seguranca_m) {
    const p = parDeMedidas(d.zona_seguranca_m);
    if (p) [aMm, bMm] = p.map((v) => arred(v * 1000, 10));
  } else if (d.zona_seguranca_cm || d.zona_seguranca) {
    const p = parDeMedidas(d.zona_seguranca_cm ?? d.zona_seguranca);
    if (p) [aMm, bMm] = p.map((v) => arred(v * 10, 10));
  }

  let quedaMm = null;
  if (typeof d.free_fall_in === "number") quedaMm = arred(d.free_fall_in * 25.4, 10);
  else if (typeof d.altura_queda_m === "number" && aMm !== null) quedaMm = arred(d.altura_queda_m * 1000, 10);

  return {
    codigo: d.codigo,
    fabricante: fabricanteDe(d.codigo),
    modelo: d.nome,
    zona: aMm !== null ? { aMm, bMm } : null,
    areaM2: typeof d.area_ft2 === "number" ? umaCasa(d.area_ft2 * 0.09290304) : null,
    quedaMm,
    usuarios: typeof d.users === "number" ? d.users : typeof d.usuarios === "number" ? d.usuarios : null,
    tuboBarras: typeof d.tubo_barras === "string" ? d.tubo_barras : null,
  };
}

/** Formato REAL e dimensão, lidos dos bytes — não da extensão. */
function lerImagem(arquivo) {
  const b = readFileSync(arquivo);
  if (b.toString("ascii", 1, 4) === "PNG") {
    return { bytes: b, tipo: "image/png", ext: "png", largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marca = b[i + 1];
      const tam = b.readUInt16BE(i + 2);
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
        return { bytes: b, tipo: "image/jpeg", ext: "jpg", altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
      }
      i += 2 + tam;
    }
  }
  throw new Error(`formato de imagem não reconhecido: ${arquivo}`);
}

async function listarBucket(db, pasta) {
  const tamanhos = new Map();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(pasta, { limit: 1000, offset });
    if (error) throw new Error(`listar ${pasta}: ${error.message}`);
    for (const o of data ?? []) tamanhos.set(o.name, o.metadata?.size ?? -1);
    if (!data || data.length < 1000) break;
  }
  return tamanhos;
}

async function principal() {
  if (!LOCAL && (!URL_SUPA || !CHAVE)) {
    throw new Error("Supabase configurado pela metade: defina NEXT_PUBLIC_SUPABASE_URL E SUPABASE_SERVICE_ROLE_KEY (ou nenhuma, para o modo local).");
  }

  // ── 1. dados ────────────────────────────────────────────────────────────
  const equipamentos = JSON.parse(lerTexto("scripts/equipamentos-60.json"));
  const dims = JSON.parse(lerTexto("scripts/dimensoes-fabricantes.json")).itens;
  const lista = lerLista();
  const instalacao = lerInstalacao();

  const projetos = equipamentos.map((e) => {
    const naLista = lista.porRef.get(e.codigo);
    if (!naLista) problemas.push(`${e.codigo}: não está em nenhuma seção da LISTA`);
    const inst = instalacao.get(e.codigo);
    if (!inst) problemas.push(`${e.codigo}: sem instalação na tabela do PROMPT-GPT-FICHAS`);
    const bruto = referenciaDe(e.codigo, lista, dims);
    return {
      id: e.codigo,
      numero: e.codigo.slice(4),
      nome: e.nome,
      secao: naLista?.secao ?? null,
      exercicio: e.exercicio ?? null,
      alturaUso: e.altura_uso ?? null,
      instalacao: inst ?? null,
      referencia: bruto ? normalizarReferencia(bruto) : null,
    };
  });

  writeFileSync("lib/config/projetos.json", JSON.stringify(projetos, null, 1) + "\n", "utf8");
  const comZona = projetos.filter((p) => p.referencia?.zona).length;
  console.log(`dados: ${projetos.length} projetos · ${lista.secoes.length} categorias · ${comZona} com área de segurança`);

  // ── 2. fichas ───────────────────────────────────────────────────────────
  const { default: sharp } = await import("sharp");
  let db = null;
  let noBucket = null;
  if (!LOCAL) {
    const { createClient } = await import("@supabase/supabase-js");
    db = createClient(URL_SUPA, CHAVE, { auth: { persistSession: false } });
    noBucket = { ficha: await listarBucket(db, "ficha"), miniatura: await listarBucket(db, "miniatura") };
  }

  const pastaFichas = path.join(FONTE, "assets", "fichas");
  const mapa = {};
  const semFicha = [];
  let enviados = 0;
  let reaproveitados = 0;

  async function guardar(tipo, nome, bytes, contentType) {
    const caminho = `${tipo}/${nome}`;
    if (LOCAL) {
      const destino = path.join(".dados-locais", BUCKET, tipo);
      mkdirSync(destino, { recursive: true });
      const alvo = path.join(destino, nome);
      if (existsSync(alvo) && statSync(alvo).size === bytes.length) reaproveitados++;
      else {
        writeFileSync(alvo, bytes);
        enviados++;
      }
      return caminho;
    }
    if (noBucket[tipo].get(nome) === bytes.length) {
      reaproveitados++;
      return caminho;
    }
    const { error } = await db.storage
      .from(BUCKET)
      .upload(caminho, bytes, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`upload ${caminho}: ${error.message}`);
    enviados++;
    process.stdout.write(".");
    return caminho;
  }

  for (const p of projetos) {
    // SÓ o nome exato: REF-01-v2.png e a pasta web/ são versões da página de vendas.
    const local = path.join(pastaFichas, `${p.id}.png`);
    if (!existsSync(local)) {
      semFicha.push(p.id);
      continue;
    }
    const img = lerImagem(local);
    const caminhoFicha = await guardar("ficha", `${p.id}.${img.ext}`, img.bytes, img.tipo);

    // SITE ABERTO: o original também vai para public/fichas/ficha/ (vai no Git e é servido direto).
    mkdirSync(path.join("public", "fichas", "ficha"), { recursive: true });
    const alvoSite = path.join("public", "fichas", caminhoFicha);
    if (!existsSync(alvoSite) || statSync(alvoSite).size !== img.bytes.length) writeFileSync(alvoSite, img.bytes);

    // sem resize e sem perda: effort 6 = a compressão mais cuidadosa (mais lenta, menor)
    const { data: mini, info } = await sharp(img.bytes)
      .webp({ lossless: true, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    const caminhoMini = await guardar("miniatura", `${p.id}.webp`, mini, "image/webp");

    mapa[p.id] = {
      ficha: { caminho: caminhoFicha, largura: img.largura, altura: img.altura },
      miniatura: { caminho: caminhoMini, largura: info.width, altura: info.height },
    };
  }

  writeFileSync("lib/config/arquivos.json", JSON.stringify(mapa, null, 1) + "\n", "utf8");
  console.log(
    `${LOCAL ? "modo LOCAL (.dados-locais/fichas)" : `bucket ${BUCKET}`} · gravados: ${enviados} · já estavam: ${reaproveitados}`,
  );
  console.log(`projetos com ficha: ${Object.keys(mapa).length}`);
  if (semFicha.length) console.log(`⚠️ SEM ficha (não aparecem na área): ${semFicha.join(", ")}`);

  if (problemas.length) {
    console.error(`\n✗ ${problemas.length} problema(s) nos dados de origem:`);
    for (const p of problemas) console.error(`  - ${p}`);
    process.exitCode = 1;
  }
}

// No fim do arquivo: as constantes acima precisam existir antes de rodar.
try {
  await principal();
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exitCode = 1;
}
