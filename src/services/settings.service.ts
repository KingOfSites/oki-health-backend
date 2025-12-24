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
      },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    return {
      darkMode: user.darkMode ?? true,
      notifications: user.notifications ?? true,
    };
  }

  // Atualizar configurações do usuário
  static async updateSettings(
    userId: string,
    data: { darkMode?: boolean; notifications?: boolean }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.darkMode !== undefined && { darkMode: data.darkMode }),
        ...(data.notifications !== undefined && {
          notifications: data.notifications,
        }),
      },
      select: {
        darkMode: true,
        notifications: true,
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    // Verificar senha atual
    const { PasswordUtils } = await import("../utils/password");
    const isPasswordValid = await PasswordUtils.compare(
      currentPassword,
      user.password
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

