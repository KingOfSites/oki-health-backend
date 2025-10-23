import { User } from "@prisma/client";
import prisma from "../config/database";
import { PasswordUtils } from "../utils/password";
import { JWTUtils } from "../utils/jwt";
import { AppError } from "../middleware/errorHandler";

export interface SignupData {
  email: string;
  password: string;
  name: string;
  age: number;
  city: string;
}

export interface SigninData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, "password">;
  token: string;
}

export class AuthService {
  static async signup(data: SignupData): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, "Email já cadastrado");
    }

    // Validate password
    const passwordValidation = PasswordUtils.validate(data.password);
    if (!passwordValidation.valid) {
      throw new AppError(400, passwordValidation.errors.join(", "));
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        age: data.age,
        city: data.city,
      },
    });

    // Generate token
    const token = JWTUtils.generate(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  static async signin(data: SigninData): Promise<AuthResponse> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError(401, "Email ou senha incorretos");
    }

    // Verify password
    const isPasswordValid = await PasswordUtils.compare(
      data.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new AppError(401, "Email ou senha incorretos");
    }

    // Generate token
    const token = JWTUtils.generate(user.id);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  static async getProfile(userId: string): Promise<Omit<User, "password">> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
