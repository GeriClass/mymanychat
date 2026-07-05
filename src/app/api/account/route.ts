import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await prisma.instagramAccount.findFirst({
    select: {
      id: true,
      igUserId: true,
      username: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(account);
}

export async function DELETE() {
  await prisma.instagramAccount.deleteMany();
  return NextResponse.json({ ok: true });
}
