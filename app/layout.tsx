import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mikael — Física, Astrofísica e aprendizagem",
  description:
    "Site pessoal de Mikael, estudante de Física com ênfase em Astrofísica na UFS.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Mikael — Física, Astrofísica e aprendizagem",
    description:
      "Um espaço pessoal para registrar formação, projetos, estudos e perguntas em aberto.",
    type: "website",
    locale: "pt_BR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mikael — Física, Astrofísica e aprendizagem",
    description:
      "Um espaço pessoal para registrar formação, projetos, estudos e perguntas em aberto.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
