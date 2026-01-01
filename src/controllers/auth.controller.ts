import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRequest } from "../middleware/auth";

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
}
