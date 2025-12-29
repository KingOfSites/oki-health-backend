#!/usr/bin/env node

/**
 * Script para verificar em qual porta o backend está rodando
 * e descobrir o IP da máquina para dispositivos móveis
 */

const os = require('os');
const { exec } = require('child_process');
const net = require('net');

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Função para verificar se uma porta está em uso
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(false); // Porta disponível
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(true); // Porta em uso
    });
  });
}

// Função para descobrir IPs da máquina
function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = {
    localhost: ['127.0.0.1', 'localhost'],
    ipv4: [],
    ipv6: [],
  };

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar interfaces internas e não IPv4/IPv6
      if (iface.internal) continue;
      
      if (iface.family === 'IPv4') {
        ips.ipv4.push({
          interface: name,
          address: iface.address,
        });
      } else if (iface.family === 'IPv6') {
        ips.ipv6.push({
          interface: name,
          address: iface.address,
        });
      }
    }
  }

  return ips;
}

// Função para verificar processos na porta
function checkProcessOnPort(port) {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port}`
      : `lsof -i :${port} || netstat -an | grep :${port}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(null);
        return;
      }
      
      if (stdout) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

async function main() {
  log('\n🔍 Verificando configuração de portas e IPs...\n', 'bright');

  // 1. Verificar porta do backend (3005)
  log('📌 Verificando porta do backend (3005)...', 'cyan');
  const portInUse = await checkPort(3005);
  
  if (portInUse) {
    log('   ✅ Porta 3005 está em uso (backend provavelmente está rodando)', 'green');
    
    const processInfo = await checkProcessOnPort(3005);
    if (processInfo) {
      log('   📋 Informações do processo:', 'yellow');
      console.log(`   ${processInfo.split('\n').join('\n   ')}`);
    }
  } else {
    log('   ⚠️  Porta 3005 está livre (backend não está rodando)', 'yellow');
  }

  // 2. Descobrir IPs da máquina
  log('\n🌐 Descobrindo IPs da sua máquina...', 'cyan');
  const ips = getNetworkIPs();
  
  log('\n   📱 IPs para dispositivos móveis (use na mesma rede Wi-Fi):', 'bright');
  
  if (ips.ipv4.length > 0) {
    ips.ipv4.forEach((ip) => {
      log(`   ✅ ${ip.address} (interface: ${ip.interface})`, 'green');
      log(`      → Configure no app: http://${ip.address}:3005/api`, 'blue');
    });
  } else {
    log('   ⚠️  Nenhum IP IPv4 encontrado', 'yellow');
  }

  // 3. Mostrar configuração atual
  log('\n📋 Configuração atual:', 'cyan');
  log(`   Backend URL: http://127.0.0.1:3005/api`, 'blue');
  log(`   Backend URL (localhost): http://localhost:3005/api`, 'blue');
  
  if (ips.ipv4.length > 0) {
    log(`   Backend URL (dispositivo físico): http://${ips.ipv4[0].address}:3005/api`, 'blue');
  }

  // 4. Verificar arquivo .env
  log('\n📄 Verificando arquivo .env...', 'cyan');
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const portMatch = envContent.match(/PORT=(\d+)/);
      
      if (portMatch) {
        const envPort = portMatch[1];
        log(`   ✅ Arquivo .env encontrado - PORT=${envPort}`, 'green');
        
        if (envPort !== '3005') {
          log(`   ⚠️  Aviso: Porta no .env (${envPort}) é diferente de 3005`, 'yellow');
        }
      } else {
        log('   ⚠️  PORT não encontrado no .env (usando padrão: 3005)', 'yellow');
      }
    } else {
      log('   ⚠️  Arquivo .env não encontrado', 'yellow');
    }
  } catch (error) {
    log(`   ❌ Erro ao ler .env: ${error.message}`, 'red');
  }

  // 5. Instruções
  log('\n📱 Para usar no celular físico:', 'bright');
  log('   1. Certifique-se de que o celular e computador estão na mesma rede Wi-Fi', 'yellow');
  if (ips.ipv4.length > 0) {
    log(`   2. Configure no app: http://${ips.ipv4[0].address}:3005/api`, 'yellow');
  } else {
    log('   2. Descubra o IP da sua máquina manualmente (ipconfig/ifconfig)', 'yellow');
  }
  log('   3. Certifique-se de que o backend está rodando', 'yellow');
  log('   4. Verifique se o firewall não está bloqueando a porta 3005', 'yellow');

  log('\n✅ Verificação concluída!\n', 'green');
}

main().catch(console.error);

