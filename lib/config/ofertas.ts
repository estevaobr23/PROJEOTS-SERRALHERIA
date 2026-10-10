// O CATÁLOGO: o que existe para entregar, e qual plano libera o quê.
//
// Divisão de responsabilidade com o motor de compras:
//   • a tabela `products` guarda o que a Cakto precisa casar (name, cakto_product_id);
//   • este arquivo guarda o que a PESSOA vê e o que cada compra abre.
//
// ESCADA DE PREÇO NA CAKTO: UM produto, TRÊS ofertas. As três chegam no webhook
// com o MESMO product.id e o MESMO nome de produto — só offer.id e offer.name
// as distinguem. Por isso cada OFERTA é uma linha em `products` (ver
// supabase/migrations/0002_produtos_e_bucket.sql) e cada linha tem um PLANO aqui.
//
// O webhook grava UM entitlement: o plano que ela comprou. O que esse plano
// libera (`inclui`) é derivado AQUI, na aplicação — vale retroativamente se a
// composição mudar, e o banco não mente sobre o que foi vendido.
//
// Os 4 bônus NÃO são produto no banco: são o conteúdo `bonus`, liberado pelos
// planos completo e downsell.

/** O que existe para abrir. Não é produto no banco — é conteúdo. */
export type Conteudo = "projetos" | "bonus";

export interface Plano {
  /**
   * ⚠️ IDÊNTICO a products.slug. É a chave que liga o entitlement a este plano.
   * Divergiu, a pessoa paga e vê tela vazia. `testar-catalogo` trava isso.
   */
  slug: string;
  /** IDÊNTICO ao nome da OFERTA na Cakto (products.name) — rede de segurança do casamento por título */
  nomeOferta: string;
  /** id da oferta na Cakto (products.cakto_product_id) */
  ofertaCakto: string;
  inclui: Conteudo[];
}

/** O id do PRODUTO na Cakto, igual nas três ofertas. Só para referência/auditoria. */
export const PRODUTO_CAKTO = "8992525f-e02b-4434-bc1b-e2d080a88772";

export const PLANOS: Plano[] = [
  { slug: "calistenia-completo", nomeOferta: "Plano Completo", ofertaCakto: "65nvamg", inclui: ["projetos", "bonus"] },
  { slug: "calistenia-basico", nomeOferta: "Plano Básico", ofertaCakto: "y7ff8v6", inclui: ["projetos"] },
  {
    slug: "calistenia-downsell",
    nomeOferta: "Plano Completo - Oferta Especial",
    ofertaCakto: "39fhwfu",
    inclui: ["projetos", "bonus"],
  },
];

export const planoPorSlug = (slug: string) => PLANOS.find((p) => p.slug === slug);

/** O nome do material, como está no produto da Cakto. */
export const NOME_PRODUTO = "60 Projetos de Equipamentos de Calistenia para Fabricar e Vender";

/**
 * Contato de suporte. VAZIO de propósito: não invente e-mail nem WhatsApp — as
 * telas escondem o bloco enquanto estiver em branco. Preencha com o MESMO
 * endereço cadastrado no produto da Cakto.
 */
export const SUPORTE = {
  email: "",
  whatsapp: "",
};
