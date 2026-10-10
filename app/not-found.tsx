import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="conteudo" style={{ textAlign: "center", paddingTop: 80 }}>
      <h1>Página não encontrada</h1>
      <p style={{ color: "var(--tinta-2)" }}>O endereço não existe ou não faz parte do seu acesso.</p>
      <Link className="botao" href="/inicio" style={{ marginTop: 12 }}>
        Voltar ao início
      </Link>
    </main>
  );
}
