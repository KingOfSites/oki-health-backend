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
    
    // Buscar TODOS os dados do usuário para debug
    const userFull = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isPro: true } as any
    });

    console.log("🔍 [AI Route] Usuário completo do banco:", JSON.stringify(userFull, null, 2));
    console.log("🔍 [AI Route] isPro do usuário completo:", (userFull as any)?.isPro);
    
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

export default router;
