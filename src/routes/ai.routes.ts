import { Router } from "express";
import { OpenAI } from "openai";
import { authenticate } from "../middleware/auth";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

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
    
    // Verificar se já houve uma análise hoje para este usuário
    let pointsAwarded = 0;
    let isFirstAnalysisToday = false;
    
    try {
      // Verificar análises de hoje
      const todayAnalyses = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count 
         FROM nutrition_analyses 
         WHERE userId = ? 
           AND DATE(created_at) = CURDATE()`,
        userId
      ) as any[];
      
      const analysisCount = todayAnalyses[0]?.count || 0;
      isFirstAnalysisToday = analysisCount === 0;
      
      // Só adicionar pontos se for a primeira análise do dia
      if (isFirstAnalysisToday) {
        const pointsToAdd = 10; // 10 pontos por dia
        
        // Adicionar XP ao usuário
        await prisma.user.update({
          where: { id: userId },
          data: {
            xp: {
              increment: pointsToAdd,
            },
          },
        });
        
        pointsAwarded = pointsToAdd;
        console.log(`✅ [AI Nutrition] ${pointsToAdd} pontos (XP) adicionados ao usuário (primeira análise do dia)`);
      } else {
        console.log(`ℹ️ [AI Nutrition] Usuário já fez ${analysisCount} análise(ões) hoje. Nenhum ponto adicionado.`);
      }
      
      // Salvar registro da análise no banco
      await prisma.nutritionAnalysis.create({
        data: {
          userId,
          analysis: JSON.stringify(json),
          pointsAwarded,
        },
      });
      
      console.log(`✅ [AI Nutrition] Análise salva no banco com ${pointsAwarded} pontos concedidos`);
    } catch (pointsErr) {
      console.error("⚠️ [AI Nutrition] Erro ao processar pontos ou salvar análise:", pointsErr);
      // Não falhar a requisição se não conseguir adicionar pontos
    }
    
    // Retornar análise com informações de pontos
    return res.json({
      ...json,
      pointsEarned: pointsAwarded,
      isFirstAnalysisToday,
    });

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
    const { imageUrl, challengeId, messageId, messageTime: clientMessageTime } = req.body;

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
    console.log("🏋️ [AI Verify Gym] clientMessageTime recebido:", clientMessageTime);

    // Buscar informações completas do desafio e da mensagem
    const prisma = (await import("../config/database")).default;
    let challengeInfo = null;
    let messageInfo = null;
    
    if (challengeId) {
      try {
        // Buscar informações completas do desafio incluindo horários
        challengeInfo = await prisma.$queryRawUnsafe(
          `SELECT id, title, description, startDate, endDate, category, startTime, endTime FROM challenges WHERE id = ?`,
          challengeId
        ) as any[];
      } catch (err) {
        console.warn("⚠️ [AI Verify Gym] Erro ao buscar desafio:", err);
      }
    }

    // PRIORIDADE: Se o cliente enviou o horário formatado (o mesmo que aparece na tela), usar ele diretamente
    // Isso garante que estamos usando exatamente o mesmo horário que o usuário vê
    let messageTime: string;
    let messageDate: string;
    
    if (clientMessageTime && typeof clientMessageTime === "string" && /^\d{2}:\d{2}$/.test(clientMessageTime)) {
      // Cliente enviou o horário formatado (ex: "16:34") - USAR DIRETAMENTE SEM CONVERSÃO
      // Este é o horário EXATO que aparece na interface do usuário
      messageTime = clientMessageTime.trim();
      console.log("🕐 [AI Verify Gym] ==========================================");
      console.log("🕐 [AI Verify Gym] ✅✅✅ USANDO HORÁRIO DO CLIENTE");
      console.log("🕐 [AI Verify Gym] Horário recebido:", messageTime);
      console.log("🕐 [AI Verify Gym] Este é o MESMO horário da interface");
      console.log("🕐 [AI Verify Gym] ⚠️ NÃO FAZER NENHUMA CONVERSÃO");
      console.log("🕐 [AI Verify Gym] ==========================================");
      
      // Buscar a mensagem apenas para pegar a data
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
      
      const message = messageInfo?.[0];
      if (message && message.created_at) {
        // Converter a data para o timezone do Brasil usando a mesma lógica do frontend
        const messageCreatedAtRaw = new Date(message.created_at);
        const formatter = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        const parts = formatter.formatToParts(messageCreatedAtRaw);
        const day = parts.find(p => p.type === "day")?.value || "01";
        const month = parts.find(p => p.type === "month")?.value || "01";
        const year = parts.find(p => p.type === "year")?.value || "2024";
        messageDate = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      } else {
        // Fallback: usar data/hora atual
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        const parts = formatter.formatToParts(now);
        const day = parts.find(p => p.type === "day")?.value || "01";
        const month = parts.find(p => p.type === "month")?.value || "01";
        const year = parts.find(p => p.type === "year")?.value || "2024";
        messageDate = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
    } else {
      // Fallback: buscar e converter do banco (comportamento anterior)
      if (messageId) {
        try {
          messageInfo = await prisma.$queryRawUnsafe(
            `SELECT 
              id, 
              created_at,
              DATE_FORMAT(CONVERT_TZ(created_at, @@session.time_zone, 'America/Sao_Paulo'), '%H:%i') as hora_br,
              DATE_FORMAT(CONVERT_TZ(created_at, @@session.time_zone, 'America/Sao_Paulo'), '%d/%m/%Y') as data_br,
              CONVERT_TZ(created_at, @@session.time_zone, 'America/Sao_Paulo') as created_at_br
            FROM challenge_chat WHERE id = ?`,
            messageId
          ) as any[];
        } catch (err) {
          console.warn("⚠️ [AI Verify Gym] Erro ao buscar com CONVERT_TZ, usando fallback:", err);
          try {
            messageInfo = await prisma.$queryRawUnsafe(
              `SELECT id, created_at FROM challenge_chat WHERE id = ?`,
              messageId
            ) as any[];
          } catch (err2) {
            console.warn("⚠️ [AI Verify Gym] Erro ao buscar mensagem (fallback):", err2);
          }
        }
      }

      const message = messageInfo?.[0];
      
      if (!message || !message.created_at) {
        console.error("❌ [AI Verify Gym] Mensagem não encontrada ou sem created_at");
        return res.status(400).json({ 
          error: "Mensagem não encontrada",
          verified: false 
        });
      }
      
      // Se o MySQL retornou hora_br e data_br (já convertidos), usar diretamente
      if (message.hora_br && message.data_br) {
        messageTime = message.hora_br;
        messageDate = message.data_br;
      } else {
        // Converter manualmente usando a mesma lógica do frontend
        const messageCreatedAtRaw = new Date(message.created_at);
        const formatter = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        
        const parts = formatter.formatToParts(messageCreatedAtRaw);
        const hour = parts.find(p => p.type === "hour")?.value || "00";
        const minute = parts.find(p => p.type === "minute")?.value || "00";
        const day = parts.find(p => p.type === "day")?.value || "01";
        const month = parts.find(p => p.type === "month")?.value || "01";
        const year = parts.find(p => p.type === "year")?.value || "2024";
        
        messageTime = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
        messageDate = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
    }
    
    console.log("🕐 [AI Verify Gym] ========== HORÁRIO FINAL ==========");
    console.log("🕐 [AI Verify Gym] Horário da mensagem (Brasil):", messageTime);
    console.log("🕐 [AI Verify Gym] Data da mensagem (Brasil):", messageDate);
    console.log("🕐 [AI Verify Gym] ===================================");
    
    const challenge = challengeInfo?.[0];

    // Função auxiliar para formatar horário (usada acima)
    const formatTimeForDisplay = (time: string) => {
      return time.replace(":", "h");
    };
    
    // Extrair informações de horário do desafio
    let challengeTimeInfo = "";
    let expectedTimeRange = "";
    let extractedTimes: string[] = [];
    
    if (challenge) {
      // PRIORIDADE 1: Usar horários do banco de dados (startTime e endTime)
      if (challenge.startTime && challenge.endTime) {
        // Converter formato HH:MM para formato legível (ex: "09:00" -> "09h00")
        extractedTimes.push(`${formatTimeForDisplay(challenge.startTime)} às ${formatTimeForDisplay(challenge.endTime)}`);
        challengeTimeInfo = `Horários permitidos do desafio: ${challenge.startTime} às ${challenge.endTime}`;
      } else if (challenge.startTime) {
        // Apenas horário inicial
        extractedTimes.push(formatTimeForDisplay(challenge.startTime));
        challengeTimeInfo = `Horário inicial do desafio: ${challenge.startTime}`;
      }
      
      // PRIORIDADE 2: Se não houver horários no banco, extrair do texto (fallback)
      if (extractedTimes.length === 0) {
        const title = challenge.title || "";
        const description = challenge.description || "";
        const fullText = `${title} ${description}`;
        
        // Procurar por padrões de horário no texto (case insensitive)
        // Ordem importa: primeiro procurar intervalos, depois horários individuais
        const timePatterns = [
          { pattern: /\b(\d{1,2})[h:](\d{2})\s*às?\s*(\d{1,2})[h:](\d{2})\b/gi, format: (m: RegExpMatchArray) => `${m[1]}h${m[2]} às ${m[3]}h${m[4]}` },
          { pattern: /\b(\d{1,2})[h:](\d{2})\s*até\s*(\d{1,2})[h:](\d{2})\b/gi, format: (m: RegExpMatchArray) => `${m[1]}h${m[2]} até ${m[3]}h${m[4]}` },
          { pattern: /\b(\d{1,2})[h:](\d{2})\s*-\s*(\d{1,2})[h:](\d{2})\b/g, format: (m: RegExpMatchArray) => `${m[1]}h${m[2]} - ${m[3]}h${m[4]}` },
          { pattern: /\b(\d{1,2})[h:](\d{2})\b/g, format: (m: RegExpMatchArray) => `${m[1]}h${m[2]}` },
          { pattern: /\b(\d{1,2})h\b/g, format: (m: RegExpMatchArray) => `${m[1]}h00` }, // Converter "9h" para "9h00"
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
      }
      
      // Determinar período do dia baseado no horário da mensagem (timezone do Brasil)
      const messageHour = parseInt(messageTime.split(":")[0]) || 0;
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
    
    if (challenge) {
      // Usar horário no timezone do Brasil
      const timeParts = messageTime.split(":");
      const messageHour = parseInt(timeParts[0]) || 0;
      const messageMinute = parseInt(timeParts[1]) || 0;
      const messageTimeMinutes = messageHour * 60 + messageMinute;
      
      // Verificar se a mensagem foi enviada durante o período do desafio (datas)
      // Comparar apenas YYYY-MM-DD no timezone do Brasil para evitar problemas de fuso
      const startDate = new Date(challenge.startDate);
      const endDate = new Date(challenge.endDate);
      const brOpt = { timeZone: "America/Sao_Paulo" as const };
      const toYYYYMMDD = (d: Date) => {
        const parts = new Intl.DateTimeFormat("fr-CA", { ...brOpt, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
        const y = parts.find((p) => p.type === "year")?.value ?? "2024";
        const m = parts.find((p) => p.type === "month")?.value ?? "01";
        const day = parts.find((p) => p.type === "day")?.value ?? "01";
        return `${y}-${m}-${day}`;
      };
      const startStr = toYYYYMMDD(startDate);
      const endStr = toYYYYMMDD(endDate);

      // Extrair data da messageDate (formato DD/MM/YYYY)
      const dateParts = messageDate.split("/");
      const day = dateParts[0] || "01";
      const month = dateParts[1] || "01";
      const year = dateParts[2] || "2024";
      const messageStr = `${year}-${month}-${day}`;

      console.log("📅 [AI Verify Gym] Período do desafio:", startDate.toLocaleDateString("pt-BR", brOpt), "até", endDate.toLocaleDateString("pt-BR", brOpt));
      console.log("📅 [AI Verify Gym] Data da mensagem:", messageDate, "→", messageStr);
      console.log("📅 [AI Verify Gym] Comparação (YYYY-MM-DD):", { messageStr, startStr, endStr });

      if (messageStr < startStr || messageStr > endStr) {
        timeVerification = false;
        timeVerificationReason = `Mensagem enviada fora do período do desafio (${startDate.toLocaleDateString("pt-BR", brOpt)} até ${endDate.toLocaleDateString("pt-BR", brOpt)})`;
        console.log("❌ [AI Verify Gym] Mensagem fora do período do desafio");
      } else if (challenge.startTime && challenge.endTime) {
        // PRIORIDADE 1: Usar horários do banco de dados diretamente
        const [startHour, startMin] = challenge.startTime.split(":").map(Number);
        const [endHour, endMin] = challenge.endTime.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        console.log(`🕐 [AI Verify Gym] Horários do banco: ${challenge.startTime} às ${challenge.endTime} (${startMinutes}min - ${endMinutes}min)`);
        console.log(`🕐 [AI Verify Gym] Horário da mensagem extraído: ${messageTime}`);
        console.log(`🕐 [AI Verify Gym] Horário da mensagem em minutos: ${messageTimeMinutes} minutos`);
        console.log(`🕐 [AI Verify Gym] Comparação: ${messageTimeMinutes} >= ${startMinutes} && ${messageTimeMinutes} <= ${endMinutes}`);
        
        if (messageTimeMinutes >= startMinutes && messageTimeMinutes <= endMinutes) {
          console.log(`✅ [AI Verify Gym] Horário ${messageTime} está dentro do intervalo permitido ${challenge.startTime} às ${challenge.endTime}`);
        } else {
          timeVerification = false;
          const startTimeFormatted = `${startHour.toString().padStart(2, "0")}h${startMin.toString().padStart(2, "0")}`;
          const endTimeFormatted = `${endHour.toString().padStart(2, "0")}h${endMin.toString().padStart(2, "0")}`;
          timeVerificationReason = `Horário da mensagem (${messageTime}) não corresponde aos horários do desafio (${startTimeFormatted} às ${endTimeFormatted})`;
          console.log(`❌ [AI Verify Gym] Horário ${messageTime} (${messageTimeMinutes}min) está fora do intervalo permitido ${challenge.startTime} (${startMinutes}min) às ${challenge.endTime} (${endMinutes}min)`);
        }
      } else if (extractedTimes.length > 0) {
        // Se há horários específicos mencionados, verificar se o horário da mensagem está dentro do intervalo
        let matchesTime = false;
        const tolerance = 30; // 30 minutos de tolerância para horários exatos
        
        console.log("🕐 [AI Verify Gym] Verificando horários específicos...");
        console.log("🕐 [AI Verify Gym] Horários extraídos:", extractedTimes);
        console.log("🕐 [AI Verify Gym] Horário da mensagem:", messageTime, `(${messageTimeMinutes} minutos)`);
        
        // Extrair todos os horários numéricos de todos os padrões encontrados
        const allTimeMinutes: number[] = [];
        
        for (const timeStr of extractedTimes) {
          // Verificar se é um intervalo (contém "às" ou "até")
          if (timeStr.includes("às") || timeStr.includes("até") || timeStr.includes("a")) {
            // Extrair horários do formato "09h00 às 12h00" ou "09h às 12h"
            const intervalMatch = timeStr.match(/(\d{1,2})h(\d{2})?/g);
            if (intervalMatch && intervalMatch.length >= 2) {
              const startTime = intervalMatch[0];
              const endTime = intervalMatch[1];
              
              const startParts = startTime.replace("h", ":").split(":");
              const startHour = parseInt(startParts[0]);
              const startMinute = startParts[1] ? parseInt(startParts[1]) : 0;
              const startMinutes = startHour * 60 + startMinute;
              
              const endParts = endTime.replace("h", ":").split(":");
              const endHour = parseInt(endParts[0]);
              const endMinute = endParts[1] ? parseInt(endParts[1]) : 0;
              const endMinutes = endHour * 60 + endMinute;
              
              console.log(`🕐 [AI Verify Gym] Intervalo encontrado: ${startHour}h${startMinute.toString().padStart(2, "0")} às ${endHour}h${endMinute.toString().padStart(2, "0")} (${startMinutes}min - ${endMinutes}min)`);
              
              // Verificar se o horário da mensagem está dentro do intervalo
              if (messageTimeMinutes >= startMinutes && messageTimeMinutes <= endMinutes) {
                matchesTime = true;
                console.log(`✅ [AI Verify Gym] Horário ${messageTime} está dentro do intervalo ${startHour}h${startMinute.toString().padStart(2, "0")} às ${endHour}h${endMinute.toString().padStart(2, "0")}`);
                break;
              }
            }
          } else {
            // Horário único - extrair e adicionar à lista
            const timeMatch = timeStr.match(/(\d{1,2})h(\d{2})?/g);
            if (timeMatch) {
              for (const time of timeMatch) {
                const parts = time.replace("h", ":").split(":");
                const hour = parseInt(parts[0]);
                const minute = parts[1] ? parseInt(parts[1]) : 0;
                const timeMinutes = hour * 60 + minute;
                allTimeMinutes.push(timeMinutes);
              }
            }
          }
        }
        
        // Se não encontrou intervalo, verificar se há múltiplos horários únicos
        // Nesse caso, considerar como intervalo entre o menor e o maior
        if (!matchesTime && allTimeMinutes.length > 0) {
          if (allTimeMinutes.length === 1) {
            // Apenas um horário - usar tolerância
            const targetTime = allTimeMinutes[0];
            if (Math.abs(messageTimeMinutes - targetTime) <= tolerance) {
              matchesTime = true;
              console.log(`✅ [AI Verify Gym] Horário ${messageTime} está próximo de ${Math.floor(targetTime / 60)}h${(targetTime % 60).toString().padStart(2, "0")} (tolerância: ${tolerance}min)`);
            }
          } else {
            // Múltiplos horários - considerar como intervalo
            const minTime = Math.min(...allTimeMinutes);
            const maxTime = Math.max(...allTimeMinutes);
            
            console.log(`🕐 [AI Verify Gym] Múltiplos horários detectados: intervalo de ${Math.floor(minTime / 60)}h${(minTime % 60).toString().padStart(2, "0")} até ${Math.floor(maxTime / 60)}h${(maxTime % 60).toString().padStart(2, "0")}`);
            
            if (messageTimeMinutes >= minTime && messageTimeMinutes <= maxTime) {
              matchesTime = true;
              console.log(`✅ [AI Verify Gym] Horário ${messageTime} está dentro do intervalo entre os horários permitidos`);
            }
          }
        }
        
        if (!matchesTime) {
          timeVerification = false;
          const timeRange = extractedTimes.length > 1 
            ? `entre ${extractedTimes.join(" e ")}`
            : extractedTimes.join(", ");
          timeVerificationReason = `Horário da mensagem (${messageTime}) não corresponde aos horários do desafio (${timeRange})`;
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
        
        // Se a foto foi verificada, adicionar pontos ao participante (1 ponto por dia)
        if (finalVerified && userId) {
          try {
            // Verificar se o participante existe
            const participant = await prisma.$queryRawUnsafe(
              `SELECT id FROM challenge_participants WHERE userId = ? AND challengeId = ?`,
              userId,
              challengeId
            ) as any[];
            
            if (participant && participant.length > 0) {
              // Verificar se já houve uma verificação hoje para este participante neste desafio
              // Buscar verificações de hoje (comparar apenas a data, ignorando horário)
              // Usar DATE() para comparar apenas a parte da data
              const todayVerifications = await prisma.$queryRawUnsafe(
                `SELECT COUNT(*) as count 
                 FROM challenge_chat 
                 WHERE userId = ? 
                   AND challengeId = ? 
                   AND verificationStatus = 'verified' 
                   AND DATE(verifiedAt) = CURDATE()`,
                userId,
                challengeId
              ) as any[];
              
              const verificationCount = todayVerifications[0]?.count || 0;
              
              // Só adicionar ponto se for a primeira verificação do dia
              if (verificationCount === 0) {
                const pointsToAdd = 1; // 1 ponto por dia
                await prisma.$executeRawUnsafe(
                  `UPDATE challenge_participants 
                   SET points = points + ? 
                   WHERE userId = ? AND challengeId = ?`,
                  pointsToAdd,
                  userId,
                  challengeId
                );
                console.log(`✅ [AI Verify Gym] ${pointsToAdd} ponto adicionado ao participante (primeira verificação do dia)`);
              } else {
                console.log(`ℹ️ [AI Verify Gym] Participante já recebeu ponto hoje (${verificationCount} verificação(ões) hoje). Não adicionando mais pontos.`);
              }
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

// ====================================
// 🔥 POST /api/ai/verify-weight-video (VERIFICAR VÍDEO DE PESAGEM)
// ====================================
router.post("/verify-weight-video", authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { videoUrl, challengeId, messageId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!videoUrl) {
      return res.status(400).json({ error: "URL do vídeo não enviada" });
    }

    // Para pesagem é obrigatório vídeo; foto não é aceita
    const urlLower = (videoUrl as string).toLowerCase().split("?")[0];
    if (/\.(jpg|jpeg|png|webp|gif|bmp)(\?|$)/i.test(urlLower)) {
      return res.status(400).json({
        error: "Para registro de pesagem é obrigatório enviar vídeo",
        reason: "Fotos não são aceitas. Grave um vídeo mostrando a balança e o peso com clareza, no local cadastrado (casa, academia ou farmácia).",
      });
    }

    console.log("⚖️ [AI Verify Weight Video] Iniciando verificação de vídeo de pesagem...");
    console.log("⚖️ [AI Verify Weight Video] videoUrl:", videoUrl.substring(0, 50) + "...");
    console.log("⚖️ [AI Verify Weight Video] challengeId:", challengeId);
    console.log("⚖️ [AI Verify Weight Video] messageId:", messageId);

    const prisma = (await import("../config/database")).default;
    
    // Buscar peso atual do usuário
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { peso: true, name: true },
    });

    const currentWeight = userData?.peso || null;

    // NOTA: Para análise completa de vídeo com IA, seria necessário:
    // 1. Extrair frames do vídeo usando ffmpeg ou similar
    // 2. Enviar os frames para análise da OpenAI Vision API
    // 3. Combinar os resultados dos múltiplos frames
    
    // Por enquanto, usando verificação simplificada baseada em critérios básicos
    // Em produção, implementar extração de frames com ffmpeg

    // Verificar se a URL do vídeo é acessível
    try {
      const videoResponse = await fetch(videoUrl, { method: "HEAD" });
      if (!videoResponse.ok) {
        throw new Error("Vídeo não acessível");
      }
    } catch (err) {
      console.error("❌ [AI Verify Weight Video] Erro ao verificar vídeo:", err);
      return res.status(400).json({ 
        error: "Erro ao processar vídeo",
        verified: false,
        reason: "Não foi possível acessar o vídeo para análise"
      });
    }

    // Extrair um frame do vídeo e enviar para a Vision API (a IA analisa imagens, não vídeo direto)
    let json: { verified?: boolean; reason?: string; isScale?: boolean; weightVisible?: boolean; detectedWeight?: number | null; confidence?: number } = {
      verified: false,
      reason: "Não foi possível analisar o vídeo.",
      isScale: false,
      weightVisible: false,
      detectedWeight: null,
      confidence: 0,
    };

    const tempDir = os.tmpdir();
    const framePath = path.join(tempDir, `frame_${messageId || Date.now()}.jpg`);

    try {
      const { path: ffmpegPath } = await import("@ffmpeg-installer/ffmpeg");
      const ffmpegModule = await import("fluent-ffmpeg");
      const ffmpeg = (ffmpegModule as any).default ?? ffmpegModule;
      ffmpeg.setFfmpegPath(ffmpegPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoUrl)
          .seekInput(1)
          .outputOptions(["-vframes 1", "-f image2"])
          .output(framePath)
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });

      const frameBuffer = await fs.readFile(framePath);
      await fs.unlink(framePath).catch(() => {});
      const frameBase64 = frameBuffer.toString("base64");

      const prompt = `Você analisa imagens extraídas de vídeos de pesagem para um desafio de saúde.
Responda APENAS com um JSON válido, sem markdown, no formato:
{ "verified": true ou false, "reason": "explicação curta", "isScale": true/false, "weightVisible": true/false, "detectedWeight": número ou null, "confidence": 0 a 1 }
Regras:
- verified: true somente se aparecer uma BALANÇA (balança de peso) e o PESO visível no mostrador.
- isScale: true se houver balança visível.
- weightVisible: true se o número do peso estiver legível.
- detectedWeight: se conseguir ler o peso em kg, coloque o número; senão null.
- Rejeite se não houver balança, ou se o peso não estiver visível, ou se parecer foto/vídeo antigo ou de outra pessoa.`;

      const result = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${frameBase64}` } },
              { type: "text", text: "Esta imagem é um frame de um vídeo de pesagem. A balança e o peso estão visíveis?" },
            ],
          },
        ],
        max_tokens: 300,
      });

      const aiText = result.choices[0]?.message?.content;
      if (aiText) {
        let clean = aiText.trim().replace(/```json/gi, "").replace(/```/g, "").replace(/`/g, "");
        const firstBrace = clean.indexOf("{");
        const lastBrace = clean.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          clean = clean.substring(firstBrace, lastBrace + 1);
          json = JSON.parse(clean);
        }
      }
      console.log("⚖️ [AI Verify Weight Video] Resposta da IA:", json);
    } catch (extractErr: any) {
      console.error("❌ [AI Verify Weight Video] Erro ao extrair frame ou analisar:", extractErr);
      await fs.unlink(framePath).catch(() => {});
      json.reason = "Não foi possível analisar o vídeo. Certifique-se de que a balança e o peso aparecem com clareza. Se o erro persistir, instale ffmpeg no servidor (npm install @ffmpeg-installer/ffmpeg).";
    }

    const finalVerified = Boolean(json.verified);

    // Atualizar status no banco
    if (messageId) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE challenge_chat 
           SET verificationStatus = ?, 
               verifiedAt = ${finalVerified ? "NOW()" : "NULL"},
               verificationReason = ?
           WHERE id = ?`,
          finalVerified ? "verified" : "rejected",
          json.reason || (finalVerified ? "Vídeo de pesagem verificado com sucesso" : "Vídeo não atende aos critérios de verificação"),
          messageId
        );

        // Se verificado, adicionar pontos; atualizar peso do usuário apenas se detectado
        if (finalVerified) {
          try {
            const weight = json.detectedWeight != null ? Number(json.detectedWeight) : null;
            if (weight != null && !isNaN(weight) && weight > 0 && weight < 500) {
              await prisma.user.update({
                where: { id: userId },
                data: { peso: weight },
              });
            }
            if (challengeId) {
              await prisma.$executeRawUnsafe(
                `UPDATE challenge_participants 
                 SET points = COALESCE(points, 0) + 10, 
                     progress = LEAST(COALESCE(progress, 0) + 2, 100)
                 WHERE userId = ? AND challengeId = ?`,
                userId,
                challengeId
              );
            }
          } catch (pointsErr) {
            console.error("⚠️ [AI Verify Weight Video] Erro ao adicionar pontos:", pointsErr);
          }
        }
      } catch (err) {
        console.error("⚠️ [AI Verify Weight Video] Erro ao atualizar status no banco:", err);
      }
    }

    return res.json({
      success: true,
      verified: finalVerified,
      isScale: json.isScale || false,
      weightVisible: json.weightVisible || false,
      detectedWeight: json.detectedWeight || null,
      confidence: json.confidence || 0,
      reason: json.reason || "Verificação concluída",
    });

  } catch (err: any) {
    console.error("❌ [AI Verify Weight Video] Erro:", err);
    return res.status(500).json({
      error: "Erro interno na verificação",
      verified: false,
      reason: err?.message || "Erro desconhecido",
    });
  }
});

export default router;
