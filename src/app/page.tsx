import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [account, automationCount, activeCount, conversationCount, totalRuns] =
    await Promise.all([
      prisma.instagramAccount.findFirst(),
      prisma.automation.count(),
      prisma.automation.count({ where: { isActive: true } }),
      prisma.conversation.count(),
      prisma.automation.aggregate({ _sum: { runCount: true } }),
    ]);

  const recentMessages = await prisma.message.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { conversation: { select: { senderUsername: true, igSenderId: true } } },
  });

  return (
    <>
      <h1>Painel</h1>
      <p className="subtitle">Visão geral das suas automações de DM no Instagram.</p>

      {!account && (
        <div className="card">
          <div className="row between">
            <div>
              <strong>Nenhuma conta conectada</strong>
              <p className="muted">
                Conecte sua conta profissional do Instagram para começar.
              </p>
            </div>
            <Link href="/configuracoes" className="btn">
              Conectar Instagram
            </Link>
          </div>
        </div>
      )}

      {account && (
        <div className="card">
          <div className="row between">
            <div>
              <strong>@{account.username}</strong>{" "}
              <span className="badge on">conectada</span>
              <p className="muted">
                Token válido até{" "}
                {account.tokenExpiresAt
                  ? new Date(account.tokenExpiresAt).toLocaleDateString("pt-BR")
                  : "—"}
              </p>
            </div>
            <Link href="/automacoes" className="btn">
              + Nova automação
            </Link>
          </div>
        </div>
      )}

      <div className="stat-grid">
        <div className="card">
          <div className="stat-value">{automationCount}</div>
          <div className="stat-label">Automações criadas</div>
        </div>
        <div className="card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Automações ativas</div>
        </div>
        <div className="card">
          <div className="stat-value">{conversationCount}</div>
          <div className="stat-label">Conversas</div>
        </div>
        <div className="card">
          <div className="stat-value">{totalRuns._sum.runCount ?? 0}</div>
          <div className="stat-label">Respostas automáticas enviadas</div>
        </div>
      </div>

      <div className="card">
        <strong>Atividade recente</strong>
        {recentMessages.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            Nenhuma mensagem ainda. Assim que o webhook receber DMs, elas
            aparecem aqui.
          </p>
        ) : (
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Contato</th>
                <th>Direção</th>
                <th>Mensagem</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {recentMessages.map((m) => (
                <tr key={m.id}>
                  <td>
                    @{m.conversation.senderUsername ?? m.conversation.igSenderId}
                  </td>
                  <td>
                    {m.direction === "IN" ? (
                      <span className="badge trigger">recebida</span>
                    ) : (
                      <span className="badge on">enviada</span>
                    )}
                  </td>
                  <td>{m.text.slice(0, 60)}</td>
                  <td className="muted">
                    {new Date(m.createdAt).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
