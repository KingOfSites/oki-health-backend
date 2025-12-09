import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import prisma from "./config/database";
import subscribeRoutes from "./routes/subscribe.routes";
import challengePostsRoutes from "./routes/challengePosts.routes";

const app = express();

// ---------------------------------------
// 1. SECURITY & CORS — só aqui, 1 vez
// ---------------------------------------
app.use(helmet());

let allowedOrigins = env.ALLOWED_ORIGINS.split(",");
if (!allowedOrigins.includes("http://localhost:8080")) {
  allowedOrigins.push("http://localhost:8080");
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ---------------------------------------
// 2. BODY PARSER
// ---------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------
// 3. LOG REQUESTS (DEV ONLY)
// ---------------------------------------
if (env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ---------------------------------------
// 4. ROUTES
// ---------------------------------------
app.use("/api/challenge-posts", challengePostsRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api", routes);

// ---------------------------------------
// 5. ERROR HANDLER
// ---------------------------------------
app.use(errorHandler);

// ---------------------------------------
// 6. START SERVER
// ---------------------------------------
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
