import { prisma } from "./db";
import {
  getUserProfile,
  replyToComment,
  sendPrivateReplyToComment,
  sendTextMessage,
} from "./instagram";

// Motor de automações: recebe eventos do webhook e decide o que responder.

function matches(text: string, keywords: string, matchType: string): boolean {
  const list = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true; // sem palavra-chave = dispara sempre

  const normalized = text.trim().toLowerCase();
  if (matchType === "EXACT") return list.includes(normalized);
  return list.some((k) => normalized.includes(k));
}

async function upsertConversation(accountId: string, igSenderId: string) {
  return prisma.conversation.upsert({
    where: { accountId_igSenderId: { accountId, igSenderId } },
    create: { accountId, igSenderId },
    update: { lastMessageAt: new Date() },
  });
}

async function recordOutgoing(
  conversationId: string,
  text: string,
  automationId?: string,
) {
  await prisma.message.create({
    data: { conversationId, direction: "OUT", text, automationId },
  });
}

/** Processa uma DM recebida. Retorna quantas automações dispararam. */
export async function processIncomingMessage(evt: {
  igAccountUserId: string; // ID da nossa conta (destinatário)
  senderId: string; // ID de quem mandou
  text: string;
  igMessageId?: string;
}): Promise<number> {
  const account = await prisma.instagramAccount.findUnique({
    where: { igUserId: evt.igAccountUserId },
  });
  if (!account) return 0;
  if (evt.senderId === evt.igAccountUserId) return 0; // eco das nossas mensagens

  // Dedupe: webhooks podem ser reentregues
  if (evt.igMessageId) {
    const existing = await prisma.message.findUnique({
      where: { igMessageId: evt.igMessageId },
    });
    if (existing) return 0;
  }

  const conversation = await upsertConversation(account.id, evt.senderId);
  const isFirstContact =
    (await prisma.message.count({
      where: { conversationId: conversation.id },
    })) === 0;

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "IN",
      text: evt.text,
      igMessageId: evt.igMessageId,
    },
  });

  // Preenche o username do contato na primeira mensagem
  if (!conversation.senderUsername) {
    const profile = await getUserProfile(account.accessToken, evt.senderId);
    if (profile?.username) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { senderUsername: profile.username },
      });
    }
  }

  const automations = await prisma.automation.findMany({
    where: { accountId: account.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  let fired = 0;
  for (const a of automations) {
    const applies =
      a.trigger === "DM_KEYWORD"
        ? matches(evt.text, a.keywords, a.matchType)
        : a.trigger === "WELCOME"
          ? isFirstContact
          : false;
    if (!applies) continue;

    try {
      await sendTextMessage({
        accessToken: account.accessToken,
        recipientId: evt.senderId,
        text: a.replyText,
      });
      await recordOutgoing(conversation.id, a.replyText, a.id);
      await prisma.automation.update({
        where: { id: a.id },
        data: { runCount: { increment: 1 } },
      });
      fired++;
      // Uma resposta por mensagem é o suficiente — evita spam de automações
      break;
    } catch (err) {
      console.error(`Automação ${a.name} falhou:`, err);
    }
  }
  return fired;
}

/** Processa um comentário novo em um post da conta. */
export async function processIncomingComment(evt: {
  igAccountUserId: string;
  commentId: string;
  commenterId: string;
  text: string;
}): Promise<number> {
  const account = await prisma.instagramAccount.findUnique({
    where: { igUserId: evt.igAccountUserId },
  });
  if (!account) return 0;
  if (evt.commenterId === evt.igAccountUserId) return 0; // nosso próprio comentário

  const automations = await prisma.automation.findMany({
    where: { accountId: account.id, isActive: true, trigger: "COMMENT" },
    orderBy: { createdAt: "asc" },
  });

  let fired = 0;
  for (const a of automations) {
    if (!matches(evt.text, a.keywords, a.matchType)) continue;

    try {
      // Resposta pública ao comentário (opcional)
      if (a.commentReply) {
        await replyToComment({
          accessToken: account.accessToken,
          commentId: evt.commentId,
          text: a.commentReply,
        });
      }
      // DM privada para quem comentou (o recurso "comentário -> DM")
      await sendPrivateReplyToComment({
        accessToken: account.accessToken,
        commentId: evt.commentId,
        text: a.replyText,
      });

      const conversation = await upsertConversation(
        account.id,
        evt.commenterId,
      );
      await recordOutgoing(conversation.id, a.replyText, a.id);
      await prisma.automation.update({
        where: { id: a.id },
        data: { runCount: { increment: 1 } },
      });
      fired++;
      break;
    } catch (err) {
      console.error(`Automação ${a.name} falhou:`, err);
    }
  }
  return fired;
}
