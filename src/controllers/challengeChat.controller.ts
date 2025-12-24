import { Request, Response } from "express";
import prisma from "../config/database";

export class ChallengeChatController {

  // ------------------------------
  // 🔥 Buscar mensagens do desafio
  // ------------------------------
  static async getMessages(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;

      // Tentar buscar mensagens incluindo imageUrl
      let messages: any[];
      try {
        messages = await prisma.$queryRawUnsafe(
          `SELECT 
            c.id,
            c.userId,
            c.challengeId,
            c.message,
            c.imageUrl,
            c.created_at,
            u.name as user_name,
            u.avatar_url
           FROM challenge_chat c
           JOIN users u ON c.userId = u.id
           WHERE c.challengeId = ?
           ORDER BY c.created_at ASC`,
          challengeId
        ) as any[];
      } catch (err: any) {
        // Se falhar (coluna imageUrl não existe), buscar sem imageUrl
        if (err.code === "P2010" || err.meta?.code === "1054" || err.message?.includes("imageUrl")) {
          messages = await prisma.$queryRawUnsafe(
            `SELECT 
              c.id,
              c.userId,
              c.challengeId,
              c.message,
              c.created_at,
              u.name as user_name,
              u.avatar_url
             FROM challenge_chat c
             JOIN users u ON c.userId = u.id
             WHERE c.challengeId = ?
             ORDER BY c.created_at ASC`,
            challengeId
          ) as any[];
        } else {
          throw err;
        }
      }

      // 🔥 Formato que o front espera
      const formatted = messages.map((msg) => ({
        id: msg.id,
        userId: msg.userId,
        user_name: msg.user_name ?? "Usuário",
        avatar_url: msg.avatar_url ?? null,
        message: msg.message,
        imageUrl: msg.imageUrl ?? null,
        created_at: msg.created_at,
      }));

      return res.json({ data: formatted });

    } catch (err: any) {
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
      const { message, imageUrl } = req.body;

      if (!message || !message.trim()) {
        if (!imageUrl) {
          return res.status(400).json({ error: "Mensagem ou imagem é obrigatória" });
        }
      }

      // Inserir mensagem com ou sem imageUrl
      const messageId = require("crypto").randomUUID();
      
      if (imageUrl) {
        // Tentar inserir com imageUrl (URL do Firebase)
        console.log(`[Chat] Tentando salvar mensagem com imagem: ${imageUrl.substring(0, 50)}...`);
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO challenge_chat (id, userId, challengeId, message, imageUrl, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            messageId,
            userId,
            challengeId,
            message || "",
            imageUrl
          );
          console.log(`[Chat] ✅ Mensagem com imagem salva com sucesso!`);
        } catch (err: any) {
          // Se falhar (coluna imageUrl não existe), inserir sem imageUrl
          if (err.code === "P2010" || err.meta?.code === "1054" || err.message?.includes("imageUrl")) {
            console.warn(`[Chat] ⚠️ Coluna imageUrl não existe. Salvando sem imagem. Execute: ALTER TABLE challenge_chat ADD COLUMN imageUrl VARCHAR(500) NULL;`);
            await prisma.$executeRawUnsafe(
              `INSERT INTO challenge_chat (id, userId, challengeId, message, created_at) 
               VALUES (?, ?, ?, ?, NOW())`,
              messageId,
              userId,
              challengeId,
              message || ""
            );
          } else {
            throw err;
          }
        }
      } else {
        // Inserir sem imageUrl
        await prisma.$executeRawUnsafe(
          `INSERT INTO challenge_chat (id, userId, challengeId, message, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          messageId,
          userId,
          challengeId,
          message || ""
        );
      }
      
      // Buscar a mensagem criada (tentar com imageUrl, se falhar buscar sem)
      let result: any[];
      try {
        result = await prisma.$queryRawUnsafe(
          `SELECT 
            c.id,
            c.userId,
            c.challengeId,
            c.message,
            c.imageUrl,
            c.created_at,
            u.name,
            u.avatar_url 
           FROM challenge_chat c 
           JOIN users u ON c.userId = u.id 
           WHERE c.id = ?`,
          messageId
        ) as any[];
      } catch (err: any) {
        // Se falhar (coluna imageUrl não existe), buscar sem imageUrl
        if (err.code === "P2010" || err.meta?.code === "1054" || err.message?.includes("imageUrl")) {
          result = await prisma.$queryRawUnsafe(
            `SELECT 
              c.id,
              c.userId,
              c.challengeId,
              c.message,
              c.created_at,
              u.name,
              u.avatar_url 
             FROM challenge_chat c 
             JOIN users u ON c.userId = u.id 
             WHERE c.id = ?`,
            messageId
          ) as any[];
        } else {
          throw err;
        }
      }
      
      const newMessage = {
        ...result[0],
        user: {
          name: result[0].name,
          avatar_url: result[0].avatar_url,
        },
      };

      const msg = newMessage;

      // 🔥 Formato do front
      const formatted = {
        id: msg.id,
        userId: msg.userId,
        user_name: (msg.user?.name || msg.name) ?? "Usuário",
        avatar_url: (msg.user?.avatar_url || msg.avatar_url) ?? null,
        message: msg.message,
        imageUrl: msg.imageUrl ?? null,
        created_at: msg.created_at,
      };

      return res.json({ data: formatted });

    } catch (err) {
      console.error("[Chat] Erro ao enviar mensagem:", err);
      return res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
}
