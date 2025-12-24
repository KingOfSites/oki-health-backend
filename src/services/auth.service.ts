import prisma from "../config/database";
import { PasswordUtils } from "../utils/password";
import { JWTUtils } from "../utils/jwt";
import { AppError } from "../middleware/errorHandler";

// ----------------------------------------------------
// DTOs
// ----------------------------------------------------
export interface SignupData {
  email: string;
  password: string;
  name: string;
  age: number;
  city: string;

  // 🔥 nutricionais
  sexo: "M" | "F";
  pesoKg: number;
  alturaCm: number;
  atividade:
    | "sedentario"
    | "leve"
    | "moderado"
    | "intenso"
    | "muito_intenso";
}

export interface SigninData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    age: number;
    city: string;

    sexo: "M" | "F" | null;
    peso: number | null;
    altura: number | null;
    atividade: string | null;

    xp: number;
    level: number;
    avatar_url?: string | null;

    created_at: Date;
    updated_at: Date;
  };
  token: string;
}

export class AuthService {
  // ----------------------------------------------------
  // SIGNUP
  // ----------------------------------------------------
  static async signup(data: SignupData): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, "Email já cadastrado");
    }

    const passwordValidation = PasswordUtils.validate(data.password);
    if (!passwordValidation.valid) {
      throw new AppError(400, passwordValidation.errors.join(", "));
    }

    const hashedPassword = await PasswordUtils.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        age: data.age,
        city: data.city,

        // 🔥 nutricionais
        sexo: data.sexo,
        peso: data.pesoKg,
        altura: data.alturaCm,
        atividade: data.atividade,

        // 🔥 IMPORTANTE: Garantir que isPro seja false para novos usuários
        isPro: false,
      },
    });

    const token = JWTUtils.generate(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        city: user.city,

        sexo: user.sexo ?? null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,

        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,

        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // SIGNIN
  // ----------------------------------------------------
  static async signin(data: SigninData): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError(401, "Email ou senha incorretos");
    }

    const isPasswordValid = await PasswordUtils.compare(
      data.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new AppError(401, "Email ou senha incorretos");
    }

    const token = JWTUtils.generate(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        age: user.age,
        city: user.city,

        sexo: user.sexo ?? null,
        peso: user.peso ?? null,
        altura: user.altura ?? null,
        atividade: user.atividade ?? null,

        xp: user.xp,
        level: user.level,
        avatar_url: user.avatar_url ?? null,

        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  }

  // ----------------------------------------------------
  // GET PROFILE ✅ (ADICIONADO)
  // ----------------------------------------------------
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        age: true,
        city: true,
        avatar_url: true,

        sexo: true,
        peso: true,
        altura: true,
        atividade: true,

        xp: true,
        level: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    return user;
  }
}
