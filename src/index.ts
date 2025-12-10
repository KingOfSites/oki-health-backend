console.log("🔥 subscribeRoutes:", subscribeRoutes);
console.log("🔥 authenticate:", authenticate);



import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import prisma from "./config/database";
import { authenticate } from "./middleware/auth";




import routes from "./routes"; // ← Router principal (auth, challenges, wallet, chat)
import subscribeRoutes from "./routes/subscribe.routes";
import challengePostsRoutes from "./routes/challengePosts.routes";

import { errorHandler } from "./middleware/errorHandler";

const app = express();

// --------------------------------------------------------
// BODY PARSER
// --------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// 🔥 ROTAS ESPECÍFICAS
app.use("/api/challenge-posts", challengePostsRoutes);
app.use("/api/subscribe", subscribeRoutes);



// 🔥 ROTAS PRINCIPAIS (auth, challenges, wallet, chat)
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

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
