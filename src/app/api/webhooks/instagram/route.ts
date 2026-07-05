import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  processIncomingComment,
  processIncomingMessage,
} from "@/lib/automation-engine";

export const dynamic = "force-dynamic";

// GET: verificação do webhook feita pela Meta ao salvar a URL no painel
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === config.webhookVerifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  if (!config.instagramAppSecret) return true; // sem secret configurado, não dá para validar
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", config.instagramAppSecret)
      .update(rawBody)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

// POST: eventos de mensagens e comentários
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  // Guarda o evento bruto para depuração
  await prisma.webhookEvent
    .create({ data: { payload: rawBody.slice(0, 10_000) } })
    .catch(() => {});

  if (payload.object !== "instagram") {
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {
    const igAccountUserId = String(entry.id);

    // DMs chegam em entry.messaging
    for (const event of entry.messaging ?? []) {
      const text = event.message?.text;
      if (!text || event.message?.is_echo) continue;
      await processIncomingMessage({
        igAccountUserId,
        senderId: String(event.sender?.id ?? ""),
        text,
        igMessageId: event.message?.mid,
      }).catch((err) => console.error("Erro ao processar DM:", err));
    }

    // Comentários chegam em entry.changes com field "comments"
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const v = change.value ?? {};
      if (!v.text || !v.id) continue;
      await processIncomingComment({
        igAccountUserId,
        commentId: String(v.id),
        commenterId: String(v.from?.id ?? ""),
        text: v.text,
      }).catch((err) => console.error("Erro ao processar comentário:", err));
    }
  }

  // Sempre 200 rápido — a Meta reenvia eventos que não recebem 200
  return NextResponse.json({ ok: true });
}
