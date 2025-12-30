# 🔍 Erro: `cc_rejected_other_reason`

## O que significa?

`cc_rejected_other_reason` é um código genérico do Mercado Pago que indica que o pagamento foi rejeitado por um motivo não especificado ou que não se encaixa nas categorias padrão.

## 🔴 Possíveis Causas

### 1. **Cartão de Teste Incorreto**
- Você pode estar usando um cartão de teste que **rejeita** propositalmente
- **Solução**: Use o cartão de teste que **aprova**: `5031 4332 1540 6351`

### 2. **Access Token de Produção com Cartão de Teste**
- Cartões de teste só funcionam com Access Token de **TESTE** (começa com `TEST-`)
- **Solução**: Verifique se está usando Access Token de teste

### 3. **Dados do Cartão Incorretos**
- Número do cartão com espaços ou caracteres inválidos
- CVV incorreto
- Data de validade no formato errado
- **Solução**: Verifique se todos os dados estão corretos

### 4. **CPF Inválido ou Incompatível**
- CPF com formato incorreto
- CPF não corresponde ao titular do cartão (em produção)
- **Solução**: Use um CPF válido (11 dígitos)

### 5. **Limite de Tentativas Excedido**
- Muitas tentativas de pagamento em pouco tempo
- **Solução**: Aguarde alguns minutos antes de tentar novamente

### 6. **Configuração do Mercado Pago**
- Conta do Mercado Pago não configurada corretamente
- Permissões insuficientes
- **Solução**: Verifique as configurações da conta no painel do Mercado Pago

## ✅ Como Resolver

### Passo 1: Verificar Access Token
```env
# No arquivo .env do backend
MP_ACCESS_TOKEN=TEST-xxxxx-xxxxx  # ← Deve começar com "TEST-"
```

### Passo 2: Usar Cartão de Teste Correto
```
Número: 5031 4332 1540 6351
CVV: 123
Validade: 12/25 (qualquer data futura)
Nome: Teste Usuario
CPF: 12345678909
Email: teste@teste.com
```

### Passo 3: Verificar Logs Completos
Agora o código loga o objeto `payment` completo. Procure por:
```
💳 [Wallet Payment] Payment completo: { ... }
```

Isso mostrará todos os campos retornados pelo Mercado Pago, incluindo:
- `payment_method`
- `payment_type_id`
- `operation_type`
- `cause` (array com detalhes do erro)

### Passo 4: Verificar Resposta Completa
O código agora também loga erros na criação do token:
```
❌ [Wallet Payment] Erro ao criar token do cartão: { ... }
```

## 🔧 Melhorias Implementadas

1. **Logs Mais Detalhados**: Agora loga o objeto `payment` completo
2. **Tratamento de Erros no Token**: Captura erros na criação do token separadamente
3. **Mensagens Mais Claras**: Mapeia códigos de erro para mensagens amigáveis
4. **Validação de Token**: Verifica se o token foi criado antes de criar o pagamento

## 📝 Próximos Passos

1. Execute o pagamento novamente
2. Verifique os logs completos no console do backend
3. Procure por `💳 [Wallet Payment] Payment completo:` para ver todos os detalhes
4. Se o erro persistir, verifique:
   - Access Token (deve ser de teste)
   - Cartão de teste correto
   - Todos os dados preenchidos corretamente

## 🆘 Ainda com Problemas?

Se o erro persistir mesmo após essas verificações:

1. **Verifique o Access Token**: Certifique-se de que está usando um token de **TESTE**
2. **Teste com outro cartão**: Use o cartão `5031 4332 1540 6351` que sempre aprova
3. **Verifique os logs completos**: O código agora mostra muito mais informações
4. **Consulte a documentação**: [Mercado Pago - Erros de Pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/response-handling)

