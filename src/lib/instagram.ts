import { GRAPH_BASE, config } from "./config";

// Cliente fino sobre a Graph API do Instagram (API com Login do Instagram).
// Docs: https://developers.facebook.com/docs/instagram-platform

async function graphFetch(
  path: string,
  init: RequestInit & { accessToken: string },
): Promise<any> {
  const { accessToken, ...rest } = init;
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url, rest);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Instagram API: ${msg}`);
  }
  return body;
}

/** Envia uma DM de texto para um usuário. */
export function sendTextMessage(opts: {
  accessToken: string;
  recipientId: string;
  text: string;
}) {
  return graphFetch(`/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: opts.recipientId },
      message: { text: opts.text },
    }),
    accessToken: opts.accessToken,
  });
}

/** Envia uma DM privada em resposta a um comentário (comentário -> DM). */
export function sendPrivateReplyToComment(opts: {
  accessToken: string;
  commentId: string;
  text: string;
}) {
  return graphFetch(`/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: opts.commentId },
      message: { text: opts.text },
    }),
    accessToken: opts.accessToken,
  });
}

/** Responde publicamente a um comentário. */
export function replyToComment(opts: {
  accessToken: string;
  commentId: string;
  text: string;
}) {
  return graphFetch(`/${opts.commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: opts.text }),
    accessToken: opts.accessToken,
  });
}

/** Perfil da conta conectada. */
export function getMe(accessToken: string) {
  return graphFetch(`/me?fields=user_id,username,account_type`, {
    method: "GET",
    accessToken,
  });
}

/** Perfil público básico de um contato (nome de usuário). */
export async function getUserProfile(accessToken: string, igUserId: string) {
  try {
    return await graphFetch(`/${igUserId}?fields=username,name`, {
      method: "GET",
      accessToken,
    });
  } catch {
    return null; // perfil pode não estar acessível — não é fatal
  }
}

/** Troca o code do OAuth por um token de curta duração. */
export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const form = new URLSearchParams({
    client_id: config.instagramAppId,
    client_secret: config.instagramAppSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Falha ao trocar code por token: ${body?.error_message ?? res.status}`,
    );
  }
  return body as { access_token: string; user_id: string };
}

/** Troca o token de curta duração por um de longa duração (60 dias). */
export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.instagramAppSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Falha ao obter token de longa duração: ${body?.error?.message ?? res.status}`,
    );
  }
  return body as { access_token: string; expires_in: number };
}
