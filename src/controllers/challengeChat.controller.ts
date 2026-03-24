import { Request, Response } from "express";
import prisma from "../config/database";

export class ChallengeChatController {

  // ------------------------------
  // 🔥 Buscar mensagens do desafio
  // ------------------------------
  static async getMessages(req: Request, res: Response) {
    try {
      const { challengeId } = req.params;

      // Tentar buscar mensagens incluindo imageUrl e campos de verificação
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
            c.verificationStatus,
            c.verifiedAt,
            c.verificationReason,
            u.name as user_name,
            u.avatar_url
           FROM challenge_chat c
           JOIN users u ON c.userId = u.id
           WHERE c.challengeId = ?
           ORDER BY c.created_at ASC`,
          challengeId
        ) as any[];
      } catch (err: any) {
        // Se falhar (colunas não existem), tentar buscar sem campos de verificação
        if (err.code === "P2010" || err.meta?.code === "1054" || err.message?.includes("verificationStatus") || err.message?.includes("imageUrl")) {
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
          } catch (err2: any) {
            // Se ainda falhar, buscar sem imageUrl
            if (err2.message?.includes("imageUrl")) {
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
              throw err2;
            }
          }
        } else {
          throw err;
        }
      }

      // 🔥 Formato que o front espera
      const formatted = messages.map((msg) => {
        const isPending = msg.imageUrl && (!msg.verificationStatus || msg.verificationStatus === "pending");

        // Force retry background job for any pending messages
        if (isPending) {
          setImmediate(async () => {
            try {
              console.log(`[Chat] 🔄 Re-agendando análise de IA pendente para a mensagem ${msg.id}...`);
              const isVideo = msg.imageUrl.includes('.mp4') || msg.imageUrl.includes('.mov') || msg.imageUrl.includes('video');
              const env = (await import("../config/env")).default;
              const token = req.headers.authorization?.replace("Bearer ", "");
              
              if (!token) return;

              let messageTimeFormatted;
              try {
                const messageCreatedAt = new Date(msg.created_at);
                messageTimeFormatted = messageCreatedAt.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo"
                });
              } catch (e) {}

              const port = env.PORT || "3005";
              const baseUrl = `http://127.0.0.1:${port}`;
              const verifyEndpoint = isVideo ? `${baseUrl}/api/ai/verify-weight-video` : `${baseUrl}/api/ai/verify-gym`;
              
              await fetch(verifyEndpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                  imageUrl: msg.imageUrl,
                  videoUrl: isVideo ? msg.imageUrl : undefined,
                  challengeId: req.params.challengeId,
                  messageId: msg.id,
                  ...(messageTimeFormatted && { messageTime: messageTimeFormatted }),
                }),
              });
            } catch (retryErr) {
              console.error(`[Chat] ❌ Falha no retry automático de IA da mensagem ${msg.id}:`, retryErr);
            }
          });
        }

        return {
          id: msg.id,
          userId: msg.userId,
          user_name: msg.user_name ?? "Usuário",
          avatar_url: msg.avatar_url ?? null,
          message: msg.message,
          imageUrl: msg.imageUrl ?? null,
          created_at: msg.created_at,
          // Só definir verificationStatus se houver imagem/vídeo
          // Mensagens de texto puro não precisam de verificação
          verificationStatus: msg.imageUrl ? (msg.verificationStatus ?? "pending") : null,
          verifiedAt: msg.verifiedAt ?? null,
          verificationReason: msg.verificationReason ?? null,
        };
      });

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
      const { message, imageUrl, videoUrl } = req.body;
      
      // Usar videoUrl se fornecido, senão usar imageUrl
      const mediaUrl = videoUrl || imageUrl;

      if (!message || !message.trim()) {
        if (!mediaUrl) {
          return res.status(400).json({ error: "Mensagem ou mídia (imagem/vídeo) é obrigatória" });
        }
      }

      // Inserir mensagem com ou sem mídia
      const messageId = require("crypto").randomUUID();
      
      if (mediaUrl) {
        const isVideo = !!videoUrl;
        const mediaType = isVideo ? "vídeo" : "imagem";
        // Tentar inserir com imageUrl e campos de verificação (URL do Firebase)
        // Nota: vídeos também são salvos em imageUrl por enquanto (pode ser expandido no futuro)
        console.log(`[Chat] Tentando salvar mensagem com ${mediaType}: ${mediaUrl.substring(0, 50)}...`);
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO challenge_chat (id, userId, challengeId, message, imageUrl, verificationStatus, created_at) 
             VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
            messageId,
            userId,
            challengeId,
            message || "",
            mediaUrl
          );
          console.log(`[Chat] ✅ Mensagem com ${mediaType} salva com sucesso!`);
          
          // Chamar verificação de IA de forma assíncrona (não bloquear resposta)
          // Para vídeos, usar verificação específica de pesagem
          setImmediate(async () => {
            try {
              if (isVideo) {
                console.log(`[Chat] 🤖 Iniciando verificação de vídeo de pesagem para mensagem ${messageId}...`);
                // TODO: Implementar verificação específica para vídeo de pesagem
                // Por enquanto, usar a mesma verificação de imagem
              } else {
                console.log(`[Chat] 🤖 Iniciando verificação de IA para mensagem ${messageId}...`);
              }
              const env = (await import("../config/env")).default;
              const token = req.headers.authorization?.replace("Bearer ", "");
              
              if (!token) {
                console.warn(`[Chat] ⚠️ Token não encontrado para verificação de IA`);
                return;
              }

              // Buscar o created_at da mensagem recém-criada para formatar o horário
              // IMPORTANTE: Usar exatamente a mesma lógica do frontend para garantir consistência
              let messageTimeFormatted: string | undefined;
              try {
                const messageData = await prisma.$queryRawUnsafe(
                  `SELECT created_at FROM challenge_chat WHERE id = ?`,
                  messageId
                ) as any[];
                
                if (messageData && messageData.length > 0 && messageData[0].created_at) {
                  // Calcular o horário formatado da mesma forma que o frontend faz
                  // Frontend usa: new Date(dateString).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  const messageCreatedAt = new Date(messageData[0].created_at);
                  
                  console.log(`[Chat] 🕐 created_at (raw do banco):`, messageData[0].created_at);
                  console.log(`[Chat] 🕐 created_at (Date object):`, messageCreatedAt.toISOString());
                  
                  // Usar EXATAMENTE a mesma formatação do frontend (sem timeZone explícito, usa o do sistema)
                  // Mas garantir que seja no timezone do Brasil
                  messageTimeFormatted = messageCreatedAt.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Sao_Paulo"
                  });
                  
                  console.log(`[Chat] 🕐 Horário formatado para verificação: ${messageTimeFormatted}`);
                  console.log(`[Chat] 🕐 Este é o horário que aparece na interface do usuário`);
                }
              } catch (timeErr) {
                console.warn(`[Chat] ⚠️ Erro ao buscar created_at da mensagem:`, timeErr);
              }

              // Chamada interna: usar sempre localhost para o próprio servidor (evita falha por BACKEND_URL externo)
              const port = env.PORT || "3005";
              const baseUrl = `http://127.0.0.1:${port}`;
              const verifyEndpoint = isVideo ? `${baseUrl}/api/ai/verify-weight-video` : `${baseUrl}/api/ai/verify-gym`;
              
              const verifyResponse = await fetch(verifyEndpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                  imageUrl: mediaUrl,
                  videoUrl: isVideo ? mediaUrl : undefined,
                  challengeId,
                  messageId,
                  ...(messageTimeFormatted && { messageTime: messageTimeFormatted }), // Enviar o horário formatado (mesmo da interface)
                }),
              });

              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                console.log(`[Chat] ✅ Verificação de IA concluída:`, verifyData);
              } else {
                const errorText = await verifyResponse.text();
                console.error(`[Chat] ❌ Erro na verificação de IA:`, errorText);
                
                // MANTIDO COMO PENDENTE: 
                // Se a API da IA falhou com status de erro (ex: falha de config, sem saldo, etc),
                // não vamos mais rejeitar a imagem, apenas deixamos pending.
                // O auto-retry no getMessages cuidará de tentar novamente mais tarde.
                console.log(`[Chat] ⚠️ Mensagem ${messageId} mantida como pending para auto-retry futuro devido a erro na IA.`);
              }
            } catch (verifyErr) {
              console.error(`[Chat] ❌ Erro catastrófico ao chamar verificação de IA (rede/código):`, verifyErr);
              // Não falhar a requisição principal se a verificação falhar, apenas mantenha pendente
              console.log(`[Chat] ⚠️ Mensagem ${messageId} mantida como pending para auto-retry futuro.`);
            }
          });
        } catch (err: any) {
          // Se falhar (colunas não existem), tentar inserir sem campos de verificação
          if (err.code === "P2010" || err.meta?.code === "1054" || err.message?.includes("verificationStatus") || err.message?.includes("imageUrl")) {
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
              console.log(`[Chat] ✅ Mensagem com imagem salva (sem verificação)!`);
            } catch (err2: any) {
              // Se ainda falhar, inserir sem imageUrl
              if (err2.message?.includes("imageUrl")) {
                console.warn(`[Chat] ⚠️ Coluna imageUrl não existe. Salvando sem imagem.`);
            await prisma.$executeRawUnsafe(
              `INSERT INTO challenge_chat (id, userId, challengeId, message, created_at) 
               VALUES (?, ?, ?, ?, NOW())`,
              messageId,
              userId,
              challengeId,
              message || ""
            );
              } else {
                throw err2;
              }
            }
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
      
      // Buscar a mensagem criada (tentar com todos os campos, se falhar buscar sem)
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
            c.verificationStatus,
            c.verifiedAt,
            c.verificationReason,
            u.name,
            u.avatar_url 
           FROM challenge_chat c 
           JOIN users u ON c.userId = u.id 
           WHERE c.id = ?`,
          messageId
        ) as any[];
      } catch (err: any) {
        // Se falhar (colunas não existem), tentar buscar sem campos de verificação
        if (err.code === "P2010" || err.meta?.code === "1054" || err.message?.includes("verificationStatus") || err.message?.includes("imageUrl")) {
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
          } catch (err2: any) {
            // Se ainda falhar, buscar sem imageUrl
            if (err2.message?.includes("imageUrl")) {
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
              throw err2;
            }
          }
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
        verificationStatus: msg.verificationStatus ?? "pending",
        verifiedAt: msg.verifiedAt ?? null,
        verificationReason: msg.verificationReason ?? null,
      };

      return res.json({ data: formatted });

    } catch (err) {
      console.error("[Chat] Erro ao enviar mensagem:", err);
      return res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  }
}
