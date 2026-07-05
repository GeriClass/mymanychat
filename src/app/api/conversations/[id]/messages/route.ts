import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendTextMessage } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const sendSchema = z.object({ text: z.string().min(1) });

// Envio manual de DM a partir da caixa de entrada
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversa não encontrada" },
      { status: 404 },
    );
  }

  try {
    await sendTextMessage({
      accessToken: conversation.account.accessToken,
      recipientId: conversation.igSenderId,
      text: parsed.data.text,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Falha ao enviar" },
      { status: 502 },
    );
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUT",
      text: parsed.data.text,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json(message, { status: 201 });
}
