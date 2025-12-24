import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // Verifica se o header existe e está no formato correto
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];

    if (!env.JWT_SECRET) {
      throw new Error("JWT_SECRET está ausente no arquivo .env");
    }

    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET as string) as JwtPayload;
    } catch (err) {
      throw new AppError(401, "Token inválido ou expirado");
    }

    if (!decoded.userId) {
      throw new AppError(401, "Token não contém userId");
    }

    // Anexa o ID do usuário à requisição
    req.userId = decoded.userId;

    return next();
  } catch (error) {
    return next(error);
  }
};

// Middleware de autenticação opcional (não falha se não tiver token)
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
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





