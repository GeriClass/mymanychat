import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const automationSchema = z.object({
  name: z.string().min(1, "Dê um nome à automação"),
  trigger: z.enum(["DM_KEYWORD", "COMMENT", "WELCOME"]),
  keywords: z.string().default(""),
  matchType: z.enum(["CONTAINS", "EXACT"]).default("CONTAINS"),
  replyText: z.string().min(1, "Escreva a mensagem de resposta"),
  commentReply: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const automations = await prisma.automation.findMany({
    orderBy: { createdAt: "desc" },
    include: { account: { select: { username: true } } },
  });
  return NextResponse.json(automations);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = automationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const account = await prisma.instagramAccount.findFirst();
  if (!account) {
    return NextResponse.json(
      { error: "Conecte uma conta do Instagram antes de criar automações." },
      { status: 400 },
    );
  }

  const automation = await prisma.automation.create({
    data: { ...parsed.data, accountId: account.id },
  });
  return NextResponse.json(automation, { status: 201 });
}
