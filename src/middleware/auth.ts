import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = JWTUtils.verify(token); // { userId: string }

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

    req.userId = decoded.userId;

    return next();
  } catch (error) {
    return next(error);
  }
};
