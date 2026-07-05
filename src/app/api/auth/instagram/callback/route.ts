import { NextRequest, NextResponse } from "next/server";
import { config, oauthRedirectUri } from "@/lib/config";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getMe,
} from "@/lib/instagram";

export const dynamic = "force-dynamic";

// Callback do OAuth: troca o code por token e salva a conta
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${config.appUrl}/configuracoes?erro=${encodeURIComponent(error)}`,
    );
  }
  if (!code) {
    return NextResponse.redirect(
      `${config.appUrl}/configuracoes?erro=Autoriza%C3%A7%C3%A3o%20cancelada`,
    );
  }

  try {
    const shortLived = await exchangeCodeForToken(code, oauthRedirectUri());
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const me = await getMe(longLived.access_token);

    const igUserId = String(me.user_id ?? shortLived.user_id);
    const expiresAt = new Date(Date.now() + longLived.expires_in * 1000);

    await prisma.instagramAccount.upsert({
      where: { igUserId },
      create: {
        igUserId,
        username: me.username ?? igUserId,
        accessToken: longLived.access_token,
        tokenExpiresAt: expiresAt,
      },
      update: {
        username: me.username ?? igUserId,
        accessToken: longLived.access_token,
        tokenExpiresAt: expiresAt,
      },
    });

    return NextResponse.redirect(`${config.appUrl}/configuracoes?ok=1`);
  } catch (err: any) {
    console.error("Erro no callback OAuth:", err);
    return NextResponse.redirect(
      `${config.appUrl}/configuracoes?erro=${encodeURIComponent(err.message ?? "Falha ao conectar")}`,
    );
  }
}
