const GRAPH_VERSION = "v23.0";

export type IncomingWhatsAppMessage = {
  from: string;
  text: string;
};

/**
 * Extrai a mensagem de texto de um payload de webhook da Meta Cloud API.
 * Retorna null para eventos que não são mensagens de texto (status de
 * entrega, mídia etc.) — a v1 só trata texto.
 */
export function parseWhatsAppWebhook(
  payload: unknown
): IncomingWhatsAppMessage | null {
  const message = (
    payload as {
      entry?: {
        changes?: {
          value?: {
            messages?: {
              type?: string;
              from?: string;
              text?: { body?: string };
            }[];
          };
        }[];
      }[];
    }
  )?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (message?.type !== "text" || !message.from || !message.text?.body) {
    return null;
  }
  return { from: message.from, text: message.text.body };
}

/** Envia uma mensagem de texto via WhatsApp Cloud API (Graph API da Meta). */
export async function sendWhatsAppText(env: Env, to: string, body: string) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: body.slice(0, 4096) }
      })
    }
  );
  if (!response.ok) {
    console.error(
      "Falha ao enviar mensagem no WhatsApp:",
      response.status,
      await response.text()
    );
  }
  return response.ok;
}
