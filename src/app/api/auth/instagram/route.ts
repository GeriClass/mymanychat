import { NextResponse } from "next/server";
import { OAUTH_SCOPES, config, oauthRedirectUri } from "@/lib/config";

export const dynamic = "force-dynamic";

// Redireciona para a tela de autorização do Instagram
export async function GET() {
  if (!config.instagramAppId) {
    return NextResponse.json(
      { error: "Configure INSTAGRAM_APP_ID no .env antes de conectar." },
      { status: 500 },
    );
  }

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.instagramAppId);
  url.searchParams.set("redirect_uri", oauthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OAUTH_SCOPES);

  return NextResponse.redirect(url);
}
