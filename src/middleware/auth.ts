import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface AuthRequest extends Request {
  userId?: string; // Definindo o tipo para armazenar o userId no request
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Recuperando o cabeçalho de autorização
    const authHeader = req.headers.authorization;

    // Verifica se o header de autorização está presente e no formato correto
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1]; // Pega o token após o "Bearer "

    // Verifica se o JWT_SECRET está definido no arquivo .env
    if (!env.JWT_SECRET) {
      throw new Error("JWT_SECRET está ausente no arquivo .env");
    }

    // Decodificando e verificando o token
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET as string) as JwtPayload;
    } catch (err) {
      throw new AppError(401, "Token inválido ou expirado");
    }

    // Verifica se o userId está presente no token
    if (!decoded.userId) {
      throw new AppError(401, "Token não contém userId");
    }

    // Anexa o userId ao request
    req.userId = decoded.userId;

    // Log para debug
    console.log("🔐 [Auth Middleware] Token validado - userId:", decoded.userId);
    console.log("🔐 [Auth Middleware] Token payload completo:", JSON.stringify(decoded, null, 2));

    // Passa o controle para o próximo middleware ou rota
    return next();
  } catch (error) {
    return next(error); // Chama o middleware de erro
  }
};

// Middleware de autenticação opcional (não falha se não tiver token)
export const optionalAuthenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // Se não tiver header, continua sem userId
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];

    if (!env.JWT_SECRET) {
      return next(); // Continua sem autenticação
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET as string) as JwtPayload;
      if (decoded.userId) {
        req.userId = decoded.userId;
      }
    } catch (err) {
      // Token inválido, mas continua sem autenticação
      // Não retorna erro, apenas não define userId
    }

    return next();
  } catch (error) {
    // Em caso de erro, continua sem autenticação
    return next();
  }
};





