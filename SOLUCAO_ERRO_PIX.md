# 🔧 Solução: Erro "Collector user without key enabled for QR"

## ❌ Problema

Ao tentar criar um pagamento PIX, você recebe o erro:

```
❌ ERRO START DEPOSIT PAYMENT: {
  error: 'bad_request',
  message: 'Collector user without key enabled for QR rendernull',
  status: 400,
  cause: [{
    code: 13253,
    description: 'Error in Financial Identity Use Case'
  }]
}
```

## 🔍 Causa

Este erro ocorre quando a **conta do Mercado Pago** (a conta que recebe os pagamentos) **não tem uma chave PIX habilitada** para gerar QR codes.

## ✅ Solução

### Opção 1: Habilitar Chave PIX no Mercado Pago (Recomendado)

1. **Acesse o painel do Mercado Pago:**
   - Vá para: https://www.mercadopago.com.br/developers/panel
   - Faça login com a conta que está configurada no `MP_ACCESS_TOKEN`

2. **Configure uma chave PIX:**
   - No painel, vá em **"Suas integrações"** > **"Configurações"**
   - Procure por **"Chave PIX"** ou **"PIX"**
   - Siga as instruções para cadastrar uma chave PIX na sua conta
   - Isso pode levar alguns dias para ser aprovado pelo Mercado Pago

3. **Verifique se está habilitado:**
   - Após configurar, aguarde a aprovação
   - Teste novamente o pagamento PIX

### Opção 2: Usar Pagamento com Cartão (Temporário)

Enquanto a chave PIX não é habilitada, os usuários podem usar **pagamento com cartão de crédito**, que não requer configuração adicional.

### Opção 3: Verificar Conta do Mercado Pago

Certifique-se de que:
- A conta está **verificada** e **ativa**
- A conta está em **modo produção** (não sandbox/teste)
- Você tem permissões para receber pagamentos PIX

## 🔄 Melhorias Implementadas

O código foi atualizado para:

1. **Detectar especificamente este erro** e retornar uma mensagem mais clara
2. **Fornecer instruções** sobre como resolver o problema
3. **Sugerir alternativas** (como usar cartão)

### Mensagem de Erro Melhorada

Agora, quando este erro ocorrer, o usuário receberá:

```json
{
  "success": false,
  "message": "Pagamento PIX não disponível no momento",
  "error": "A chave PIX não está habilitada na conta do Mercado Pago. Entre em contato com o suporte ou use pagamento com cartão.",
  "errorCode": "PIX_KEY_NOT_ENABLED",
  "details": "Para habilitar PIX, acesse o painel do Mercado Pago e configure uma chave PIX na sua conta."
}
```

## 📝 Notas Importantes

- ⚠️ **Este é um problema de configuração da conta do Mercado Pago**, não do código
- ⚠️ A habilitação da chave PIX pode levar **alguns dias** para ser aprovada
- ✅ O pagamento com **cartão de crédito** funciona normalmente sem esta configuração
- ✅ Após habilitar a chave PIX, o erro desaparecerá automaticamente

## 🔗 Links Úteis

- [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
- [Documentação PIX do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/your-integrations)
- [Suporte do Mercado Pago](https://www.mercadopago.com.br/developers/pt/support)

## 🧪 Como Testar

Após habilitar a chave PIX:

1. Reinicie o backend
2. Tente criar um pagamento PIX novamente
3. O QR code deve ser gerado com sucesso
