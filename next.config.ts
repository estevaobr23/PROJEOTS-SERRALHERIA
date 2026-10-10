import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As imagens dos projetos vêm do bucket privado por redirect assinado e são
  // servidas ORIGINAIS (decisão do dono: qualidade máxima). Não passam pelo
  // otimizador da Vercel.
  images: { unoptimized: true },
};

export default nextConfig;
