import { Request, Response, NextFunction } from "express";
import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class NutritionController {
  static async ask(req: Request, res: Response, next: NextFunction) {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          message: "Mensagem obrigatória",
        });
      }

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um nutricionista profissional. Dê respostas claras e práticas, sempre baseadas em nutrição esportiva.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      });

      return res.json({
        success: true,
        reply: response.choices[0].message?.content,
      });
    } catch (error) {
      console.error("Erro IA:", error);
      return next(error);
    }
  }
}
