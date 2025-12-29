import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    age: z.number().int().min(10).max(120).optional(),
    idade: z.number().int().min(10).max(120).optional(),
    city: z.string().min(2),
    sexo: z.enum(["M", "F"]),
    pesoKg: z.number().min(20).max(400).optional(),
    peso: z.number().min(20).max(400).optional(),
    alturaCm: z.number().min(50).max(270).optional(),
    altura: z.number().min(50).max(270).optional(),
    atividade: z.enum([
      "sedentario",
      "leve",
      "moderado",
      "intenso",
      "muito_intenso",
    ]),
  }),
});

export const signinSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    age: z.number().int().min(10).max(120).optional(),
    city: z.string().min(2).optional(),
    avatar_url: z.string().url().optional().nullable(),
    sexo: z.enum(["M", "F"]).optional(),
    peso: z.number().min(20).max(400).optional(),
    altura: z.number().min(50).max(270).optional(),
    atividade: z.enum([
      "sedentario",
      "leve",
      "moderado",
      "intenso",
      "muito_intenso",
    ]).optional(),
  }),
});
