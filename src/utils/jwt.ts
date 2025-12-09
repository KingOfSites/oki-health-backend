import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export class JWTUtils {
  static generate(userId: string): string {
    const options: SignOptions = {
      expiresIn: (env.JWT_EXPIRES_IN as any) ?? "7d"
    };

    return jwt.sign(
      { userId },
      env.JWT_SECRET as string, // força para o tipo correto
      options
    );
  }

  static verify(token: string): { userId: string } {
    return jwt.verify(token, env.JWT_SECRET as string) as { userId: string };
  }
}
