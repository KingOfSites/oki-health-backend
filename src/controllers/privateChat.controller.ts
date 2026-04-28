import { Request, Response } from "express";
import prisma from "../config/database";
import { ChallengesService } from "../services/challenges.service";
import { randomUUID } from "crypto";

function orderPair(a: string, b: string) {
  return a < b ? [a, b] as const : [b, a] as const;
}

async function ensureBothAreParticipants(challengeId: string, userIdA: string, userIdB: string) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      createdById: true,
      participants: {
        where: { userId: { in: [userIdA, userIdB] } },
        select: { userId: true },
      },
      status: true,
    },
  });

  if (!challenge) return { exists: false as const };

  const participants = new Set<string>();
  if (challenge.createdById) participants.add(challenge.createdById);
  for (const p of challenge.participants) participants.add(p.userId);

  const okA = participants.has(userIdA);
  const okB = participants.has(userIdB);

  return {
    exists: true as const,
    okA,
    okB,
    isCancelled: challenge.status === "cancelled",
    isCompleted: challenge.status === "completed",
  };
}

export class PrivateChatController {
  // GET /challenges/:challengeId/private-conversations
  static async listConversations(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;
      const userId = (req as any).userId as string;

      const membership = await ChallengesService.getChallengeMembership(challengeId, userId);
      if (!membership.exists) return res.status(404).json({ error: "Desafio não encontrado" });
      if (!membership.isParticipant) return res.status(403).json({ error: "Apenas participantes podem acessar o chat privado" });

      const conversations = await prisma.privateConversation.findMany({
        where: {
          challengeId,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        orderBy: [{ lastMessageAt: "desc" }, { updated_at: "desc" }],
        include: {
          userA: { select: { id: true, name: true, nickname: true, avatar_url: true } },
          userB: { select: { id: true, name: true, nickname: true, avatar_url: true } },
          messages: {
            take: 1,
            orderBy: { created_at: "desc" },
            select: { message: true, created_at: true, senderId: true },
          },
        },
      });

      return res.json({
        data: conversations.map((c) => {
          const other = c.userAId === userId ? c.userB : c.userA;
          const last = c.messages[0] || null;
          return {
            id: c.id,
            challengeId: c.challengeId,
            otherUser: other,
            lastMessage: last ? { ...last } : null,
            lastMessageAt: c.lastMessageAt,
            updated_at: c.updated_at,
          };
        }),
      });
    } catch (err) {
      console.error("[PrivateChat] Erro ao listar conversas:", err);
      return res.status(500).json({ error: "Erro ao listar conversas" });
    }
  }

  // POST /challenges/:challengeId/private-conversations { otherUserId }
  static async getOrCreateConversation(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;
      const userId = (req as any).userId as string;
      const { otherUserId } = req.body || {};

      if (!otherUserId || typeof otherUserId !== "string") {
        return res.status(400).json({ error: "otherUserId é obrigatório" });
      }
      if (otherUserId === userId) {
        return res.status(400).json({ error: "Não é possível criar conversa com você mesmo" });
      }

      const membership = await ChallengesService.getChallengeMembership(challengeId, userId);
      if (!membership.exists) return res.status(404).json({ error: "Desafio não encontrado" });
      if (!membership.isParticipant) return res.status(403).json({ error: "Apenas participantes podem acessar o chat privado" });

      const both = await ensureBothAreParticipants(challengeId, userId, otherUserId);
      if (!both.exists) return res.status(404).json({ error: "Desafio não encontrado" });
      if (!both.okB) return res.status(403).json({ error: "O outro usuário não é participante deste desafio" });

      const [userAId, userBId] = orderPair(userId, otherUserId);

      const existing = await prisma.privateConversation.findUnique({
        where: { challengeId_userAId_userBId: { challengeId, userAId, userBId } },
        include: {
          userA: { select: { id: true, name: true, nickname: true, avatar_url: true } },
          userB: { select: { id: true, name: true, nickname: true, avatar_url: true } },
        },
      });
      if (existing) {
        const other = existing.userAId === userId ? existing.userB : existing.userA;
        return res.json({ data: { id: existing.id, challengeId, otherUser: other } });
      }

      const created = await prisma.privateConversation.create({
        data: {
          id: randomUUID(),
          challengeId,
          userAId,
          userBId,
        },
        include: {
          userA: { select: { id: true, name: true, nickname: true, avatar_url: true } },
          userB: { select: { id: true, name: true, nickname: true, avatar_url: true } },
        },
      });

      const other = created.userAId === userId ? created.userB : created.userA;
      return res.json({ data: { id: created.id, challengeId, otherUser: other } });
    } catch (err) {
      console.error("[PrivateChat] Erro ao criar conversa:", err);
      return res.status(500).json({ error: "Erro ao criar conversa" });
    }
  }

  // GET /challenges/private-conversations/:conversationId/messages
  static async getMessages(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).userId as string;

      const convo = await prisma.privateConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, challengeId: true, userAId: true, userBId: true },
      });
      if (!convo) return res.status(404).json({ error: "Conversa não encontrada" });
      if (convo.userAId !== userId && convo.userBId !== userId) {
        return res.status(403).json({ error: "Sem acesso a esta conversa" });
      }

      const messages = await prisma.privateMessage.findMany({
        where: { conversationId },
        orderBy: { created_at: "asc" },
        include: {
          sender: { select: { id: true, name: true, nickname: true, avatar_url: true } },
        },
      });

      return res.json({
        data: messages.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          sender: m.sender,
          message: m.message,
          created_at: m.created_at,
          readAt: m.readAt,
        })),
      });
    } catch (err) {
      console.error("[PrivateChat] Erro ao carregar mensagens:", err);
      return res.status(500).json({ error: "Erro ao carregar mensagens" });
    }
  }

  // POST /challenges/private-conversations/:conversationId/messages { message }
  static async sendMessage(req: Request, res: Response) {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).userId as string;
      const { message } = req.body || {};

      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: "Mensagem é obrigatória" });
      }

      const convo = await prisma.privateConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, challengeId: true, userAId: true, userBId: true },
      });
      if (!convo) return res.status(404).json({ error: "Conversa não encontrada" });
      if (convo.userAId !== userId && convo.userBId !== userId) {
        return res.status(403).json({ error: "Sem acesso a esta conversa" });
      }

      // Extra segurança: se alguém foi removido/cancelado, isso ainda passa (não há remoção hoje),
      // mas garantimos que o desafio não está cancelado/completo.
      const both = await ensureBothAreParticipants(convo.challengeId, convo.userAId, convo.userBId);
      if (!both.exists) return res.status(404).json({ error: "Desafio não encontrado" });
      if (both.isCancelled) return res.status(409).json({ error: "Desafio cancelado: chat privado indisponível" });

      const created = await prisma.privateMessage.create({
        data: {
          id: randomUUID(),
          conversationId: convo.id,
          senderId: userId,
          message: String(message),
        },
        include: { sender: { select: { id: true, name: true, nickname: true, avatar_url: true } } },
      });

      await prisma.privateConversation.update({
        where: { id: convo.id },
        data: { lastMessageAt: created.created_at },
      });

      return res.json({
        data: {
          id: created.id,
          conversationId: created.conversationId,
          senderId: created.senderId,
          sender: created.sender,
          message: created.message,
          created_at: created.created_at,
          readAt: created.readAt,
        },
      });
    } catch (err) {
      console.error("[PrivateChat] Erro ao enviar mensagem:", err);
      return res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
}

