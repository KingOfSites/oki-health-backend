import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import prisma from "./config/database";
import subscribeRoutes from "./routes/subscribe.routes";

const app = express();

// ---------------------------------------------------
// ✅ 1. SECURITY + CORS ANTES DE QUALQUER ROTA
// ---------------------------------------------------

app.use(helmet());

// Allowed origins
let allowedOrigins = env.ALLOWED_ORIGINS.split(",");

// Garantir localhost 8080 para o frontend
if (!allowedOrigins.includes("http://localhost:8080")) {
  allowedOrigins.push("http://localhost:8080");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite chamadas internas e ferramentas (Postman, curl, mobile app)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ---------------------------------------------------
// Body Parser
// ---------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------
// Request logging (dev only)
// ---------------------------------------------------
if (env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ---------------------------------------------------
// ✅ 2. AGORA SIM AS ROTAS
// ---------------------------------------------------

// Subscribe (tem que ficar DEPOIS do CORS)
app.use("/api/subscribe", subscribeRoutes);

// Demais rotas
app.use("/api", routes);

// ---------------------------------------------------
// Error Handler
// ---------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------
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

// ---------------------------------------------------
// Start Server
// ---------------------------------------------------
const PORT = parseInt(env.PORT);

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
      console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
