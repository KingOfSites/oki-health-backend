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
import { startNotificationEngine } from "./jobs/notificationEngine";
import avatarRoutes from "./routes/avatar.routes";
import reportsRoutes from "./routes/reports.routes";

const app = express();

// --------------------------------------------------------
// BODY PARSER — AGORA ACEITA IMAGENS GRANDES (ATÉ 50MB)
// --------------------------------------------------------
// Capturar rawBody antes do parsing para validação de assinatura do webhook
app.use(express.json({ 
  limit: "50mb",
  verify: (req: any, _res, buf) => {
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
  "http://192.168.1.9:8080",
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
app.use((req, _res, next) => {
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
app.get("/", (_req, res) => {
  res.json({ 
    success: true, 
    message: "🚀 Oki Health Backend API está funcionando!",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: env.NODE_ENV,
    apiUrl: `http://localhost:${PORT}/api`,
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
app.get("/api/health", (_req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: env.NODE_ENV,
    apiUrl: `http://192.168.1.6:${PORT}/api`,
    features: {
      challengeCancellation: true,
      participantChallengeCancellation: true,
      challengeManagement: true,
    }
  });
});

// Server info endpoint - retorna informações úteis para configuração do frontend
app.get("/api/server-info", (_req, res) => {
  const networkIPs = getNetworkIPs();
  const recommendedIP = getRecommendedIP();
  
  res.json({
    success: true,
    server: {
      port: PORT,
      environment: env.NODE_ENV,
    },
    urls: {
      localhost: `http://localhost:${PORT}/api`,
      localhostIp: `http://192.168.1.6:${PORT}/api`,
      androidEmulator: `http://10.0.2.2:${PORT}/api`,
      iOSSimulator: `http://192.168.1.6:${PORT}/api`,
    },
    networkIPs: networkIPs.map(ip => ({
      ip,
      url: `http://${ip}:${PORT}/api`,
      recommended: ip === recommendedIP
    })),
    recommended: recommendedIP ? {
      ip: recommendedIP,
      url: `http://${recommendedIP}:${PORT}/api`
    } : null,
    features: {
      challengeCancellation: true,
      participantChallengeCancellation: true,
      challengeManagement: true,
    },
    timestamp: new Date().toISOString()
  });
});

// Rotas específicas
app.use("/api/challenge-posts", challengePostsRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/affiliates", affiliateRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/avatar", avatarRoutes);
app.use("/api/reports", reportsRoutes);

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
// Retorna IPs priorizados: Wi-Fi primeiro, depois outros
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const wifiIPs: string[] = [];
  const otherIPs: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Ignorar interfaces internas e não IPv4
      if (iface.internal || iface.family !== 'IPv4') continue;
      
      const ip = iface.address;
      
      // Priorizar IPs de Wi-Fi (192.168.x.x, 10.0.x.x, 172.16-31.x.x)
      // Ignorar IPs de loopback e link-local
      if (
        ip.startsWith('192.168.') ||
        ip.startsWith('10.') ||
        (ip.startsWith('172.') && parseInt(ip.split('.')[1] || '0') >= 16 && parseInt(ip.split('.')[1] || '0') <= 31)
      ) {
        // Priorizar interfaces Wi-Fi/WLAN
        if (name.toLowerCase().includes('wi-fi') || 
            name.toLowerCase().includes('wlan') ||
            name.toLowerCase().includes('wireless') ||
            name.toLowerCase().includes('802.11')) {
          wifiIPs.unshift(ip); // Adicionar no início
        } else {
          wifiIPs.push(ip);
        }
      } else if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
        // Outros IPs (exceto loopback e link-local)
        otherIPs.push(ip);
      }
    }
  }

  // Retornar Wi-Fi primeiro, depois outros
  return [...wifiIPs, ...otherIPs];
}

// Função para obter o IP recomendado para dispositivos móveis
function getRecommendedIP(): string | null {
  const ips = getNetworkIPs();
  // Retornar o primeiro IP (que é o mais prioritário - geralmente Wi-Fi)
  return ips.length > 0 ? ips[0] : null;
}

const startServer = async () => {
  try {
    // Verificar se DATABASE_URL está configurado
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("❌ DATABASE_URL não está configurado no arquivo .env");
      console.error("   Configure a variável DATABASE_URL no arquivo oki-health-backend/.env");
      process.exit(1);
    }

    // Extrair informações da URL do banco para mensagens de erro mais claras
    const dbUrlMatch = databaseUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    const dbHost = dbUrlMatch ? dbUrlMatch[3] : "desconhecido";
    const dbPort = dbUrlMatch ? dbUrlMatch[4] : "desconhecido";

    console.log(`🔌 Tentando conectar ao banco de dados...`);
    console.log(`   Host: ${dbHost}:${dbPort}`);

    // Tentar conectar com timeout
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout: Conexão com o banco de dados excedeu 10 segundos")), 10000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    console.log("✅ Database connected");

    // Inicializa o agendador de notificações nativo
    startNotificationEngine();

    // Descobrir IPs da máquina
    const networkIPs = getNetworkIPs();

    // Escutar em todas as interfaces (0.0.0.0) para permitir conexões de dispositivos móveis
    // Isso permite conexões via localhost, 192.168.1.6, IP local, etc.
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 API base URL: http://192.168.1.6:${PORT}/api`);
      console.log(`🌐 Server listening on: 0.0.0.0:${PORT} (aceita todas as interfaces)`);
      console.log(`📱 URLs de acesso:`);
      console.log(`   - Localhost: http://localhost:${PORT}/api`);
      console.log(`   - 192.168.1.6: http://192.168.1.6:${PORT}/api`);
      console.log(`   - Android Emulator: http://10.0.2.2:${PORT}/api`);
      console.log(`   - iOS Simulator: http://192.168.1.6:${PORT}/api`);
      
      if (networkIPs.length > 0) {
        const recommendedIP = getRecommendedIP();
        console.log(`   - Dispositivo físico (mesma rede Wi-Fi):`);
        networkIPs.forEach((ip) => {
          const marker = ip === recommendedIP ? " ⭐ RECOMENDADO" : "";
          console.log(`     → http://${ip}:${PORT}/api${marker}`);
        });
        if (recommendedIP) {
          console.log(`   💡 Use este IP no frontend: ${recommendedIP}`);
        }
      } else {
        console.log(`   - Dispositivo físico: descubra o IP da sua máquina (ipconfig/ifconfig)`);
      }
      console.log(`   📋 Consulte /api/server-info para informações detalhadas`);
      
      console.log(`📋 CORS: Permitindo requisições sem origin (React Native)`);
      console.log(`📋 CORS: Modo desenvolvimento - todas as origins permitidas`);
    });
  } catch (error: any) {
    console.error("\n❌ Erro ao conectar ao banco de dados:");
    
    if (error.code === "P1001") {
      console.error("   O servidor de banco de dados não está acessível.");
      const dbUrlMatch = process.env.DATABASE_URL?.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (dbUrlMatch) {
        const dbHost = dbUrlMatch[3];
        const dbPort = dbUrlMatch[4];
        console.error(`   Tentando conectar em: ${dbHost}:${dbPort}`);
      }
      console.error("\n🔧 Possíveis soluções:");
      console.error("   1. Verifique se o servidor de banco de dados está rodando");
      console.error("   2. Verifique se o IP e porta estão corretos no arquivo .env");
      console.error("   3. Se o banco está em um servidor remoto, verifique:");
      console.error("      - Se o firewall permite conexões na porta do banco");
      console.error("      - Se o servidor permite conexões remotas");
      console.error("      - Se você está na mesma rede ou tem acesso VPN");
      console.error("   4. Para desenvolvimento local, considere usar um banco local");
      console.error("      ou configurar um túnel SSH se necessário");
    } else if (error.message?.includes("Timeout")) {
      console.error("   A conexão demorou muito para responder.");
      console.error("\n🔧 Possíveis soluções:");
      console.error("   1. Verifique sua conexão de internet");
      console.error("   2. O servidor de banco pode estar sobrecarregado");
      console.error("   3. Verifique se o firewall não está bloqueando a conexão");
    } else if (error.code === "P1000") {
      console.error("   Falha na autenticação com o banco de dados.");
      console.error("\n🔧 Possíveis soluções:");
      console.error("   1. Verifique se o usuário e senha estão corretos no .env");
      console.error("   2. Verifique se o usuário tem permissões para acessar o banco");
    } else {
      console.error("   Erro:", error.message || error);
    }
    
    console.error("\n📝 Verifique o arquivo .env em oki-health-backend/.env");
    console.error("   Certifique-se de que DATABASE_URL está configurado corretamente.\n");
    
    process.exit(1);
  }
};

startServer();
