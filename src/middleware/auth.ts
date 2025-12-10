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

    // Decodifica o token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (!decoded || !decoded.userId) {
      throw new AppError(401, "Token inválido ou não contém userId");
    }

    // Anexa o ID do usuário à requisição
    req.userId = decoded.userId;

    return next();
  } catch (error) {
    return next(error);
  }
};





