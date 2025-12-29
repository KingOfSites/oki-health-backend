import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Verificar se é erro de stack overflow do Prisma
  if (err.message?.includes("Maximum call stack size exceeded") || 
      err.message?.includes("ArgumentsRenderingTree") ||
      err.stack?.includes("ArgumentsRenderingTree")) {
    console.error("❌ Prisma stack overflow error detected - likely circular reference in query");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message?.substring(0, 200));
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor. Por favor, tente novamente.",
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.errors,
    });
  }

  // Log unexpected errors (sem serializar objetos complexos que podem ter referências circulares)
  try {
    const errorName = err.name || "UnknownError";
    const errorMessage = err.message || String(err);
    
    console.error("Unexpected error:", errorName, "-", errorMessage);
    
    if (err.stack) {
      // Limitar tamanho do stack
      const stackLines = err.stack.split("\n").slice(0, 15);
      console.error("Stack (limited):", stackLines.join("\n"));
    }
    
    // Se for um erro do Prisma, logar informações básicas sem tentar serializar
    if (errorName.includes("Prisma")) {
      const prismaErr = err as any;
      console.error("Prisma error code:", prismaErr.code || "N/A");
      // Não tentar serializar meta que pode ter referências circulares
    }
  } catch (logError) {
    // Se até o log falhar, apenas mostrar mensagem básica
    console.error("Error occurred and could not be logged properly");
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
