"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "📊 Painel" },
  { href: "/automacoes", label: "⚡ Automações" },
  { href: "/inbox", label: "💬 Caixa de entrada" },
  { href: "/configuracoes", label: "⚙️ Configurações" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">
        My<span>ManyChat</span>
      </div>
      <nav>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link ${pathname === l.href ? "active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
