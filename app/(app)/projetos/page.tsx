import type { Metadata } from "next";
import { Suspense } from "react";
import { PROJETOS, TOTAL_PROJETOS } from "@/lib/config/projetos";
import { AvisoTecnico } from "@/app/_componentes/marca";
import { Catalogo, type ProjetoResumo } from "./catalogo";

export const metadata: Metadata = { title: "Projetos" };

export default function PaginaProjetos() {
  // Só o que o card e os filtros usam vai para o navegador.
  const resumos: ProjetoResumo[] = PROJETOS.map((p) => ({
    id: p.id,
    numero: p.numero,
    nome: p.nome,
    categoria: p.categoria.slug,
    categoriaNome: p.categoria.nome,
    exercicio: p.exercicio ?? "",
    altura: p.alturaUso?.rotulo ?? null,
    instalacao: p.instalacao?.rotulo ?? null,
  }));

  return (
    <>
      <header className="cabeca-catalogo">
        <span className="rotulo">Catálogo</span>
        <h1>Projetos de equipamentos de calistenia</h1>
        <p>
          <span className="numero">{TOTAL_PROJETOS}</span> projetos liberados. Pesquise pelo código, nome ou
          exercício, ou filtre pela categoria.
        </p>
      </header>

      {/* useSearchParams exige Suspense: sem ele o build falha na pré-renderização. */}
      <Suspense>
        <Catalogo projetos={resumos} />
      </Suspense>

      <div style={{ marginTop: 22 }}>
        <AvisoTecnico />
      </div>
    </>
  );
}
