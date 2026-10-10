/** Ícone da marca: uma barra fixa em traço, azul-marinho com o laranja da página de vendas. */
export function IconeMarca({ className = "marca-icone" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#0a1428" stroke="#0ea5e9" strokeOpacity=".45" />
      <path d="M13 38V16M35 38V16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M9 16h30" stroke="#ff6b1a" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 38h10M30 38h10" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Marca() {
  return (
    <span className="marca">
      <IconeMarca />
      <span className="marca-texto">
        60 Projetos de Calistenia
        <small>Área de membros</small>
      </span>
    </span>
  );
}

/** Aviso de produto digital — curto, visível, sem virar texto jurídico. */
export function AvisoTecnico() {
  return (
    <div className="aviso" role="note">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2 21h20L12 3Z" fill="#fcc419" stroke="#b07d00" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 10v5" stroke="#3f2f00" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="18" r="1.1" fill="#3f2f00" />
      </svg>
      <span>
        <strong>Fichas de referência para fabricação.</strong> As dimensões mostradas são de modelos
        equivalentes do mercado, não medidas de corte. Confira medidas, cargas e fixação antes de
        fabricar e instalar.
      </span>
    </div>
  );
}
