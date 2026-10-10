/**
 * As 9 categorias. A CATEGORIA DE CADA PROJETO não mora aqui: vem da seção
 * "## …" da LISTA-60-EQUIPAMENTOS.md em que a REF está (campo `secao` de
 * projetos.json, gerado por `npm run sincronizar`). Aqui fica só o rótulo
 * curto que a tela mostra e a ordem dos chips.
 *
 * `secao` é o começo do título da seção na LISTA. Se alguém renomear a seção
 * lá, `testar-catalogo` acusa projeto sem categoria.
 */

export interface Categoria {
  slug: string;
  nome: string;
  secao: string;
}

export const CATEGORIAS: Categoria[] = [
  { slug: "barras-fixas", nome: "Barras fixas", secao: "Barras fixas" },
  { slug: "paralelas", nome: "Paralelas", secao: "Paralelas" },
  { slug: "monkey-bars", nome: "Monkey bars", secao: "Monkey bars" },
  { slug: "estacoes-combinadas", nome: "Estações combinadas", secao: "Estações combinadas" },
  { slug: "equilibrio", nome: "Equilíbrio", secao: "Equilíbrio" },
  { slug: "espaldar", nome: "Espaldar", secao: "Espaldar" },
  { slug: "acessorios", nome: "Acessórios", secao: "Acessórios" },
  { slug: "parques", nome: "Parques e combinações", secao: "Parques e combinações" },
  // ⚠️ NOME PROVISÓRIO — aguardando o nome final do dono. Troque só aqui.
  { slug: "novos-tipos", nome: "Novos tipos", secao: "Novos tipos" },
];

export const categoriaDaSecao = (secao: string | null) =>
  secao ? CATEGORIAS.find((c) => secao.startsWith(c.secao)) : undefined;

export const categoriaPorSlug = (slug: string) => CATEGORIAS.find((c) => c.slug === slug);
