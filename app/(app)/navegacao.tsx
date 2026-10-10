"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marca } from "@/app/_componentes/marca";
import { sair } from "@/app/login/actions";

const LINKS = [
  { href: "/inicio", nome: "Início" },
  { href: "/projetos", nome: "Projetos" },
];

export function Navegacao({ comSair = true }: { comSair?: boolean }) {
  const caminho = usePathname();
  return (
    <header className="barra">
      <div className="barra-dentro">
        <Link href="/inicio" aria-label="Início">
          <Marca />
        </Link>
        <nav className="nav" aria-label="Principal">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={caminho.startsWith(l.href) ? "page" : undefined}>
              {l.nome}
            </Link>
          ))}
          {comSair && (
            <form action={sair}>
              <button type="submit">Sair</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
