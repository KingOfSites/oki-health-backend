import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email é obrigatório" })
      .email("Email inválido")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Senha é obrigatória" })
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .regex(/[a-zA-Z]/, "A senha deve conter pelo menos uma letra")
      .regex(/\d/, "A senha deve conter pelo menos um número"),
    name: z
      .string({ required_error: "Nome é obrigatório" })
      .min(2, "Nome deve ter pelo menos 2 caracteres")
      .max(100, "Nome muito longo")
      .trim(),
    age: z
      .number({ required_error: "Idade é obrigatória" })
      .int("Idade deve ser um número inteiro")
      .min(10, "Idade mínima é 10 anos")
      .max(120, "Idade máxima é 120 anos"),
    city: z
      .string({ required_error: "Cidade é obrigatória" })
      .min(2, "Nome da cidade muito curto")
      .max(100, "Nome da cidade muito longo")
      .trim(),
  }),
});

export const signinSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email é obrigatório" })
      .email("Email inválido")
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: "Senha é obrigatória" })
      .min(1, "Senha é obrigatória"),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .min(2, "Nome deve ter pelo menos 2 caracteres")
        .max(100, "Nome muito longo")
        .trim()
        .optional(),
      age: z
        .number()
        .int("Idade deve ser um número inteiro")
        .min(10, "Idade mínima é 10 anos")
        .max(120, "Idade máxima é 120 anos")
        .optional(),
      city: z
        .string()
        .min(2, "Nome da cidade muito curto")
        .max(100, "Nome da cidade muito longo")
        .trim()
        .optional(),
      avatar_url: z.string().url().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "Nenhum campo para atualizar",
      path: ["body"],
    }),
});
