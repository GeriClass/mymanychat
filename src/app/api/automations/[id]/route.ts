import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  trigger: z.enum(["DM_KEYWORD", "COMMENT", "WELCOME"]).optional(),
  keywords: z.string().optional(),
  matchType: z.enum(["CONTAINS", "EXACT"]).optional(),
  replyText: z.string().min(1).optional(),
  commentReply: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  try {
    const automation = await prisma.automation.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(automation);
  } catch {
    return NextResponse.json(
      { error: "Automação não encontrada" },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.automation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Automação não encontrada" },
      { status: 404 },
    );
  }
}
