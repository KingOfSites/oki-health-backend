import { Request, Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../config/database";
import { ChallengesService } from "../services/challenges.service";

export class ChallengeChatController {
  static async getMessages(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;
      const userId = (req as any).userId;

      const membership = await ChallengesService.getChallengeMembership(challengeId, userId);
      if (!membership.exists) {
        return res.status(404).json({ error: "Desafio nÃ£o encontrado" });
      }

      if (!membership.isParticipant) {
        return res.status(403).json({ error: "Apenas participantes podem acessar o chat do desafio" });
      }

      const messages = await prisma.challengeChat.findMany({
        where: { challengeId },
        orderBy: { created_at: "asc" },
        include: {
          user: {
            select: {
              name: true,
              avatar_url: true,
            },
          },
        },
      });

      return res.json({
        data: messages.map((msg) => ({
          id: msg.id,
          userId: msg.userId,
          user_name: msg.user.name ?? "UsuÃ¡rio",
          avatar_url: msg.user.avatar_url ?? null,
          message: msg.message,
          imageUrl: msg.imageUrl ?? null,
          created_at: msg.created_at,
          verificationStatus: msg.imageUrl ? (msg.verificationStatus ?? "pending") : null,
          verifiedAt: msg.verifiedAt ?? null,
          verificationReason: msg.verificationReason ?? null,
        })),
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
        return res.status(404).json({ error: "Desafio nÃ£o encontrado" });
      }

      if (!membership.isParticipant) {
        return res.status(403).json({
          error: "Apenas participantes podem enviar mensagens ou fotos no desafio",
        });
      }

      if (membership.isCancelled) {
        return res.status(409).json({
          error: "Este desafio foi cancelado e nÃ£o aceita novas mensagens ou fotos",
        });
      }

      if (membership.isCompleted) {
        return res.status(409).json({
          error: "Este desafio jÃ¡ foi concluÃ­do e nÃ£o aceita novas mensagens ou fotos",
        });
      }

      if ((!message || !String(message).trim()) && !mediaUrl) {
        return res.status(400).json({ error: "Mensagem ou mÃ­dia (imagem/vÃ­deo) Ã© obrigatÃ³ria" });
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
              avatar_url: true,
            },
          },
        },
      });

      // MantÃ©m a requisiÃ§Ã£o principal rÃ¡pida; a verificaÃ§Ã£o assÃ­ncrona continua no write path.
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
            console.error(`[Chat] Falha ao iniciar verificaÃ§Ã£o para a mensagem ${created.id}:`, verifyErr);
          }
        });
      }

      return res.json({
        data: {
          id: created.id,
          userId: created.userId,
          user_name: created.user.name ?? "UsuÃ¡rio",
          avatar_url: created.user.avatar_url ?? null,
          message: created.message,
          imageUrl: created.imageUrl ?? null,
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
