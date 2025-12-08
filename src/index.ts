import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import prisma from "./config/database";

import challengePostsRoutes from "./routes/challengePosts.routes";

const app = express();

// --------------------------------------------------------
// BODY PARSER ⚠️ Precisa vir ANTES das rotas! (IMPORTANTE)
// --------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = env.ALLOWED_ORIGINS.split(",");
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// --------------------------------------------------------
// SUAS ROTAS AQUI (agora funcionam com body e uploads)
// --------------------------------------------------------
app.use("/api/challenge-posts", challengePostsRoutes);

// Rotas principais
app.use("/api", routes);

// Error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("\n🔴 Shutting down gracefully...");
  try {
    await prisma.$disconnect();
    console.log("✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
const PORT = parseInt(env.PORT);

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
