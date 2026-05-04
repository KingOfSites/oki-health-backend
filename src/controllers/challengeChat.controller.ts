import { Request, Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../config/database";
import { ChallengesService } from "../services/challenges.service";

// Identidade pública dentro de um desafio: prioriza nickname; cai para o
// primeiro nome do usuário; sobrenomes nunca são expostos no chat (PDF #13).
function publicChatName(user: { name?: string | null; nickname?: string | null } | null): string {
  if (!user) return "Usuário";
  const nick = user.nickname?.trim();
  if (nick) return nick;
  const first = user.name?.trim().split(/\s+/)[0];
  return first || "Usuário";
}

export class ChallengeChatController {
  static async getMessages(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;
      const userId = (req as any).userId;

      const membership = await ChallengesService.getChallengeMembership(challengeId, userId);
      if (!membership.exists) {
        return res.status(404).json({ error: "Desafio não encontrado" });
      }

      if (!membership.isParticipant && !membership.isCreator) {
        return res.status(403).json({ error: "Apenas participantes podem acessar o chat do desafio" });
      }

      const messages = await prisma.challengeChat.findMany({
        where: { challengeId },
        orderBy: { created_at: "asc" },
        include: {
          user: {
            select: {
              name: true,
              nickname: true,
              avatar_url: true,
            },
          },
        },
      });

      return res.json({
        data: messages.map((msg) => {
          // PDF #1: imagens rejeitadas são removidas do chat. Mantemos a
          // mensagem (com texto, se houver) e o status para que o autor
          // ainda receba o aviso/modal.
          const isRejected = msg.imageUrl && msg.verificationStatus === "rejected";
          return {
            id: msg.id,
            userId: msg.userId,
            user_name: publicChatName(msg.user),
            avatar_url: msg.user.avatar_url ?? null,
            message: msg.message,
            imageUrl: isRejected ? null : (msg.imageUrl ?? null),
            wasImageRejected: Boolean(isRejected),
            created_at: msg.created_at,
            verificationStatus: msg.imageUrl ? (msg.verificationStatus ?? "pending") : null,
            verifiedAt: msg.verifiedAt ?? null,
            verificationReason: msg.verificationReason ?? null,
          };
        }),
      });
    } catch (err: any) {
      console.error("[Chat] Erro ao carregar mensagens:", err);
      return res.status(500).json({ error: "Erro ao carregar mensagens" });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { challengeId } = req.params;
      const { message, imageUrl, videoUrl } = req.body;
      const mediaUrl = videoUrl || imageUrl;

      const membership = await ChallengesService.getChallengeMembership(challengeId, userId);
      if (!membership.exists) {
        return res.status(404).json({ error: "Desafio não encontrado" });
      }

      // PDF #3: criador pode enviar mensagens (mas não imagens), mesmo
      // que tenha optado por "criar e observar" (sem entrar como
      // participante). Os demais usuários precisam ser participantes.
      const isCreator = membership.isCreator;
      const isParticipantOnly = (membership as any).isParticipantOnly === true;
      const canSendText = isParticipantOnly || isCreator;
      if (!canSendText) {
        return res.status(403).json({
          error: "Apenas participantes podem enviar mensagens ou fotos no desafio",
        });
      }

      if (membership.isCancelled) {
        return res.status(409).json({
          error: "Este desafio foi cancelado e não aceita novas mensagens ou fotos",
        });
      }

      if (membership.isCompleted) {
        return res.status(409).json({
          error: "Este desafio já foi concluído e não aceita novas mensagens ou fotos",
        });
      }

      // PDF #2 e #3: precisamos das datas e do flag isObserver.
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        select: { startDate: true, endDate: true, endTime: true },
      });
      if (!challenge) {
        return res.status(404).json({ error: "Desafio não encontrado" });
      }

      // PDF #3: criador NUNCA envia imagem (mesmo se entrou como
      // participante via "criar e participar"). Apenas participantes que
      // não são o criador podem enviar foto.
      if (mediaUrl && (isCreator || !isParticipantOnly)) {
        const reason = isCreator
          ? "O criador do desafio pode enviar apenas mensagens, sem permissão para envio de imagens."
          : "Usuários no perfil de observador não podem enviar imagens ou fotografias.";
        return res.status(403).json({ error: reason });
      }

      // PDF #2: envios só são permitidos a partir da data de início e até
      // o final do período. Bloqueia tanto antes quanto depois (vai além
      // do bloqueio de "completed", já que challenge pode estar ativo mas
      // ainda não ter chegado em startDate quando o criador envia).
      const now = new Date();
      const start = new Date(challenge.startDate);
      // Considera o início como 00:00 do dia programado.
      const startOfStartDay = new Date(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate(),
        0, 0, 0, 0,
      );
      if (now < startOfStartDay) {
        return res.status(409).json({
          error: "O desafio ainda não começou. Envios só são permitidos a partir da data de início.",
        });
      }

      const end = new Date(challenge.endDate);
      if (challenge.endTime && /^\d{2}:\d{2}$/.test(challenge.endTime)) {
        const [h, m] = challenge.endTime.split(":");
        end.setHours(Number(h), Number(m), 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      if (now > end) {
        return res.status(409).json({
          error: "O período do desafio terminou. Não é possível enviar novas mensagens ou fotos.",
        });
      }

      if ((!message || !String(message).trim()) && !mediaUrl) {
        return res.status(400).json({ error: "Mensagem ou mídia (imagem/vídeo) é obrigatória" });
      }

      const created = await prisma.challengeChat.create({
        data: {
          id: randomUUID(),
          userId,
          challengeId,
          message: message || "",
          imageUrl: mediaUrl || null,
          verificationStatus: mediaUrl ? "pending" : null,
        },
        include: {
          user: {
            select: {
              name: true,
              nickname: true,
              avatar_url: true,
            },
          },
        },
      });

      // Mantém a requisição principal rápida; a verificação assíncrona continua no write path.
      if (mediaUrl) {
        setImmediate(async () => {
          try {
            const env = (await import("../config/env")).default;
            const token = req.headers.authorization?.replace("Bearer ", "");
            if (!token) return;

            const isVideo = Boolean(videoUrl);
            const messageTime = new Date(created.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            });

            const port = env.PORT || "3000";
            const baseUrl = `http://127.0.0.1:${port}`;
            const verifyEndpoint = isVideo
              ? `${baseUrl}/api/ai/verify-weight-video`
              : `${baseUrl}/api/ai/verify-gym`;

            await fetch(verifyEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                imageUrl: mediaUrl,
                videoUrl: isVideo ? mediaUrl : undefined,
                challengeId,
                messageId: created.id,
                messageTime,
              }),
            });
          } catch (verifyErr) {
            console.error(`[Chat] Falha ao iniciar verificação para a mensagem ${created.id}:`, verifyErr);
          }
        });
      }

      return res.json({
        data: {
          id: created.id,
          userId: created.userId,
          user_name: publicChatName(created.user),
          avatar_url: created.user.avatar_url ?? null,
          message: created.message,
          imageUrl: created.imageUrl ?? null,
          wasImageRejected: false,
          created_at: created.created_at,
          verificationStatus: created.imageUrl ? (created.verificationStatus ?? "pending") : null,
          verifiedAt: created.verifiedAt ?? null,
          verificationReason: created.verificationReason ?? null,
        },
      });
    } catch (err) {
      console.error("[Chat] Erro ao enviar mensagem:", err);
      return res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
}
