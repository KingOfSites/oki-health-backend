# 🔍 Como Descobrir Portas e IPs

## 📌 Porta do Backend

### Método 1: Verificar no código
A porta padrão está configurada em:
- **Arquivo**: `src/config/env.ts` → `PORT` (padrão: `3005`)
- **Arquivo**: `.env` → `PORT=3005`

### Método 2: Usar o script automático
```bash
cd oki-health-backend
npm run check:port
```

Este script vai:
- ✅ Verificar se a porta 3005 está em uso
- ✅ Descobrir todos os IPs da sua máquina
- ✅ Mostrar qual IP usar no celular
- ✅ Verificar configuração do `.env`

### Método 3: Verificar manualmente

#### Windows:
```bash
# Ver processos na porta 3005
netstat -ano | findstr :3005

# Ver todas as portas em uso
netstat -ano
```

#### Mac/Linux:
```bash
# Ver processos na porta 3005
lsof -i :3005

# Ou
netstat -an | grep 3005
```

### Método 4: Verificar nos logs do backend
Quando você inicia o backend com `npm run dev`, você verá:
```
🚀 Server running on port 3005
🔗 API base URL: http://127.0.0.1:3005/api
```

---

## 📱 IP do Celular e da Máquina

### Descobrir IP da sua máquina (para usar no celular físico)

#### Windows:
```bash
ipconfig
```
Procure por **"IPv4 Address"** (ex: `192.168.1.100`)

#### Mac/Linux:
```bash
ifconfig
# Ou
ip addr show
```
Procure por **"inet"** (ex: `192.168.1.100`)

### Descobrir IP do celular

#### Android:
1. Abra **Configurações**
2. Vá em **Sobre o telefone** → **Status** → **Endereço IP**
3. Ou: **Configurações** → **Wi-Fi** → Toque no Wi-Fi conectado → Ver **IP**

#### iOS:
1. Abra **Configurações**
2. Vá em **Wi-Fi**
3. Toque no **ⓘ** ao lado do Wi-Fi conectado
4. Veja o **Endereço IP**

---

## 🔧 Verificar Conexão

### 1. Verificar se o backend está rodando

#### No navegador:
Abra: `http://127.0.0.1:3005/api/health`

Deve retornar:
```json
{
  "success": true,
  "message": "Server is running",
  "port": 3005,
  "apiUrl": "http://127.0.0.1:3005/api"
}
```

#### No terminal:
```bash
# Windows
curl http://127.0.0.1:3005/api/health

# Mac/Linux
curl http://127.0.0.1:3005/api/health
```

### 2. Verificar do celular

#### Se estiver na mesma rede Wi-Fi:
1. Descubra o IP da sua máquina (veja acima)
2. No navegador do celular, abra: `http://SEU_IP:3005/api/health`
   - Exemplo: `http://192.168.1.100:3005/api/health`

#### Se não funcionar:
- ✅ Certifique-se de que o celular e computador estão na **mesma rede Wi-Fi**
- ✅ Verifique se o **firewall** não está bloqueando a porta 3005
- ✅ Certifique-se de que o **backend está rodando**

---

## 🛠️ Solução de Problemas

### Porta já está em uso

#### Windows:
```bash
# Encontrar processo na porta 3005
netstat -ano | findstr :3005

# Matar processo (substitua PID pelo número encontrado)
taskkill /PID <PID> /F
```

#### Mac/Linux:
```bash
# Encontrar processo na porta 3005
lsof -i :3005

# Matar processo (substitua PID pelo número encontrado)
kill -9 <PID>
```

### Firewall bloqueando

#### Windows:
1. Abra **Firewall do Windows Defender**
2. **Configurações avançadas**
3. **Regras de entrada** → **Nova regra**
4. **Porta** → **TCP** → **3005**
5. **Permitir conexão**

#### Mac:
```bash
# Permitir porta 3005
sudo pfctl -f /etc/pf.conf
```

#### Linux:
```bash
# Ubuntu/Debian
sudo ufw allow 3005

# CentOS/RHEL
sudo firewall-cmd --add-port=3005/tcp --permanent
sudo firewall-cmd --reload
```

---

## 📋 Checklist Rápido

- [ ] Backend rodando? → `npm run dev` no backend
- [ ] Porta 3005 em uso? → `npm run check:port`
- [ ] IP da máquina descoberto? → `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
- [ ] Celular na mesma rede Wi-Fi? → Verificar configurações do Wi-Fi
- [ ] Health check funciona? → `http://127.0.0.1:3005/api/health`
- [ ] Firewall configurado? → Permitir porta 3005

---

## 🚀 Comandos Úteis

```bash
# Backend - Verificar porta e IPs
cd oki-health-backend
npm run check:port

# Backend - Iniciar servidor
npm run dev

# Verificar conexão (do frontend)
cd oki-health-native
node scripts/check-connection.js
```

