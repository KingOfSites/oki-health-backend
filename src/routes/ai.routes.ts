import { Router } from "express";
import { OpenAI } from "openai";
import { authenticate } from "../middleware/auth";

const router = Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "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",
});

// ====================================
// 🔥 POST /api/ai/nutrition (PROTEGIDO - SÓ PRO)
// ====================================
router.post("/nutrition", authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { imageBase64 } = req.body;

    console.log("🔐 [AI Route] ========== INÍCIO DA VERIFICAÇÃO ==========");
    console.log("🔐 [AI Route] Token extraído - userId:", userId);
    console.log("🔐 [AI Route] Headers authorization:", req.headers.authorization ? "Presente" : "Ausente");

    if (!userId) {
      console.log("❌ [AI Route] userId não encontrado no request");
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem não enviada" });
    }

    // Verificar se usuário é PRO
    const prisma = (await import("../config/database")).default;
    
    // Buscar apenas os campos necessários para evitar referências circulares
    const userFull = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isPro: true },
    });

    console.log("🔍 [AI Route] Usuário do banco:", {
      id: userFull?.id,
      email: userFull?.email,
      isPro: userFull?.isPro,
    });
    
    // Verificar se o userId do token corresponde a um usuário real no banco
    if (!userFull) {
      console.log("❌ [AI Route] ERRO CRÍTICO: userId do token não existe no banco!");
      console.log("❌ [AI Route] userId do token:", userId);
      return res.status(401).json({ 
        success: false,
        error: "Token inválido - usuário não encontrado",
        premium: false 
      });
    }
    
    // Query SQL direta para garantir que estamos pegando o valor correto
    const rawQuery = await prisma.$queryRaw<Array<{ isPro: number }>>`
      SELECT isPro FROM users WHERE id = ${userId}
    `;
    
    console.log("🔍 [AI Route] Query SQL direta resultado:", rawQuery);
    const rawIsPro = rawQuery[0]?.isPro;
    console.log("🔍 [AI Route] isPro da query SQL direta:", rawIsPro, "Tipo:", typeof rawIsPro);

    // Verificar campo isPro diretamente no usuário (usando query SQL direta)
    const userPro = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPro: true } as any
    });

    console.log("🔍 [AI Route] userId consultado:", userId);
    console.log("🔍 [AI Route] isPro do banco (raw):", (userPro as any)?.isPro);
    console.log("🔍 [AI Route] isPro do banco (tipo):", typeof (userPro as any)?.isPro);
    console.log("🔍 [AI Route] isPro === 0:", (userPro as any)?.isPro === 0);
    console.log("🔍 [AI Route] isPro === false:", (userPro as any)?.isPro === false);
    console.log("🔍 [AI Route] isPro === 1:", (userPro as any)?.isPro === 1);
    console.log("🔍 [AI Route] isPro === true:", (userPro as any)?.isPro === true);

    // IMPORTANTE: Verificar explicitamente se isPro é true (1) ou false (0)
    // No MySQL, tinyint(1) pode retornar como número, então convertemos explicitamente
    if (!userPro) {
      console.log("❌ [AI Route] Usuário não encontrado");
      return res.status(403).json({ 
        success: false,
        error: "Usuário não encontrado",
        premium: false 
      });
    }

    // Usar o valor da query SQL direta se disponível, senão usar o Prisma
    const isProValue = rawIsPro !== undefined ? rawIsPro : (userPro as any).isPro;
    
    // Converter para boolean de forma explícita
    // Aceita: true, 1, "1" como verdadeiro
    // Rejeita: false, 0, "0", null, undefined como falso
    const isProBoolean = Boolean(isProValue) && (isProValue === true || isProValue === 1 || isProValue === '1');
    
    console.log("🔍 [AI Route] Valor isPro:", isProValue, "Tipo:", typeof isProValue, "Boolean:", isProBoolean);
    
    // Se isPro NÃO for verdadeiro, negar acesso
    if (!isProBoolean) {
      console.log("❌ [AI Route] ========== ACESSO NEGADO ==========");
      console.log("❌ [AI Route] userId:", userId);
      console.log("❌ [AI Route] isPro value:", isProValue);
      console.log("❌ [AI Route] isPro type:", typeof isProValue);
      console.log("❌ [AI Route] isPro boolean:", isProBoolean);
      console.log("❌ [AI Route] ====================================");
      return res.status(403).json({ 
        success: false,
        error: "Recurso exclusivo para assinantes PRO. Faça upgrade para PRO para usar esta funcionalidade.",
        premium: false 
      });
    }

    console.log("✅ [AI Route] ========== ACESSO PERMITIDO ==========");
    console.log("✅ [AI Route] userId:", userId);
    console.log("✅ [AI Route] isPro value:", isProValue);
    console.log("✅ [AI Route] ======================================");

    // Buscar dados nutricionais do usuário
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { sexo: true, peso: true, altura: true, age: true, atividade: true }
    });

    if (!userData || !userData.peso || !userData.altura || !userData.sexo || !userData.age || !userData.atividade) {
      return res.status(400).json({ 
        error: "Complete seu perfil (sexo, peso, altura, idade, atividade) para usar esta funcionalidade" 
      });
    }

    const { sexo, peso, altura, age: idade, atividade } = userData;

    // PROMPT da IA
    const prompt = `
Você é um nutricionista esportivo de elite.

1️⃣ Analise a imagem enviada e identifique TUDO que compõe a refeição.
2️⃣ Para cada item, retorne:
- nome
- calorias totais
- proteínas (g)
- carboidratos (g)
- gorduras (g)

3️⃣ Calcule as calorias totais da refeição.

4️⃣ Calcule a TMB (Harris-Benedict):
HOMEM:
TMB = 88.36 + (13.4 × peso kg) + (4.8 × altura cm) – (5.7 × idade)

MULHER:
TMB = 447.6 + (9.2 × peso kg) + (3.1 × altura cm) – (4.3 × idade)

5️⃣ Multiplique pelo nível de atividade:
sedentario ×1.2
leve ×1.375
moderado ×1.55
intenso ×1.725
muito_intenso ×1.9

⛔ RETORNE SOMENTE JSON PURO, SEM EXPLICAÇÕES.

FORMATO EXATO:

{
  "refeicao": {
    "itens": [
      { "nome": "", "calorias": 0, "proteinas_g": 0, "carboidratos_g": 0, "gorduras_g": 0 }
    ],
    "calorias_totais": 0
  },
  "usuario": {
    "tmb": 0,
    "ingestao_diaria_recomendada": 0
  },
  "resumo": "Texto explicando a refeição"
}
`;

    // ====================================
    // 🔥 CHAMADA CORRETA PARA A API (Vision)
    // ====================================
    const result = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            },
            {
              type: "text",
              text: `Sexo: ${sexo}, Peso: ${peso}kg, Altura: ${altura}cm, Idade: ${idade} anos, Atividade: ${atividade}`
            }
          ]
        }
      ],
      max_tokens: 1000,
    });

    // ====================================
    // 🔥 PEGAR TEXTO DA RESPOSTA
    // ====================================
    const aiText = result.choices[0]?.message?.content;

    if (!aiText) {
      return res.status(500).json({
        error: "A IA não retornou texto",
        raw: result
      });
    }

    // ====================================
    // 🔥 LIMPAR TEXTO (REMOVER ```json etc.)
    // ====================================
    let clean = aiText.trim();

    clean = clean.replace(/```json/gi, "");
    clean = clean.replace(/```/g, "");
    clean = clean.replace(/`/g, "");

    // Extrair apenas o JSON entre { ... }
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({
        error: "IA não retornou JSON válido",
        raw: clean
      });
    }

    clean = clean.substring(firstBrace, lastBrace + 1);

    // ====================================
    // 🔥 PARSE DO JSON
    // ====================================
    let json;
    try {
      json = JSON.parse(clean);
    } catch (err) {
      console.error("Erro ao parsear JSON:", clean);
      return res.status(500).json({
        error: "JSON inválido retornado pela IA",
        raw: clean
      });
    }

    console.log("✅ [AI Route] Análise concluída com sucesso");
    console.log("✅ [AI Route] JSON retornado:", JSON.stringify(json, null, 2));
    
    return res.json(json);

  } catch (err: any) {
    console.error("AI ERROR:", err);
    return res.status(500).json({
      error: "Erro interno na IA",
      details: err?.message || String(err)
    });
  }
});

// ====================================
// 🔥 POST /api/ai/verify-gym (VERIFICAR ACADEMIA)
// ====================================
router.post("/verify-gym", authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { imageUrl, challengeId, messageId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!imageUrl) {
      return res.status(400).json({ error: "URL da imagem não enviada" });
    }

    console.log("🏋️ [AI Verify Gym] Iniciando verificação de academia...");
    console.log("🏋️ [AI Verify Gym] imageUrl:", imageUrl.substring(0, 50) + "...");
    console.log("🏋️ [AI Verify Gym] challengeId:", challengeId);
    console.log("🏋️ [AI Verify Gym] messageId:", messageId);

    // Buscar informações completas do desafio e da mensagem
    const prisma = (await import("../config/database")).default;
    let challengeInfo = null;
    let messageInfo = null;
    
    if (challengeId) {
      try {
        // Buscar informações completas do desafio
        challengeInfo = await prisma.$queryRawUnsafe(
          `SELECT id, title, description, startDate, endDate, category FROM challenges WHERE id = ?`,
          challengeId
        ) as any[];
      } catch (err) {
        console.warn("⚠️ [AI Verify Gym] Erro ao buscar desafio:", err);
      }
    }

    // Buscar informações da mensagem (horário de criação)
    if (messageId) {
      try {
        messageInfo = await prisma.$queryRawUnsafe(
          `SELECT id, created_at FROM challenge_chat WHERE id = ?`,
          messageId
        ) as any[];
      } catch (err) {
        console.warn("⚠️ [AI Verify Gym] Erro ao buscar mensagem:", err);
      }
    }

    const challenge = challengeInfo?.[0];
    const message = messageInfo?.[0];
    
    // Horário de criação da mensagem (timestamp que aparece abaixo da imagem no chat)
    const messageCreatedAt = message?.created_at ? new Date(message.created_at) : new Date();
    const messageTime = messageCreatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const messageDate = messageCreatedAt.toLocaleDateString("pt-BR");

    // Extrair informações de horário do título/descrição do desafio
    let challengeTimeInfo = "";
    let expectedTimeRange = "";
    let extractedTimes: string[] = [];
    
    if (challenge) {
      const title = challenge.title || "";
      const description = challenge.description || "";
      const fullText = `${title} ${description}`;
      
      // Procurar por padrões de horário no texto (case insensitive)
      const timePatterns = [
        { pattern: /\b(\d{1,2})[h:](\d{2})\s*às?\s*(\d{1,2})[h:](\d{2})\b/gi, format: (m: RegExpMatchArray) => `${m[1]}h${m[2]} às ${m[3]}h${m[4]}` },
        { pattern: /\b(\d{1,2})[h:](\d{2})\b/g, format: (m: RegExpMatchArray) => `${m[1]}h${m[2]}` },
        { pattern: /\b(\d{1,2})h\b/g, format: (m: RegExpMatchArray) => `${m[1]}h` },
        { pattern: /\bàs?\s*(\d{1,2})[h:](\d{2})\b/gi, format: (m: RegExpMatchArray) => `às ${m[1]}h${m[2]}` },
      ];
      
      timePatterns.forEach(({ pattern, format }) => {
        const matches = fullText.matchAll(pattern);
        for (const match of matches) {
          const formatted = format(match);
          if (!extractedTimes.includes(formatted)) {
            extractedTimes.push(formatted);
          }
        }
      });
      
      // Procurar por períodos do dia
      const periodPatterns = [
        { pattern: /\bmanhã\b/gi, label: "manhã" },
        { pattern: /\btarde\b/gi, label: "tarde" },
        { pattern: /\bnoite\b/gi, label: "noite" },
        { pattern: /\bmadrugada\b/gi, label: "madrugada" },
      ];
      
      const foundPeriods: string[] = [];
      periodPatterns.forEach(({ pattern, label }) => {
        if (pattern.test(fullText) && !foundPeriods.includes(label)) {
          foundPeriods.push(label);
        }
      });
      
      if (extractedTimes.length > 0) {
        challengeTimeInfo = `Horários mencionados no desafio: ${extractedTimes.join(", ")}`;
      } else if (foundPeriods.length > 0) {
        challengeTimeInfo = `Período mencionado no desafio: ${foundPeriods.join(", ")}`;
      }
      
      // Determinar período do dia baseado no horário da mensagem
      const messageHour = messageCreatedAt.getHours();
      let timeOfDay = "";
      if (messageHour >= 5 && messageHour < 12) {
        timeOfDay = "manhã";
      } else if (messageHour >= 12 && messageHour < 18) {
        timeOfDay = "tarde";
      } else if (messageHour >= 18 && messageHour < 24) {
        timeOfDay = "noite";
      } else {
        timeOfDay = "madrugada";
      }
      
      expectedTimeRange = `A mensagem foi enviada às ${messageTime} do dia ${messageDate} (${timeOfDay})`;
    }

    // Construir informações do desafio para o prompt
    const challengeContext = challenge ? `
    INFORMAÇÕES DO DESAFIO:
    - Título: ${challenge.title}
    - Descrição: ${challenge.description}
    - Período: ${challenge.startDate ? new Date(challenge.startDate).toLocaleDateString("pt-BR") : "N/A"} até ${challenge.endDate ? new Date(challenge.endDate).toLocaleDateString("pt-BR") : "N/A"}
    ${challengeTimeInfo ? `- Horários do desafio: ${challengeTimeInfo}` : ""}
    ${expectedTimeRange ? `- Faixa de horário esperada: ${expectedTimeRange}` : ""}
    ` : "";
    
    // PROMPT DA IA — VERIFICAÇÃO DE FOTO EM ACADEMIA
    const prompt = `
    Você é um sistema rigoroso de validação de fotos para desafios fitness com recompensa.
    
    Sua tarefa é analisar **APENAS a imagem enviada** e decidir se ela é **válida ou inválida** para um desafio de academia.
    
    ⚠️ REGRA PRINCIPAL:
    Se houver QUALQUER DÚVIDA, inconsistência ou falta de evidência clara → REJEITE.
    
    ---
    
    ### CRITÉRIOS OBRIGATÓRIOS (TODOS DEVEM SER ATENDIDOS):
    
    1️⃣ A imagem foi tirada DENTRO de uma academia real:
    - Presença clara de equipamentos de academia (máquinas, halteres, barras, anilhas, esteiras, racks, etc.)
    - Ambiente típico de academia (espelhos grandes, piso de borracha, iluminação artificial, layout comercial)
    
    2️⃣ Evidências de que a foto NÃO é:
    - Uma selfie em casa
    - Um parque, rua ou ambiente externo
    - Um print de tela, imagem reciclada, foto antiga ou de rede social
    - Uma imagem editada ou claramente reaproveitada
    
    3️⃣ Evidências de atualidade:
    - Aparência espontânea (não posada demais, não promocional)
    - Iluminação e qualidade compatíveis com uma foto casual de celular
    - Ausência de marcas de print (bordas, overlays, textos, UI de apps)
    
    4️⃣ Presença humana:
    - Deve existir ao menos uma pessoa visível OU reflexo realista em espelho
    - Rejeite imagens apenas do ambiente vazio
    
    ---
    
    ${challengeContext}
    
    ⏰ IMPORTANTE SOBRE HORÁRIO:
    - NÃO tente verificar horário pela imagem
    - O horário será validado separadamente pelo timestamp da mensagem (${messageTime} do dia ${messageDate})
    
    ---
    
    ⛔ FORMATO DE RESPOSTA (OBRIGATÓRIO):
    Retorne **APENAS JSON PURO**, sem texto extra, sem markdown.
    
    {
      "isGym": true ou false,
      "confidence": número entre 0.0 e 1.0,
      "reason": "Motivo curto, objetivo e técnico",
      "verified": true ou false
    }
    
    ### REGRAS FINAIS:
    - "verified" só pode ser true se **TODOS os critérios forem claramente atendidos**
    - Se confidence < 0.75 → verified deve ser false
    - Em caso de dúvida → verified = false
    `;
    

    // Baixar a imagem da URL e converter para base64
    let imageBase64: string;
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error("Erro ao baixar imagem");
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(imageBuffer).toString("base64");
    } catch (err) {
      console.error("❌ [AI Verify Gym] Erro ao baixar imagem:", err);
      return res.status(400).json({ 
        error: "Erro ao processar imagem",
        verified: false,
        reason: "Não foi possível baixar a imagem para análise"
      });
    }

    // Chamar a API da OpenAI
    const result = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            },
            {
              type: "text",
              text: `Analise se esta foto foi tirada em uma academia. O horário será verificado separadamente usando o timestamp da mensagem (${messageDate} às ${messageTime}).\n${challengeContext}`
            }
          ]
        }
      ],
      max_tokens: 500,
    });

    const aiText = result.choices[0]?.message?.content;

    if (!aiText) {
      return res.status(500).json({
        error: "A IA não retornou texto",
        verified: false,
        reason: "Erro na análise da IA"
      });
    }

    // Limpar e parsear JSON
    let clean = aiText.trim();
    clean = clean.replace(/```json/gi, "");
    clean = clean.replace(/```/g, "");
    clean = clean.replace(/`/g, "");

    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return res.status(500).json({
        error: "IA não retornou JSON válido",
        verified: false,
        reason: "Resposta da IA inválida"
      });
    }

    clean = clean.substring(firstBrace, lastBrace + 1);

    let json: any;
    try {
      json = JSON.parse(clean);
    } catch (err) {
      console.error("❌ [AI Verify Gym] Erro ao parsear JSON:", clean);
      return res.status(500).json({
        error: "JSON inválido retornado pela IA",
        verified: false,
        reason: "Erro ao processar resposta da IA"
      });
    }

    console.log("✅ [AI Verify Gym] Verificação concluída:", json);
    console.log("🕐 [AI Verify Gym] Horários extraídos do desafio:", extractedTimes);
    console.log("🕐 [AI Verify Gym] Horário da mensagem:", messageTime);

    // Verificação adicional: comparar horário da mensagem com horário esperado
    let timeVerification = true;
    let timeVerificationReason = "";
    
    if (challenge && message) {
      const messageHour = messageCreatedAt.getHours();
      const messageMinute = messageCreatedAt.getMinutes();
      const messageTimeMinutes = messageHour * 60 + messageMinute;
      
      // Verificar se a mensagem foi enviada durante o período do desafio (datas)
      const startDate = new Date(challenge.startDate);
      const endDate = new Date(challenge.endDate);
      
      console.log("📅 [AI Verify Gym] Período do desafio:", startDate.toLocaleDateString("pt-BR"), "até", endDate.toLocaleDateString("pt-BR"));
      console.log("📅 [AI Verify Gym] Data da mensagem:", messageDate);
      
      if (messageCreatedAt < startDate || messageCreatedAt > endDate) {
        timeVerification = false;
        timeVerificationReason = `Mensagem enviada fora do período do desafio (${startDate.toLocaleDateString("pt-BR")} até ${endDate.toLocaleDateString("pt-BR")})`;
        console.log("❌ [AI Verify Gym] Mensagem fora do período do desafio");
      } else if (extractedTimes.length > 0) {
        // Se há horários específicos mencionados, verificar se o horário da mensagem está próximo
        let matchesTime = false;
        const tolerance = 60; // 1 hora de tolerância
        
        console.log("🕐 [AI Verify Gym] Verificando horários específicos...");
        
        for (const timeStr of extractedTimes) {
          // Extrair horários do formato "18h30" ou "18h30 às 20h"
          const timeMatch = timeStr.match(/(\d{1,2})h(\d{2})?/g);
          if (timeMatch) {
            for (const time of timeMatch) {
              const parts = time.replace("h", ":").split(":");
              const hour = parseInt(parts[0]);
              const minute = parts[1] ? parseInt(parts[1]) : 0;
              const timeMinutes = hour * 60 + minute;
              
              console.log(`🕐 [AI Verify Gym] Comparando: ${messageTimeMinutes}min (${messageTime}) vs ${timeMinutes}min (${hour}h${minute.toString().padStart(2, "0")})`);
              
              // Verificar se está dentro da tolerância
              if (Math.abs(messageTimeMinutes - timeMinutes) <= tolerance) {
                matchesTime = true;
                console.log("✅ [AI Verify Gym] Horário corresponde!");
                break;
              }
            }
          }
          if (matchesTime) break;
        }
        
        if (!matchesTime) {
          timeVerification = false;
          timeVerificationReason = `Horário da mensagem (${messageTime}) não corresponde aos horários do desafio (${extractedTimes.join(", ")})`;
          console.log("❌ [AI Verify Gym] Horário não corresponde aos horários do desafio");
        } else {
          console.log("✅ [AI Verify Gym] Horário corresponde aos horários do desafio");
        }
      } else {
        console.log("ℹ️ [AI Verify Gym] Nenhum horário específico encontrado no desafio, apenas verificando período");
      }
    }
    
    // Verificação final: combinar resultado da IA (se é academia) com verificação de horário (timestamp da mensagem)
    // A IA só verifica se é academia, o horário é verificado usando o timestamp da mensagem
    const finalVerified = (json.verified || false) && timeVerification;

    // Atualizar status da mensagem no banco se messageId foi fornecido
    if (messageId && challengeId) {
      try {
        const status = finalVerified ? "verified" : "rejected";
        const verifiedAt = finalVerified ? new Date() : null;
        const finalReason = timeVerificationReason || json.reason || "";
        
        await prisma.$executeRawUnsafe(
          `UPDATE challenge_chat 
           SET verificationStatus = ?, 
               verifiedAt = ?, 
               verificationReason = ? 
           WHERE id = ?`,
          status,
          verifiedAt,
          finalReason,
          messageId
        );
        
        console.log("✅ [AI Verify Gym] Status atualizado no banco:", status);
        
        // Se a foto foi verificada, adicionar pontos ao participante
        if (finalVerified && userId) {
          try {
            // Verificar se o participante existe
            const participant = await prisma.$queryRawUnsafe(
              `SELECT id FROM challenge_participants WHERE userId = ? AND challengeId = ?`,
              userId,
              challengeId
            ) as any[];
            
            if (participant && participant.length > 0) {
              // Adicionar 10 pontos por foto verificada
              const pointsToAdd = 10;
              await prisma.$executeRawUnsafe(
                `UPDATE challenge_participants 
                 SET points = points + ? 
                 WHERE userId = ? AND challengeId = ?`,
                pointsToAdd,
                userId,
                challengeId
              );
              console.log(`✅ [AI Verify Gym] ${pointsToAdd} pontos adicionados ao participante`);
            }
          } catch (pointsErr) {
            console.error("⚠️ [AI Verify Gym] Erro ao adicionar pontos:", pointsErr);
            // Não falhar a requisição se não conseguir adicionar pontos
          }
        }
      } catch (err) {
        console.error("⚠️ [AI Verify Gym] Erro ao atualizar status no banco:", err);
        // Não falhar a requisição se não conseguir atualizar o banco
      }
    }

    // Construir mensagem de motivo combinada
    let finalReason = "";
    if (!timeVerification) {
      finalReason = timeVerificationReason || "";
    }
    if (!json.verified && json.reason) {
      finalReason = finalReason ? `${finalReason}. ${json.reason}` : json.reason;
    }
    if (finalVerified) {
      finalReason = "Foto verificada: é academia e foi enviada no horário correto do desafio.";
    }

    return res.json({
      success: true,
      verified: finalVerified,
      isGym: json.isGym || false,
      matchesChallengeTime: timeVerification,
      confidence: json.confidence || 0,
      reason: finalReason || "Verificação concluída",
      timeVerification: timeVerification,
      aiVerification: json.verified || false,
    });

  } catch (err: any) {
    console.error("❌ [AI Verify Gym] Erro:", err);
    return res.status(500).json({
      error: "Erro interno na verificação",
      verified: false,
      reason: err?.message || "Erro desconhecido",
      details: err?.message || String(err)
    });
  }
});

export default router;
