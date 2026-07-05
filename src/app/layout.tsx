import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "MyManyChat — DMs automáticas no Instagram",
  description:
    "Automatize respostas de DM e comentários no Instagram: palavra-chave → resposta, comentário → DM, boas-vindas e caixa de entrada.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="shell">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
