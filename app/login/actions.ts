"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, findLoginEligibleCustomer } from "@/lib/auth/session";

const esquemaEmail = z.email();

/**
 * Login por e-mail, sem senha: quem tem entitlement ativo entra direto.
 *
 * A mensagem de erro é a MESMA para "e-mail não existe" e "existe mas não
 * comprou" — não confirma para um estranho quem é cliente.
 */
export async function entrar(formData: FormData) {
  const cru = String(formData.get("email") ?? "");
  const analisado = esquemaEmail.safeParse(cru.trim().toLowerCase());

  if (!analisado.success) redirect("/login?erro=email_invalido");

  // Falha de INFRAESTRUTURA (banco não configurado, Supabase fora do ar) não é
  // "e-mail sem compra": vira mensagem própria em vez da página de erro genérica.
  // O redirect() precisa ficar FORA do try — ele funciona lançando uma exceção.
  let customer;
  try {
    customer = await findLoginEligibleCustomer(analisado.data);
  } catch (e) {
    console.error("[login] falha ao consultar o motor de acesso:", e instanceof Error ? e.message : e);
    redirect("/login?erro=indisponivel");
  }
  if (!customer) redirect("/login?erro=sem_acesso");

  const cabecalhos = await headers();
  await createSession(customer.id, {
    userAgent: cabecalhos.get("user-agent"),
    ip: cabecalhos.get("x-forwarded-for"),
  });

  redirect("/inicio");
}

export async function sair() {
  await destroySession();
  redirect("/login");
}
