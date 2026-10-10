import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--fonte" });

export const metadata: Metadata = {
  title: { default: "60 Projetos de Calistenia — Área de Membros", template: "%s · 60 Projetos de Calistenia" },
  description: "Fichas ilustradas de equipamentos de calistenia para fabricar e vender.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#13233f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
