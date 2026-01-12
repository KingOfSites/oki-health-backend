import { Request, Response } from "express";
import { openai } from "../services/ai.service";

export async function analyzeNutrition(req: Request, res: Response) {
  try {
    const { sexo, peso, altura, idade, atividade } = req.body;
    const imageBase64 = req.body.imageBase64;

    if (!imageBase64) {
      return res.status(400).json({ error: "Envie a imagem em base64" });
    }

    // 🔥 PROMPT MESTRE — Aqui dentro mesmo.
    const prompt = `
Você é um Coach Nutricional profissional especializado em análise de refeições por imagem e cálculo metabólico individual.

TAREFAS:

1) Analisar a foto da refeição enviada pelo usuário.
   - Identificar todos os alimentos presentes.
   - Estimar porções e calorias totais.
   - Estimar macronutrientes (proteínas, carboidratos, gorduras).
   - Retornar uma avaliação nutricional completa.

2) Usar os seguintes dados da pessoa para calcular a ingestão diária:
   sexo: ${sexo}
   peso: ${peso}
   altura: ${altura}
   idade: ${idade}
   atividade: ${atividade}

Calcule a TMB usando Harris-Benedict:
   Homem: 88.36 + (13.4 × peso kg) + (4.8 × altura cm) – (5.7 × idade)
   Mulher: 447.6 + (9.2 × peso kg) + (3.1 × altura cm) – (4.3 × idade)

Multiplique pelo nível de atividade:
Sedentário (×1.2)
Levemente ativo (×1.375)
Moderadamente ativo (×1.55)
Muito ativo (×1.725)
Extremamente ativo (×1.9)

3) Responder APENAS no formato JSON:
{
  "refeicao": {
    "itens": [ { "nome": "", "calorias": 0, "proteinas_g": 0, "carboidratos_g": 0, "gorduras_g": 0 } ],
    "calorias_totais": 0
  },
  "usuario": {
    "tmb": 0,
    "ingestao_diaria_recomendada": 0
  },
  "resumo": "Mensagem motivacional"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",  // Usando modelo válido
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { 
              type: "image_url", 
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }
      ]
    });

    const result = response.choices[0].message.content;
    if (!result) {
      return res.status(500).json({ error: "Resposta vazia da IA" });
    }
    return res.json(JSON.parse(result));

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao analisar refeição" });
  }
}
