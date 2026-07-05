"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  direction: "IN" | "OUT";
  text: string;
  automationId: string | null;
  createdAt: string;
};

type Conversation = {
  id: string;
  igSenderId: string;
  senderUsername: string | null;
  lastMessageAt: string;
  messages: Message[];
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConversations(await res.json());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000); // atualiza a cada 10s
    return () => clearInterval(interval);
  }, [load]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages.length]);

  async function send() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/conversations/${selected.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: draft.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Falha ao enviar");
      return;
    }
    setDraft("");
    load();
  }

  return (
    <>
      <h1>Caixa de entrada</h1>
      <p className="subtitle">
        Todas as conversas de DM da sua conta, incluindo respostas automáticas.
      </p>

      {conversations.length === 0 ? (
        <div className="card">
          <p className="muted">
            Nenhuma conversa ainda. Quando alguém mandar DM para sua conta
            conectada, a conversa aparece aqui.
          </p>
        </div>
      ) : (
        <div className="inbox-layout">
          <div className="card conv-list">
            {conversations.map((c) => (
              <button
                key={c.id}
                className={`conv-item ${c.id === selectedId ? "selected" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <strong>@{c.senderUsername ?? c.igSenderId}</strong>
                <div className="muted">
                  {c.messages.at(-1)?.text.slice(0, 40) ?? ""}
                </div>
              </button>
            ))}
          </div>

          <div className="card thread">
            {!selected ? (
              <p className="muted" style={{ padding: 16 }}>
                Selecione uma conversa ao lado.
              </p>
            ) : (
              <>
                <div className="thread-messages">
                  {selected.messages.map((m) => (
                    <div key={m.id} className={`bubble ${m.direction.toLowerCase()}`}>
                      {m.text}
                      <span className="meta">
                        {new Date(m.createdAt).toLocaleString("pt-BR")}
                        {m.automationId ? " · automática" : ""}
                      </span>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="thread-composer">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Escreva uma resposta..."
                  />
                  <button className="btn" onClick={send} disabled={sending}>
                    {sending ? "..." : "Enviar"}
                  </button>
                </div>
                {error && (
                  <p className="error-text" style={{ padding: "0 12px 10px" }}>
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
