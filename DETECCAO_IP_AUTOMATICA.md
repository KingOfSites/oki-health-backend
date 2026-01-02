# 🔍 Sistema de Detecção Automática de IP

## ✅ Melhorias Implementadas

### Backend

1. **Detecção Inteligente de IPs Wi-Fi**
   - Prioriza IPs de redes Wi-Fi (192.168.x.x, 10.0.x.x, 172.16-31.x.x)
   - Identifica automaticamente interfaces Wi-Fi/WLAN
   - Mostra claramente qual IP usar no frontend

2. **Novo Endpoint: `/api/server-info`**
   - Retorna informações úteis sobre o servidor
   - Inclui o IP recomendado para dispositivos móveis
   - Lista todos os IPs disponíveis com suas URLs

3. **Logs Melhorados**
   - Mostra qual IP é recomendado (marcado com ⭐)
   - Exibe instrução clara de qual IP usar no frontend

### Frontend

1. **IP Atualizado**
   - IP atualizado para `192.168.1.6` (conforme detectado pelo backend)

2. **Função de Detecção Automática**
   - Função `detectBackendIP()` que tenta descobrir o IP correto automaticamente
   - Pode ser usada no futuro para detecção dinâmica

## 🚀 Como Usar

### 1. Verificar o IP Recomendado

Quando você iniciar o backend, verá algo assim:

```
🚀 Server running on port 3005
🔗 API base URL: http://127.0.0.1:3005/api
🌐 Server listening on: 0.0.0.0:3005 (aceita todas as interfaces)
📱 URLs de acesso:
   - Localhost: http://localhost:3005/api
   - 127.0.0.1: http://127.0.0.1:3005/api
   - Android Emulator: http://10.0.2.2:3005/api
   - iOS Simulator: http://127.0.0.1:3005/api
   - Dispositivo físico (mesma rede Wi-Fi):
     → http://192.168.1.6:3005/api ⭐ RECOMENDADO
   💡 Use este IP no frontend: 192.168.1.6
   📋 Consulte /api/server-info para informações detalhadas
```

### 2. Consultar o Endpoint de Informações

Você pode consultar `/api/server-info` para obter informações detalhadas:

```bash
curl http://localhost:3005/api/server-info
```

Ou no navegador:
```
http://localhost:3005/api/server-info
```

Resposta exemplo:
```json
{
  "success": true,
  "server": {
    "port": 3005,
    "environment": "development"
  },
  "urls": {
    "localhost": "http://localhost:3005/api",
    "localhostIp": "http://127.0.0.1:3005/api",
    "androidEmulator": "http://10.0.2.2:3005/api",
    "iOSSimulator": "http://127.0.0.1:3005/api"
  },
  "networkIPs": [
    {
      "ip": "192.168.1.6",
      "url": "http://192.168.1.6:3005/api",
      "recommended": true
    }
  ],
  "recommended": {
    "ip": "192.168.1.6",
    "url": "http://192.168.1.6:3005/api"
  }
}
```

### 3. Atualizar o Frontend

Se o IP mudar, atualize o arquivo `oki-health-native/constants/api.ts`:

```typescript
const DEVICE_IP = "192.168.1.6"; // Atualize aqui com o IP mostrado pelo backend
```

## 🔧 Solução de Problemas

### O IP mudou?

1. Reinicie o backend e veja qual IP é mostrado
2. Atualize `DEVICE_IP` em `oki-health-native/constants/api.ts`
3. Reinicie o app React Native

### Não consegue conectar?

1. **Verifique se o backend está rodando:**
   ```bash
   curl http://localhost:3005/api/health
   ```

2. **Verifique se está na mesma rede Wi-Fi:**
   - Dispositivo e computador devem estar na mesma rede
   - Verifique no celular: Configurações → Wi-Fi

3. **Teste o IP diretamente no navegador do celular:**
   - Abra: `http://192.168.1.6:3005/api/health`
   - Se funcionar no navegador, o problema pode ser no app

4. **Verifique o firewall:**
   - Windows: Permita conexões na porta 3005
   - O backend já escuta em `0.0.0.0` (todas as interfaces)

## 📝 Notas

- O sistema detecta automaticamente IPs de Wi-Fi
- IPs de VPN são ignorados
- O IP recomendado é sempre o primeiro da lista (geralmente Wi-Fi)
- O endpoint `/api/server-info` pode ser usado para automação futura
