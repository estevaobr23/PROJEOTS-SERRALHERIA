"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHAVE_ULTIMA_BUSCA } from "@/lib/rotulos";

/** Volta para o catálogo COM os filtros que a pessoa tinha deixado. */
export function VoltarAoCatalogo() {
  const [href, setHref] = useState("/projetos");
  useEffect(() => {
    try {
      const busca = sessionStorage.getItem(CHAVE_ULTIMA_BUSCA);
      if (busca) setHref(`/projetos?${busca}`);
    } catch {
      /* storage bloqueado: volta sem filtro */
    }
  }, []);
  return (
    <Link href={href} className="voltar">
      ← Voltar aos projetos
    </Link>
  );
}
