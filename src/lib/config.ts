export const config = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  instagramAppId: process.env.INSTAGRAM_APP_ID ?? "",
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET ?? "",
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN ?? "",
};

export const GRAPH_BASE = "https://graph.instagram.com/v23.0";

export const OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

export function oauthRedirectUri() {
  return `${config.appUrl}/api/auth/instagram/callback`;
}
