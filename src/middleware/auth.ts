import { Response, NextFunction } from "express";
import { JWTUtils } from "../utils/jwt";
import { AuthRequest } from "./auth";

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = JWTUtils.verify(token); // { userId: string }

    req.userId = decoded.userId;

    next();

  } catch (err) {
    console.error("[authenticate] error:", err);
    return res.status(401).json({ error: "Token inválido" });
  }
};
