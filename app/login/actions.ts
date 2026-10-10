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

  const customer = await findLoginEligibleCustomer(analisado.data);
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
