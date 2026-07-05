import Link from "next/link";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { DisconnectButton } from "./DisconnectButton";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const account = await prisma.instagramAccount.findFirst();

  const webhookUrl = `${config.appUrl}/api/webhooks/instagram`;
  const callbackUrl = `${config.appUrl}/api/auth/instagram/callback`;
  const envReady = Boolean(config.instagramAppId && config.instagramAppSecret);

  return (
    <>
      <h1>Configurações</h1>
      <p className="subtitle">
        Conecte sua conta do Instagram e configure o app na Meta.
      </p>

      {ok && <p className="success-text">✅ Conta conectada com sucesso!</p>}
      {erro && <p className="error-text">❌ {erro}</p>}

      <div className="card">
        <strong>Conta do Instagram</strong>
        {account ? (
          <div className="row between" style={{ marginTop: 12 }}>
            <div>
              <p>
                @{account.username} <span className="badge on">conectada</span>
              </p>
              <p className="muted">
                Token expira em{" "}
                {account.tokenExpiresAt
                  ? new Date(account.tokenExpiresAt).toLocaleDateString("pt-BR")
                  : "—"}
                . Reconecte antes dessa data para renovar.
              </p>
            </div>
            <div className="row">
              <Link href="/api/auth/instagram" className="btn secondary">
                Reconectar
              </Link>
              <DisconnectButton />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 12 }}>
              É necessária uma conta <strong>profissional</strong> (Business ou
              Creator) do Instagram.
            </p>
            {envReady ? (
              <Link href="/api/auth/instagram" className="btn">
                Conectar com Instagram
              </Link>
            ) : (
              <p className="error-text">
                Configure INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET no arquivo
                .env antes de conectar (passo a passo abaixo).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <strong>Como configurar o app na Meta</strong>
        <ol className="steps" style={{ marginTop: 10 }}>
          <li>
            Acesse{" "}
            <a
              href="https://developers.facebook.com"
              target="_blank"
              style={{ color: "var(--accent)" }}
            >
              developers.facebook.com
            </a>{" "}
            e crie um app do tipo <strong>Empresa</strong>.
          </li>
          <li>
            Adicione o produto <strong>Instagram</strong> e escolha{" "}
            <strong>API com Login do Instagram</strong>.
          </li>
          <li>
            Copie o <strong>ID do app do Instagram</strong> e a{" "}
            <strong>Chave secreta</strong> para o arquivo <code>.env</code>{" "}
            (INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET).
          </li>
          <li>
            Em <strong>Login do Instagram → URIs de redirecionamento</strong>,
            cadastre: <code>{callbackUrl}</code>
          </li>
          <li>
            Em <strong>Webhooks</strong>, cadastre a URL{" "}
            <code>{webhookUrl}</code> com o token de verificação do seu{" "}
            <code>.env</code> (WEBHOOK_VERIFY_TOKEN) e assine os campos{" "}
            <code>messages</code> e <code>comments</code>.
          </li>
          <li>
            Clique em <strong>Conectar com Instagram</strong> acima e autorize
            sua conta profissional.
          </li>
        </ol>
        <p className="muted" style={{ marginTop: 10 }}>
          💡 Em desenvolvimento local, use um túnel HTTPS (ngrok ou
          cloudflared) e coloque essa URL pública em APP_URL no .env — a Meta
          não aceita http://localhost em webhooks.
        </p>
      </div>

      <div className="card">
        <strong>URLs deste app</strong>
        <table style={{ marginTop: 10 }}>
          <tbody>
            <tr>
              <td>Webhook</td>
              <td>
                <code>{webhookUrl}</code>
              </td>
            </tr>
            <tr>
              <td>Callback OAuth</td>
              <td>
                <code>{callbackUrl}</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
