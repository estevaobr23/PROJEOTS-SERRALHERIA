import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROJETOS, projetoPorId } from "@/lib/config/projetos";
import { NavegadorProjetos } from "./navegador";

// O título da aba NÃO depende de acesso: o layout (app) já exige entitlement, e
// generateMetadata não pode ser a diferença entre quem tem e quem não tem.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = projetoPorId(id);
  return { title: p ? `${p.id} · ${p.nome}` : "Projeto" };
}

export default async function PaginaProjeto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Id fora da LISTA REAL é 404 — nunca uma página com imagem quebrada.
  if (!projetoPorId(id)) notFound();

  // A lista inteira vai para o navegador: é ela que as setas, o carrossel e o
  // feed vertical percorrem sem recarregar a página. Só dados, as imagens
  // continuam saindo pela rota protegida.
  return <NavegadorProjetos todos={PROJETOS} idInicial={id} />;
}
