import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export class PasswordUtils {
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("A senha deve ter pelo menos 8 caracteres");
    }

    if (!/[a-zA-Z]/.test(password)) {
      errors.push("A senha deve conter pelo menos uma letra");
    }

    if (!/\d/.test(password)) {
      errors.push("A senha deve conter pelo menos um número");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("A senha deve conter pelo menos uma letra maiúscula");
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push("A senha deve conter pelo menos um símbolo especial");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
