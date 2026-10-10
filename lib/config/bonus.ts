/**
 * OS 4 BÔNUS — conteúdo `bonus`, liberado pelos planos completo e downsell
 * (lib/config/ofertas.ts). Não são produto no banco nem entitlement próprio.
 *
 * Nenhum tem `href` enquanto o arquivo não existir — regra de bônus da skill
 * area-de-membros: "Preparando" (é seu, está sendo feito), nunca "Em breve"
 * (que é linguagem de venda). Sem link, o item é <div>, não <Link>: nunca
 * pareça clicável sem abrir nada.
 *
 * Nomes e descrições: os mesmos da página de vendas (window.OFERTA.bonus).
 */

export interface Bonus {
  slug: string;
  nome: string;
  descricao: string;
  /** null enquanto o arquivo não existe — a tela mostra "Preparando" */
  href: string | null;
}

export const BONUS: Bonus[] = [
  {
    slug: "app-precificacao",
    nome: "Aplicativo de Precificação de Venda",
    descricao: "Coloque material, mão de obra e despesas e descubra o preço de venda de cada equipamento.",
    href: null,
  },
  {
    slug: "catalogo-instagram",
    nome: "Catálogo Digital para Bio do Instagram",
    descricao: "Um catálogo com os seus modelos, pronto para o link da bio e para mandar no WhatsApp.",
    href: null,
  },
  {
    slug: "pack-posts",
    nome: "Pack de Posts para Venda",
    descricao: "Posts prontos para divulgar os equipamentos no Instagram e atrair os primeiros pedidos.",
    href: null,
  },
  {
    slug: "guia-acabamentos",
    nome: "Guia de Acabamentos para Equipamentos",
    descricao: "Pintura, galvanização e acabamento para a peça sair com cara de produto profissional.",
    href: null,
  },
];
