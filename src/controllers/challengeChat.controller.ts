import { Request, Response } from "express";
import prisma from "../config/database";

export class ChallengeChatController {

  // 🔥 Buscar mensagens
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
              avatar_url: true
            }
          }
        },
        orderBy: { created_at: "asc" }
      });

      return res.json({ success: true, messages });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao carregar mensagens" });
    }
  }

  // 🔥 Enviar mensagem
  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { challengeId } = req.params;
      const { message } = req.body;

      if (!message || message.trim() === "") {
        return res.status(400).json({ error: "Mensagem não pode ser vazia" });
      }

      const newMessage = await prisma.challengeChat.create({
        data: {
          userId,
          challengeId,
          message
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar_url: true
            }
          }
        }
      });

      return res.json({ success: true, message: newMessage });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
}
