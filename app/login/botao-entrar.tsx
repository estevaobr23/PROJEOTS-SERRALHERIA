"use client";

import { useFormStatus } from "react-dom";

/**
 * Desabilitado enquanto a action roda. Sem isso, quem toca duas vezes no
 * celular (o que é comum) dispara dois logins e cria duas sessões.
 */
export function BotaoEntrar() {
  const { pending } = useFormStatus();
  return (
    <button className="botao" type="submit" disabled={pending}>
      {pending ? "Entrando..." : "Abrir meus projetos"}
    </button>
  );
}
