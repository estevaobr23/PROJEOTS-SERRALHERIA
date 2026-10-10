import type { Metadata } from "next";
import { entrar } from "./actions";
import { BotaoEntrar } from "./botao-entrar";
import { IconeMarca } from "@/app/_componentes/marca";
import { SUPORTE } from "@/lib/config/ofertas";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  email_invalido: "Esse e-mail não parece completo. Confira e tente de novo.",
  // A MESMA mensagem para "não existe" e "existe mas não comprou": não confirma
  // para um estranho quem é cliente.
  sem_acesso:
    "Não encontramos uma compra aprovada com esse e-mail. Use o mesmo e-mail que você informou no pagamento.",
  sessao_expirada: "Sua sessão terminou. Entre de novo com o seu e-mail.",
  indisponivel: "O acesso está indisponível no momento. Tente de novo em instantes.",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagem = erro ? ERROS[erro] : null;

  return (
    <main className="login">
      <div className="login-cartao">
        <IconeMarca />
        <span className="rotulo">Área de membros</span>
        <h1>60 Projetos de Equipamentos de Calistenia</h1>
        <p className="login-sub">Entre com o e-mail que você usou na compra. Não precisa de senha.</p>

        <form action={entrar}>
          {mensagem && (
            <p className="login-erro" role="alert">
              {mensagem}
            </p>
          )}
          <label htmlFor="email">Seu e-mail de compra</label>
          <input
            id="email"
            name="email"
            type="email"
            className="campo"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="voce@exemplo.com"
            required
          />
          <BotaoEntrar />
        </form>

        {(SUPORTE.email || SUPORTE.whatsapp) && (
          <p className="login-rodape">
            Precisa de ajuda? {SUPORTE.email && <span>{SUPORTE.email}</span>}
            {SUPORTE.email && SUPORTE.whatsapp && " · "}
            {SUPORTE.whatsapp && <span>WhatsApp {SUPORTE.whatsapp}</span>}
          </p>
        )}
      </div>
    </main>
  );
}
