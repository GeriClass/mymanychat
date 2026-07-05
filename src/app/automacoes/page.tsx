"use client";

import { useCallback, useEffect, useState } from "react";

type Automation = {
  id: string;
  name: string;
  trigger: "DM_KEYWORD" | "COMMENT" | "WELCOME";
  keywords: string;
  matchType: "CONTAINS" | "EXACT";
  replyText: string;
  commentReply: string | null;
  isActive: boolean;
  runCount: number;
};

const TRIGGER_LABELS: Record<Automation["trigger"], string> = {
  DM_KEYWORD: "DM com palavra-chave",
  COMMENT: "Comentário → DM",
  WELCOME: "Boas-vindas (1ª mensagem)",
};

const emptyForm = {
  name: "",
  trigger: "DM_KEYWORD" as Automation["trigger"],
  keywords: "",
  matchType: "CONTAINS" as Automation["matchType"],
  replyText: "",
  commentReply: "",
};

export default function AutomacoesPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/automations");
    if (res.ok) setAutomations(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      commentReply: form.commentReply || null,
    };
    const res = await fetch(
      editingId ? `/api/automations/${editingId}` : "/api/automations",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erro ao salvar");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  async function toggle(a: Automation) {
    await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta automação?")) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(a: Automation) {
    setForm({
      name: a.name,
      trigger: a.trigger,
      keywords: a.keywords,
      matchType: a.matchType,
      replyText: a.replyText,
      commentReply: a.commentReply ?? "",
    });
    setEditingId(a.id);
    setShowForm(true);
  }

  return (
    <>
      <div className="row between">
        <div>
          <h1>Automações</h1>
          <p className="subtitle">
            Regras que respondem DMs e comentários automaticamente.
          </p>
        </div>
        <button
          className="btn"
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(!showForm);
          }}
        >
          {showForm ? "Fechar" : "+ Nova automação"}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <strong>{editingId ? "Editar automação" : "Nova automação"}</strong>

          <label>Nome</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Link do produto ao comentar EU QUERO"
          />

          <div className="grid-2">
            <div>
              <label>Gatilho</label>
              <select
                value={form.trigger}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trigger: e.target.value as Automation["trigger"],
                  })
                }
              >
                <option value="DM_KEYWORD">
                  DM recebida com palavra-chave
                </option>
                <option value="COMMENT">Comentário em post → DM</option>
                <option value="WELCOME">
                  Boas-vindas (primeira mensagem do contato)
                </option>
              </select>
            </div>
            <div>
              <label>Tipo de correspondência</label>
              <select
                value={form.matchType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    matchType: e.target.value as Automation["matchType"],
                  })
                }
                disabled={form.trigger === "WELCOME"}
              >
                <option value="CONTAINS">Contém a palavra</option>
                <option value="EXACT">Texto exato</option>
              </select>
            </div>
          </div>

          {form.trigger !== "WELCOME" && (
            <>
              <label>Palavras-chave (separadas por vírgula)</label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="eu quero, quero, link"
              />
              <p className="muted" style={{ marginTop: 4 }}>
                Deixe vazio para disparar com qualquer{" "}
                {form.trigger === "COMMENT" ? "comentário" : "mensagem"}.
              </p>
            </>
          )}

          <label>Mensagem enviada por DM</label>
          <textarea
            value={form.replyText}
            onChange={(e) => setForm({ ...form, replyText: e.target.value })}
            placeholder="Oi! 👋 Aqui está o link que você pediu: https://..."
          />

          {form.trigger === "COMMENT" && (
            <>
              <label>Resposta pública ao comentário (opcional)</label>
              <input
                value={form.commentReply}
                onChange={(e) =>
                  setForm({ ...form, commentReply: e.target.value })
                }
                placeholder="Te chamei na DM! 💌"
              />
            </>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar automação"}
            </button>
          </div>
        </div>
      )}

      {automations.length === 0 && !showForm && (
        <div className="card">
          <p className="muted">
            Nenhuma automação ainda. Crie a primeira — por exemplo: quando
            alguém comentar <code>EU QUERO</code> em um post, enviar o link do
            produto por DM.
          </p>
        </div>
      )}

      {automations.map((a) => (
        <div className="card" key={a.id}>
          <div className="row between">
            <div>
              <div className="row">
                <strong>{a.name}</strong>
                <span className="badge trigger">
                  {TRIGGER_LABELS[a.trigger]}
                </span>
                <span className={`badge ${a.isActive ? "on" : "off"}`}>
                  {a.isActive ? "ativa" : "pausada"}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                {a.trigger !== "WELCOME" && a.keywords
                  ? `Palavras: ${a.keywords} · `
                  : ""}
                Resposta: “{a.replyText.slice(0, 70)}
                {a.replyText.length > 70 ? "…" : ""}” · Disparou {a.runCount}×
              </p>
            </div>
            <div className="row">
              <button className="btn secondary" onClick={() => toggle(a)}>
                {a.isActive ? "Pausar" : "Ativar"}
              </button>
              <button className="btn secondary" onClick={() => startEdit(a)}>
                Editar
              </button>
              <button className="btn danger" onClick={() => remove(a.id)}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
