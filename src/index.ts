import express from "express";
import cors from "cors";
import helmet from "helmet";
import os from "os";
import { env } from "./config/env";
import prisma from "./config/database";
import { errorHandler } from "./middleware/errorHandler";

// Router principal
import routes from "./routes";
import subscribeRoutes from "./routes/subscribe.routes";
import challengePostsRoutes from "./routes/challengePosts.routes";
import affiliateRoutes from "./routes/affiliate.routes";
import settingsRoutes from "./routes/settings.routes";
import avatarRoutes from "./routes/avatar.routes";

const app = express();

// --------------------------------------------------------
// BODY PARSER — AGORA ACEITA IMAGENS GRANDES (ATÉ 50MB)
// --------------------------------------------------------
// Capturar rawBody antes do parsing para validação de assinatura do webhook
app.use(express.json({ 
  limit: "50mb",
  verify: (req: any, res, buf) => {
    // Capturar body bruto apenas para rotas de webhook (para validação HMAC)
    if (req.path && req.path.includes('/webhook')) {
      req.rawBody = buf.toString('utf8');
    }
  }
}));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --------------------------------------------------------
// SECURITY
// --------------------------------------------------------
// Configurar Helmet para permitir requisições do React Native
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

// --------------------------------------------------------
// CORS - Configurado para aceitar React Native e Web
// --------------------------------------------------------
let allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());

// Adicionar origens padrão para desenvolvimento
const defaultOrigins = [
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:3005",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3005",
  "http://localhost:19006", // Expo web
];

defaultOrigins.forEach((origin) => {
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
}
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (React Native, Postman, etc)
      if (!origin) {
        return callback(null, true);
      }
      
      // Verificar se a origin está na lista permitida
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Em desenvolvimento, permitir qualquer origin (mais permissivo)
      if (env.NODE_ENV === "development") {
        console.log("✅ [CORS] Modo desenvolvimento - permitindo origin:", origin);
        return callback(null, true);
      }
      
      // Log para debug em produção
      console.log("⚠️ [CORS] Origin não permitida:", origin);
      console.log("📋 [CORS] Origens permitidas:", allowedOrigins);
      
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// --------------------------------------------------------
// ROUTES
// --------------------------------------------------------

// Definir PORT antes de usar no health check
const PORT = parseInt(env.PORT);

// Middleware de log para debug
app.use((req, res, next) => {
  const origin = req.headers.origin || 'none';
  const userAgent = req.headers['user-agent'] || 'unknown';
  console.log(`📥 ${req.method} ${req.path} - IP: ${req.ip} - Origin: ${origin}`);
  // Log mais detalhado apenas para requisições de API (não para health check)
  if (!req.path.includes('/health')) {
    console.log(`   User-Agent: ${userAgent.substring(0, 50)}...`);
  }
  next();
});

// Rota na raiz para indicar que o servidor está funcionando
app.get("/", (req, res) => {
  res.json({ 
    success: true, 
    message: "🚀 Oki Health Backend API está funcionando!",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: env.NODE_ENV,
    apiUrl: `http://127.0.0.1:${PORT}/api`,
    endpoints: {
      health: "/api/health",
      wallet: "/api/wallet",
      auth: "/api/auth",
      challenges: "/api/challenges",
      webhook: "/api/wallet/webhook"
    }
  });
});

// Health check endpoint (antes das rotas)
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: env.NODE_ENV,
    apiUrl: `http://127.0.0.1:${PORT}/api`
  });
});

// Rotas específicas
app.use("/api/challenge-posts", challengePostsRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/affiliates", affiliateRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/avatar", avatarRoutes);

// Router principal (auth, IA, wallet, challenges, payments, nutrition...)
app.use("/api", routes);

// Rotas admin
import adminRoutes from "./routes/admin.routes";
app.use("/api/admin", adminRoutes);

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

// Função para descobrir IPs da máquina
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Ignorar interfaces internas e não IPv4
      if (iface.internal || iface.family !== 'IPv4') continue;
      ips.push(iface.address);
    }
  }

  return ips;
}

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    // Descobrir IPs da máquina
    const networkIPs = getNetworkIPs();

    // Escutar em todas as interfaces (0.0.0.0) para permitir conexões de dispositivos móveis
    // Isso permite conexões via localhost, 127.0.0.1, IP local, etc.
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 API base URL: http://127.0.0.1:${PORT}/api`);
      console.log(`🌐 Server listening on: 0.0.0.0:${PORT} (aceita todas as interfaces)`);
      console.log(`📱 URLs de acesso:`);
      console.log(`   - Localhost: http://localhost:${PORT}/api`);
      console.log(`   - 127.0.0.1: http://127.0.0.1:${PORT}/api`);
      console.log(`   - Android Emulator: http://10.0.2.2:${PORT}/api`);
      console.log(`   - iOS Simulator: http://127.0.0.1:${PORT}/api`);
      
      if (networkIPs.length > 0) {
        console.log(`   - Dispositivo físico (mesma rede Wi-Fi):`);
        networkIPs.forEach((ip) => {
          console.log(`     → http://${ip}:${PORT}/api`);
        });
      } else {
        console.log(`   - Dispositivo físico: descubra o IP da sua máquina (ipconfig/ifconfig)`);
      }
      
      console.log(`📋 CORS: Permitindo requisições sem origin (React Native)`);
      console.log(`📋 CORS: Modo desenvolvimento - todas as origins permitidas`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
