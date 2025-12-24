console.log("🔥 subscribeRoutes:", subscribeRoutes);
console.log("🔥 authenticate:", authenticate);

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import prisma from "./config/database";
import { authenticate } from "./middleware/auth";

import routes from "./routes"; // Router principal
import subscribeRoutes from "./routes/subscribe.routes";
import challengePostsRoutes from "./routes/challengePosts.routes";

import { errorHandler } from "./middleware/errorHandler";

const app = express();

// --------------------------------------------------------
// BODY PARSER — AGORA ACEITA IMAGENS GRANDES (ATÉ 50MB)
// --------------------------------------------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --------------------------------------------------------
// SECURITY
// --------------------------------------------------------
app.use(helmet());

// --------------------------------------------------------
// CORS
// --------------------------------------------------------
let allowedOrigins = env.ALLOWED_ORIGINS.split(",");

// Garantir localhost:8080
if (!allowedOrigins.includes("http://localhost:8080")) {
  allowedOrigins.push("http://localhost:8080");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // mobile / postman
      if (allowedOrigins.includes(origin)) callback(null, true);
      else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --------------------------------------------------------
// ROUTES
// --------------------------------------------------------

// Middleware de log para debug
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - IP: ${req.ip} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Health check endpoint (antes das rotas)
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// 🔥 Rotas específicas SEM PREFIXO /api
app.use("/api/challenge-posts", challengePostsRoutes);
app.use("/api/subscribe", subscribeRoutes);

// 🔥 Router principal (auth, IA, wallet, challenges, payments, nutrition...)
app.use("/api", routes);

// --------------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------------
app.use(errorHandler);

// --------------------------------------------------------
// SHUTDOWN HANDLING
// --------------------------------------------------------
const gracefulShutdown = async () => {
  console.log("\n🔴 Shutting down gracefully...");
  try {
    await prisma.$disconnect();
    console.log("✅ DB closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error on shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// --------------------------------------------------------
// START SERVER
// --------------------------------------------------------
const PORT = parseInt(env.PORT);

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    // Escutar em 0.0.0.0 para aceitar conexões do emulador/dispositivos
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
      console.log(`📱 Para emulador Android: http://10.0.2.2:${PORT}/api`);
      console.log(`🌐 Para dispositivos físicos: http://SEU_IP:${PORT}/api`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
