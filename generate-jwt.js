#!/usr/bin/env node

const crypto = require("crypto");

// Gerar uma chave JWT segura de 64 caracteres
function generateJWTSecret(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

// Gerar token JWT usando Node.js built-in crypto
function generateJWT(payload, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Exemplo de uso
console.log("🔐 Gerador de JWT Token\n");

// Gerar chave secreta
const jwtSecret = generateJWTSecret();
console.log("📝 JWT Secret (cole no seu .env):");
console.log(`JWT_SECRET="${jwtSecret}"`);
console.log("");

// Gerar token de exemplo
const payload = {
  userId: "example-user-id-123",
  email: "usuario@email.com",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 dias
};

const token = generateJWT(payload, jwtSecret);
console.log("🎫 Token JWT de exemplo:");
console.log(token);
console.log("");

console.log("📋 Como usar:");
console.log("1. Copie o JWT_SECRET acima para seu arquivo .env");
console.log("2. Use o token acima para testar autenticação");
console.log("3. O token expira em 7 dias");
console.log("");

// Validar token
function validateToken(token, secret) {
  try {
    const [header, payload, signature] = token.split(".");

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    if (signature === expectedSignature) {
      const decodedPayload = JSON.parse(
        Buffer.from(payload, "base64url").toString()
      );
      console.log("✅ Token válido!");
      console.log("📄 Payload:", JSON.stringify(decodedPayload, null, 2));
      return true;
    } else {
      console.log("❌ Token inválido!");
      return false;
    }
  } catch (error) {
    console.log("❌ Erro ao validar token:", error.message);
    return false;
  }
}

console.log("🔍 Validando token gerado...");
validateToken(token, jwtSecret);
