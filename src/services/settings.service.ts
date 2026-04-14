import prisma from "../config/database";
import { AppError } from "../middleware/errorHandler";

export class SettingsService {
  // Obter configurações do usuário
  static async getSettings(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        darkMode: true,
        notifications: true,
        name: true,
        age: true,
        city: true,
        email: true,
        avatar_url: true,
        sexo: true,
        peso: true,
        altura: true,
        atividade: true,
        xp: true,
        level: true,
      },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    return {
      darkMode: user.darkMode ?? true,
      notifications: user.notifications ?? true,
      name: user.name,
      age: user.age,
      city: user.city,
      email: user.email,
      avatar_url: user.avatar_url,
      sexo: user.sexo,
      peso: user.peso,
      altura: user.altura,
      atividade: user.atividade,
      xp: user.xp,
      level: user.level,
    };
  }

  // Atualizar configurações do usuário
  static async updateSettings(
    userId: string,
    data: {
      darkMode?: boolean;
      notifications?: boolean;
      name?: string;
      age?: number;
      city?: string;
      avatar_url?: string;
      sexo?: "M" | "F";
      peso?: number;
      altura?: number;
      atividade?: "sedentario" | "leve" | "moderado" | "intenso" | "muito_intenso";
    }
  ) {
    // Verificar se o usuário existe (apenas id para evitar referências circulares)
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new AppError(404, "Usuário não encontrado");
    }

    const updateData: any = {};
    
    if (data.darkMode !== undefined) updateData.darkMode = data.darkMode;
    if (data.notifications !== undefined) updateData.notifications = data.notifications;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.age !== undefined) updateData.age = data.age;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
    if (data.sexo !== undefined) updateData.sexo = data.sexo;
    if (data.peso !== undefined) updateData.peso = data.peso;
    if (data.altura !== undefined) updateData.altura = data.altura;
    if (data.atividade !== undefined) updateData.atividade = data.atividade;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        darkMode: true,
        notifications: true,
        name: true,
        age: true,
        city: true,
        email: true,
        avatar_url: true,
        sexo: true,
        peso: true,
        altura: true,
        atividade: true,
        xp: true,
        level: true,
      },
    });

    return updated;
  }

  // Atualizar senha do usuário
  static async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    // Buscar apenas os campos necessários para evitar referências circulares
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    // Verificar senha atual
    const { PasswordUtils } = await import("../utils/password");
    const isPasswordValid = await PasswordUtils.compare(
      currentPassword,
      user.password || ""
    );

    if (!isPasswordValid) {
      throw new AppError(400, "Senha atual incorreta");
    }

    // Validar nova senha
    const passwordValidation = PasswordUtils.validate(newPassword);
    if (!passwordValidation.valid) {
      throw new AppError(400, passwordValidation.errors.join(", "));
    }

    // Hash da nova senha
    const hashedPassword = await PasswordUtils.hash(newPassword);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true, message: "Senha atualizada com sucesso" };
  }
}

