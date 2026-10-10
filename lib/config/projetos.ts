/**
 * O CATÁLOGO DE PROJETOS — junta as fontes num tipo só.
 *
 *   projetos.json  → nome, exercício, altura de uso, instalação, categoria e o
 *                    modelo de referência (dimensões de OUTRO fabricante).
 *                    Gerado por `npm run sincronizar` a partir da pasta da
 *                    página de vendas. Nada é digitado aqui.
 *   arquivos.json  → quais fichas EXISTEM no armazenamento, com a dimensão
 *                    real. Gerado pelo mesmo script, nunca à mão.
 *   categorias.ts  → o rótulo curto de cada categoria.
 *
 * Projeto com dado e SEM ficha não aparece: card sem imagem é promessa vazia.
 */

import dados from "./projetos.json";
import arquivos from "./arquivos.json";
import { categoriaDaSecao, type Categoria } from "./categorias";

export interface Imagem {
  caminho: string;
  largura: number;
  altura: number;
}

/**
 * Medidas do modelo equivalente de OUTRO fabricante (Benito, Kompan, SKOR…).
 * A e B são a ÁREA LIVRE DE SEGURANÇA em planta, não o tamanho da peça —
 * nunca rotular como medida de corte. Campo ausente na fonte = null.
 */
export interface Referencia {
  codigo: string;
  fabricante: string | null;
  modelo: string;
  zona: { aMm: number; bMm: number } | null;
  areaM2: number | null;
  quedaMm: number | null;
  usuarios: number | null;
  tuboBarras: string | null;
}

interface ProjetoBruto {
  id: string;
  numero: string;
  nome: string;
  secao: string | null;
  exercicio: string | null;
  alturaUso: string | null;
  instalacao: string | null;
  referencia: Referencia | null;
}

/** "MÉDIA (altura do quadril…)" → { rotulo: "Média", detalhe: "Altura do quadril…" } */
export interface Rotulado {
  rotulo: string;
  detalhe: string | null;
}

export interface Projeto {
  id: string;
  /** "01", "13" — o número que a pessoa fala no suporte */
  numero: string;
  nome: string;
  categoria: Categoria;
  exercicio: string | null;
  alturaUso: Rotulado | null;
  instalacao: Rotulado | null;
  referencia: Referencia | null;
  ficha: Imagem;
  miniatura: Imagem;
}

type MapaArquivos = Record<string, { ficha?: Imagem; miniatura?: Imagem }>;

const maiusculaInicial = (t: string) => {
  const m = t.trim().toLowerCase();
  return m.charAt(0).toUpperCase() + m.slice(1);
};

/** Separa o rótulo do que vem entre parênteses. Só reformata — não reescreve. */
export function rotular(texto: string | null): Rotulado | null {
  if (!texto?.trim()) return null;
  const m = texto.match(/^([^(]+?)\s*\((.+)\)\s*$/);
  if (!m) return { rotulo: maiusculaInicial(texto), detalhe: null };
  const detalhe = m[2].trim();
  return { rotulo: maiusculaInicial(m[1]), detalhe: detalhe.charAt(0).toUpperCase() + detalhe.slice(1) };
}

function montar(p: ProjetoBruto, mapa: MapaArquivos): Projeto | null {
  const imgs = mapa[p.id];
  const categoria = categoriaDaSecao(p.secao);
  if (!imgs?.ficha || !imgs.miniatura || !categoria) return null;

  return {
    id: p.id,
    numero: p.numero,
    nome: p.nome,
    categoria,
    exercicio: p.exercicio,
    alturaUso: rotular(p.alturaUso),
    instalacao: rotular(p.instalacao),
    referencia: p.referencia,
    ficha: imgs.ficha,
    miniatura: imgs.miniatura,
  };
}

const DADOS = dados as ProjetoBruto[];

/** Os projetos que a pessoa vê, na ordem da REF. */
export const PROJETOS: Projeto[] = DADOS.map((p) => montar(p, arquivos as MapaArquivos))
  .filter((p): p is Projeto => p !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

/** Dados que existem e não aparecem (sem ficha ou sem categoria) — só teste/relatório. */
export const PROJETOS_FORA = DADOS.filter((p) => !PROJETOS.some((x) => x.id === p.id)).map((p) => p.id);

const POR_ID = new Map(PROJETOS.map((p) => [p.id, p]));

/** A LISTA REAL: id fora dela é 404, nunca imagem quebrada. */
export const projetoPorId = (id: string) => POR_ID.get(id);

/** Total que aparece na tela — vem da lista, nunca digitado em JSX. */
export const TOTAL_PROJETOS = PROJETOS.length;
