# 🔧 Solução: Erro de Conexão com Banco de Dados

## ❌ Erro Atual

```
PrismaClientInitializationError: Can't reach database server at `217.196.51.2:3310`
```

Este erro indica que o backend não consegue se conectar ao servidor de banco de dados MySQL.

## 🔍 Diagnóstico

O erro `P1001` significa que o Prisma não consegue alcançar o servidor de banco de dados no endereço especificado.

## ✅ Soluções Possíveis

### 1. Verificar se o Banco de Dados Está Rodando

O servidor MySQL precisa estar ativo e acessível no endereço `217.196.51.2:3310`.

**Como verificar:**
```bash
# Testar conexão com telnet (Windows)
telnet 217.196.51.2 3310

# Ou usar PowerShell
Test-NetConnection -ComputerName 217.196.51.2 -Port 3310
```

Se a conexão falhar, o servidor pode estar:
- Desligado
- Inacessível da sua rede
- Com firewall bloqueando a porta

### 2. Verificar Configuração do .env

Certifique-se de que o arquivo `oki-health-backend/.env` tem a variável `DATABASE_URL` configurada corretamente:

```env
DATABASE_URL=mysql://root:Ujaifhnfoeunroginen81u3ni@217.196.51.2:3310/oki_health
```

**Verifique:**
- ✅ O IP está correto: `217.196.51.2`
- ✅ A porta está correta: `3310`
- ✅ O usuário está correto: `root`
- ✅ A senha está correta: `Ujaifhnfoeunroginen81u3ni`
- ✅ O nome do banco está correto: `oki_health`

### 3. Problemas Comuns e Soluções

#### Problema: Banco em Servidor Remoto

Se o banco está em um servidor remoto (VPS, cloud, etc.):

1. **Verificar se o servidor permite conexões remotas:**
   - O MySQL precisa estar configurado para aceitar conexões de fora do localhost
   - Verifique o arquivo `my.cnf` ou `my.ini` do MySQL
   - A linha `bind-address` deve estar como `0.0.0.0` ou comentada

2. **Verificar firewall:**
   - A porta `3310` precisa estar aberta no firewall do servidor
   - Se estiver usando um serviço de cloud (AWS, DigitalOcean, etc.), verifique as regras de segurança

3. **Verificar permissões do usuário:**
   - O usuário `root` precisa ter permissão para conectar de qualquer host (`%`)
   - Execute no MySQL: `GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'senha';`

#### Problema: Desenvolvimento Local

Se você está desenvolvendo localmente e o banco está em um servidor remoto:

1. **Usar túnel SSH (recomendado):**
   ```bash
   ssh -L 3310:localhost:3306 usuario@217.196.51.2
   ```
   Depois, altere o `.env` para usar `localhost:3310` em vez de `217.196.51.2:3310`

2. **Usar banco local para desenvolvimento:**
   - Instale MySQL localmente
   - Configure `DATABASE_URL` para `mysql://root:senha@localhost:3306/oki_health`
   - Importe o schema do banco de produção

#### Problema: Rede/Firewall

Se você está na mesma rede mas ainda não consegue conectar:

1. **Verificar se o IP está correto:**
   ```bash
   ping 217.196.51.2
   ```

2. **Verificar firewall local:**
   - Windows: Verifique o Firewall do Windows
   - Certifique-se de que a porta não está bloqueada

3. **Verificar VPN:**
   - Se o banco está em uma rede privada, você pode precisar de VPN

### 4. Testar Conexão Manualmente

Você pode testar a conexão usando o cliente MySQL:

```bash
# Windows (se tiver MySQL instalado)
mysql -h 217.196.51.2 -P 3310 -u root -p

# Ou usando Node.js
node -e "const mysql = require('mysql2/promise'); (async () => { const conn = await mysql.createConnection('mysql://root:Ujaifhnfoeunroginen81u3ni@217.196.51.2:3310/oki_health'); console.log('✅ Conectado!'); await conn.end(); })()"
```

### 5. Usar Banco Local para Desenvolvimento

Se o banco remoto não estiver acessível, você pode configurar um banco local:

1. **Instalar MySQL localmente** (se ainda não tiver)

2. **Criar o banco:**
   ```sql
   CREATE DATABASE oki_health;
   ```

3. **Atualizar .env:**
   ```env
   DATABASE_URL=mysql://root:sua_senha_local@localhost:3306/oki_health
   ```

4. **Rodar migrations:**
   ```bash
   cd oki-health-backend
   npx prisma migrate dev
   ```

## 🚀 Após Corrigir

Depois de resolver o problema de conexão:

1. **Reinicie o backend:**
   ```bash
   cd oki-health-backend
   npm run dev
   ```

2. **Você deve ver:**
   ```
   🔌 Tentando conectar ao banco de dados...
      Host: 217.196.51.2:3310
   ✅ Database connected
   🚀 Server running on port 3005
   ```

## 📞 Precisa de Ajuda?

Se nenhuma das soluções funcionar:

1. Verifique os logs do servidor MySQL
2. Verifique se o servidor está acessível de outros lugares
3. Considere usar um banco local para desenvolvimento
4. Entre em contato com o administrador do servidor de banco de dados

## 🔒 Segurança

⚠️ **IMPORTANTE**: Se você estiver usando credenciais de produção, certifique-se de:
- Não commitar o arquivo `.env` no Git
- Usar variáveis de ambiente seguras
- Considerar usar um banco separado para desenvolvimento
