import { exigirProjetos } from "@/lib/data/biblioteca";
import { acessoAberto } from "@/lib/auth/acesso-aberto";
import { Navegacao } from "./navegacao";

/**
 * Tudo dentro de (app) exige sessão + um plano ativo que inclua os projetos
 * (todos incluem). Sem acesso, 404 — e quem tem cookie órfão vai para
 * /api/sessao-encerrada (ver requireCustomer).
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  await exigirProjetos();
  return (
    <>
      {/* sem login (acesso aberto) não há o que sair */}
      <Navegacao comSair={!acessoAberto()} />
      <main className="conteudo">{children}</main>
    </>
  );
}
