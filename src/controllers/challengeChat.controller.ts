import { Request, Response } from "express";
import prisma from "../config/database";

export class ChallengeChatController {

  // ------------------------------
  // 🔥 Buscar mensagens do desafio
  // ------------------------------
  static async getMessages(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;

      const messages = await prisma.challengeChat.findMany({
        where: { challengeId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
            },
          },
        },
        orderBy: { created_at: "asc" },
      });

      // 🔥 Formato que o front espera
      const formatted = messages.map((msg) => ({
        id: msg.id,
        userId: msg.userId,
        user_name: msg.user?.name ?? "Usuário",
        avatar_url: msg.user?.avatar_url ?? null,
        message: msg.message,
        created_at: msg.created_at,
      }));

      return res.json({ data: formatted });

    } catch (err) {
      console.error("[Chat] Erro ao carregar mensagens:", err);
      return res.status(500).json({ error: "Erro ao carregar mensagens" });
    }
  }

  // ------------------------------
  // 🔥 Enviar mensagem
  // ------------------------------
  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).userId; // vindo do middleware auth
      const { challengeId } = req.params;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Mensagem não pode ser vazia" });
      }

      const newMessage = await prisma.challengeChat.create({
        data: {
          userId,
          challengeId,
          message,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
            },
          },
        },
      });

      // 🔥 Formato do front
      const formatted = {
        id: newMessage.id,
        userId: newMessage.userId,
        user_name: newMessage.user?.name ?? "Usuário",
        avatar_url: newMessage.user?.avatar_url ?? null,
        message: newMessage.message,
        created_at: newMessage.created_at,
      };

      return res.json({ data: formatted });

    } catch (err) {
      console.error("[Chat] Erro ao enviar mensagem:", err);
      return res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
}
