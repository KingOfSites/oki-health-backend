import { Router } from "express";
import { OpenAI } from "openai";

const router = Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ====================================
// 🔥 POST /api/ai/nutrition
// ====================================
router.post("/nutrition", async (req, res) => {
  try {
    const { imageBase64, sexo, peso, altura, idade, atividade } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem não enviada" });
    }

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
    // 🔥 CHAMADA CORRETA PARA A API
    // ====================================
    const result = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            { type: "input_text", text: prompt }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBase64}`
            },
            {
              type: "input_text",
              text: `Sexo: ${sexo}, Peso: ${peso}, Altura: ${altura}, Idade: ${idade}, Atividade: ${atividade}`
            }
          ]
        }
      ]
    });

    // ====================================
    // 🔥 PEGAR TEXTO DA RESPOSTA
    // ====================================
    const aiText =
      result.output_text ??
      result.output?.[0]?.content?.find((c) => c.type === "output_text")?.text;

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

    return res.json(json);

  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({
      error: "Erro interno na IA",
      details: err?.message
    });
  }
});

export default router;
