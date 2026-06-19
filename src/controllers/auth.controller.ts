import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRequest } from "../middleware/auth";
import prisma from "../config/database";
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

  // POST /api/auth/google — Mobile
  // Aceita 2 formatos:
  //   1) { idToken } → valida no Google tokeninfo (caminho seguro)
  //   2) { email, name, googleId, photo? } → payload direto (find-or-create)
  static async googleSignIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken, email, name, googleId, photo } = req.body;

      let result;

      if (idToken) {
        result = await AuthService.googleSignIn(idToken);
      } else if (googleId && email) {
        result = await AuthService.googleSignInDirect({
          email,
          name,
          googleId,
          photo,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Envie 'idToken' OU { email, name, googleId, photo? }",
        });
      }

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

  // POST /api/auth/facebook — Mobile
  // Aceita 2 formatos:
  //   1) { accessToken } → valida via Graph API (caminho seguro, legado)
  //   2) { email, name, facebookId, photo? } → payload direto (find-or-create)
  static async facebookSignIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { accessToken, token, email, name, facebookId, photo } = req.body;
      const tokenToUse = accessToken || token;

      let result;

      if (tokenToUse) {
        result = await AuthService.facebookSignIn(tokenToUse);
      } else if (facebookId && email) {
        result = await AuthService.facebookSignInDirect({
          email,
          name,
          facebookId,
          photo,
        });
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Envie 'accessToken' OU { email, name, facebookId, photo? }",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Login com Facebook realizado com sucesso",
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

      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });

      // Sempre retornar sucesso para não vazar se o e-mail existe
      if (!user) {
        return res.json({ success: true, message: "Se o e-mail estiver cadastrado, você receberá um código de recuperação." });
      }

      // Expirar tokens anteriores do usuário
      await (prisma as any).passwordResetToken.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      // Gerar código de 6 dígitos
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      await (prisma as any).passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      // Importar o provedor de e-mail e enviar
      const { MailService } = await import("../services/mail.service");
      await MailService.sendPasswordResetEmail(user.email, token, user.name || "Usuário");

      const isDev = process.env.NODE_ENV !== "production";

      return res.json({
        success: true,
        message: "Se o e-mail estiver cadastrado, você receberá um código de recuperação.",
        ...(isDev && { resetToken: token }),
      });
    } catch (err) {
      console.error("[Auth.forgotPassword]", err);
      return res.status(500).json({ success: false, message: "Erro interno" });
    }
  }

  // DELETE /api/auth/account
  // OKI 26/05/2026 — Exclusão de conta pelo próprio usuário.
  // Requisito LGPD + App Store/Play Store: o app precisa ter um botão
  // dentro das configurações que permita excluir a conta.
  //
  // Fluxo:
  // 1) Anonimiza o usuário (email/nome/nickname/avatar/password vão pra valor descartável)
  // 2) Cancela desafios criados que ainda não iniciaram (libera os outros participantes)
  // 3) Remove o usuário dos desafios em que estava participando
  // 4) Apaga dados pessoais que não têm valor histórico (peso, nutrição, notificações, conquistas)
  // 5) Mantém transações/saques sem o vínculo pessoal (para auditoria fiscal)
  // 6) Marca o registro com `deletedAt` para bloquear login futuro
  static async deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({ success: false, message: "Não autenticado" });
      }

      const userId = req.userId;
      const { password, confirmation } = req.body || {};

      // Confirmação textual obrigatória — evita exclusão acidental
      if (String(confirmation || "").trim().toUpperCase() !== "EXCLUIR") {
        return res.status(400).json({
          success: false,
          message: 'Para confirmar a exclusão envie { confirmation: "EXCLUIR" } no body.',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, password: true, googleId: true, appleId: true, facebookId: true },
      });
      if (!user) {
        return res.status(404).json({ success: false, message: "Usuário não encontrado" });
      }

      // Para usuário com senha local: exigir senha pra confirmar.
      // Para login social puro (sem senha): apenas a confirmação textual basta.
      if (user.password) {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: "Informe sua senha atual para confirmar a exclusão.",
          });
        }
        const ok = await PasswordUtils.compare(String(password), user.password);
        if (!ok) {
          return res.status(401).json({ success: false, message: "Senha incorreta." });
        }
      }

      const now = new Date();
      const anonEmail = `deleted-${user.id}@deleted.okihealth.local`;

      // OKI 26/05/2026 — timeout estendido (30s). A exclusão faz muitos
      // deletes em sequência (8-12 queries) e o default de 5s estoura
      // em contas com bastante histórico (chat, posts, conquistas, etc.).
      await prisma.$transaction(
        async (tx) => {
          // 1) Cancela desafios criados que ainda não começaram (libera
          //    participantes para que vejam o desafio cancelado).
          // Usamos updateMany para fazer em uma query só.
          await tx.challenge.updateMany({
            where: {
              createdById: userId,
              status: { notIn: ["cancelled", "completed"] },
            },
            data: { status: "cancelled" },
          });

          // 2) Remove participações.
          await tx.challengeParticipant.deleteMany({ where: { userId } });

          // 3) Limpa dados estritamente pessoais (rodam em paralelo via Promise.all
          //    para reduzir o tempo dentro da transação).
          await Promise.all([
            tx.weightEntry.deleteMany({ where: { userId } }),
            tx.nutritionAnalysis.deleteMany({ where: { userId } }),
            tx.notification.deleteMany({ where: { userId } }),
            tx.achievement.deleteMany({ where: { userId } }),
            (tx as any).passwordResetToken.deleteMany({ where: { userId } }),
            tx.challengeChat.deleteMany({ where: { userId } }),
            tx.challengePost.deleteMany({ where: { userId } }),
            tx.privateMessage.deleteMany({ where: { senderId: userId } }),
            tx.planSubscription
              .updateMany({
                where: { userId },
                data: { active: false, endDate: now },
              })
              .catch(() => {
                /* opcional, pode não existir */
              }),
          ]);

          // 4) Referrals/Transactions/WithdrawalRequest: mantém (fiscal).

          // 5) Anonimiza o usuário e marca exclusão.
          await tx.user.update({
            where: { id: userId },
            data: {
              email: anonEmail,
              name: "Usuário Removido",
              nickname: null,
              avatar_url: null,
              password: null,
              googleId: null,
              appleId: null,
              facebookId: null,
              age: null,
              city: null,
              peso: null,
              altura: null,
              sexo: null,
              atividade: null,
              notifications: false,
            } as any,
          });
        },
        {
          // 30 segundos pra cobrir contas grandes com bastante histórico.
          maxWait: 5000,
          timeout: 30000,
        },
      );

      return res.json({
        success: true,
        message:
          "Sua conta foi excluída com sucesso. Você não poderá mais fazer login com esses dados.",
      });
    } catch (error) {
      console.error("[Auth.deleteAccount]", error);
      return next(error);
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
