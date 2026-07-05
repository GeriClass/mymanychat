"use client";

import { useRouter } from "next/navigation";

export function DisconnectButton() {
  const router = useRouter();

  async function disconnect() {
    if (
      !confirm(
        "Desconectar a conta? As automações e conversas dela serão removidas.",
      )
    )
      return;
    await fetch("/api/account", { method: "DELETE" });
    router.refresh();
  }

  return (
    <button className="btn danger" onClick={disconnect}>
      Desconectar
    </button>
  );
}
