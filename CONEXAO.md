# 🔌 Guia de Conexão Backend ↔ Frontend

## ✅ Configurações Aplicadas

### Backend (`oki-health-backend`)

1. **CORS configurado** para aceitar:
   - Requisições sem origin (React Native)
   - Localhost em várias portas
   - Modo desenvolvimento mais permissivo

2. **Helmet configurado** para não bloquear requisições do React Native

3. **Servidor escutando em `0.0.0.0:3005`** para aceitar conexões de dispositivos móveis

### Frontend (`oki-health-native`)

1. **URL da API configurada** automaticamente:
   - Android Emulator: `http://10.0.2.2:3005/api`
   - iOS Simulator: `http://127.0.0.1:3005/api`
   - Web: `http://localhost:3005/api`

## 🚀 Como Testar a Conexão

### 1. Iniciar o Backend

```bash
cd oki-health-backend
npm run dev
```

Você deve ver:
```
✅ Database connected
🚀 Server running on port 3005
🔗 API base URL: http://localhost:3005/api
```

### 2. Testar Health Check

No navegador ou Postman:
```
GET http://localhost:3005/api/health
```

Resposta esperada:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2025-01-XX..."
}
```

### 3. Iniciar o Frontend

```bash
cd oki-health-native
npx expo start
```

No console do frontend, você deve ver:
```
🔗 API Base URL: http://127.0.0.1:3005/api
```

## 🔧 Solução de Problemas

### Erro: "Network request failed"

1. **Verifique se o backend está rodando:**
   ```bash
   # No terminal do backend, você deve ver logs de requisições
   ```

2. **Verifique a porta:**
   - Backend deve estar na porta 3005
   - Frontend deve usar a URL correta para a plataforma

3. **Para dispositivo físico:**
   - Descubra o IP da sua máquina: `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
   - Configure `MANUAL_IP` em `oki-health-native/constants/api.ts`
   - Certifique-se de que o dispositivo e computador estão na mesma rede Wi-Fi

### Erro: "Not allowed by CORS"

- O backend está configurado para aceitar requisições sem origin (React Native)
- Em desenvolvimento, todas as origins são permitidas
- Verifique os logs do backend para ver qual origin está sendo bloqueada

### Backend não inicia

1. **Verifique o arquivo `.env`:**
   - Deve ter `DATABASE_URL`
   - Deve ter `JWT_SECRET` (mínimo 32 caracteres)
   - Deve ter `PORT=3005`

2. **Verifique se o banco está acessível:**
   - Teste a conexão com o MySQL
   - Verifique se o Prisma está configurado corretamente

## 📱 Configuração para Dispositivo Físico

1. **Descubra o IP da sua máquina:**
   ```bash
   # Windows
   ipconfig
   # Procure por "IPv4 Address" (ex: 192.168.1.100)
   
   # Mac/Linux
   ifconfig
   # Procure por "inet" (ex: 192.168.1.100)
   ```

2. **Configure no frontend:**
   - Abra `oki-health-native/constants/api.ts`
   - Altere `MANUAL_IP` para o IP da sua máquina:
   ```typescript
   const MANUAL_IP = "192.168.1.100"; // Seu IP aqui
   ```

3. **Certifique-se de que:**
   - Backend está rodando
   - Dispositivo e computador estão na mesma rede Wi-Fi
   - Firewall não está bloqueando a porta 3005

## ✅ Checklist de Conexão

- [ ] Backend está rodando na porta 3005
- [ ] Arquivo `.env` configurado corretamente
- [ ] Database conectado (veja logs do backend)
- [ ] Frontend configurado com URL correta
- [ ] CORS permitindo requisições (veja logs do backend)
- [ ] Health check funciona: `GET http://localhost:3005/api/health`


