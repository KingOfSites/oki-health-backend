import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRequest } from "../middleware/auth";
import prisma from "../config/database";
import crypto from "crypto";
import { PasswordUtils } from "../utils/password";

export class AuthController {

  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.signup(req.body);

      return res.status(201).json({
        success: true,
        message: "Usuário criado com sucesso",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async signin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.signin(req.body);

      return res.status(200).json({
        success: true,
        message: "Login realizado com sucesso",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/auth/admin/login - Login específico para admin
  static async adminLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email e senha são obrigatórios",
        });
      }

      try {
        const result = await AuthService.signin({ email, password });

        // Verificar se o usuário é admin
        if (!result.user.isAdmin) {
          return res.status(403).json({
            success: false,
            message: "Acesso negado. Apenas administradores podem acessar este painel.",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Login realizado com sucesso",
          data: result,
        });
      } catch (authError: any) {
        // Se o erro for do AuthService (email/senha incorretos)
        return res.status(401).json({
          success: false,
          message: authError.message || "Email ou senha incorretos",
        });
      }
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/auth/google — Mobile (idToken)
  static async googleSignIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ success: false, message: "idToken é obrigatório" });
      }

      const result = await AuthService.googleSignIn(idToken);

      return res.status(200).json({
        success: true,
        message: "Login com Google realizado com sucesso",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/auth/apple — Mobile (identityToken)
  static async appleSignIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { identityToken, user: userInfo } = req.body;
      if (!identityToken) {
        return res.status(400).json({ success: false, message: "identityToken é obrigatório" });
      }

      const result = await AuthService.appleSignIn(identityToken, userInfo);

      return res.status(200).json({
        success: true,
        message: "Login com Apple realizado com sucesso",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async googleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, redirectUri } = req.body;

      if (!code || !redirectUri) {
        return res.status(400).json({
          success: false,
          message: "code e redirectUri são obrigatórios",
        });
      }

      const result = await AuthService.googleCallback(code, redirectUri);

      return res.status(200).json({
        success: true,
        message: "Login com Google realizado com sucesso",
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const user = await AuthService.getProfile(req.userId);

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado",
        });
      }

      const updated = await AuthService.updateProfile(req.userId, req.body);

      return res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso",
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  // POST /api/auth/forgot-password
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "Email é obrigatório" });
      }

      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });

      // Sempre retornar sucesso para não vazar se o e-mail existe
      if (!user) {
        return res.json({ success: true, message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação." });
      }

      // Expirar tokens anteriores do usuário
      await (prisma as any).passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await (prisma as any).passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      // TODO: enviar e-mail com link contendo o token
      // Por enquanto retorna o token na resposta (apenas em dev)
      const isDev = process.env.NODE_ENV !== "production";

      return res.json({
        success: true,
        message: "Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.",
        ...(isDev && { resetToken: token }),
      });
    } catch (err) {
      console.error("[Auth.forgotPassword]", err);
      return res.status(500).json({ success: false, message: "Erro interno" });
    }
  }

  // POST /api/auth/reset-password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: "Token e nova senha são obrigatórios" });
      }

      const resetToken = await (prisma as any).passwordResetToken.findUnique({ where: { token } });

      if (!resetToken || resetToken.used || new Date() > resetToken.expiresAt) {
        return res.status(400).json({ success: false, message: "Token inválido ou expirado" });
      }

      const validation = PasswordUtils.validate(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.errors.join(", ") });
      }

      const hashed = await PasswordUtils.hash(newPassword);

      await prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashed } });
      await (prisma as any).passwordResetToken.update({ where: { token }, data: { used: true } });

      return res.json({ success: true, message: "Senha redefinida com sucesso" });
    } catch (err) {
      console.error("[Auth.resetPassword]", err);
      return res.status(500).json({ success: false, message: "Erro interno" });
    }
  }
}
