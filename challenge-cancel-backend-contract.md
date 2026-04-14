# Cancelamento de desafio

## Endpoint

`POST /api/challenges/:id/cancel`

## Autenticação

Obrigatória via `Authorization: Bearer <token>`.

## Regras

1. Validar usuário logado.
2. Confirmar que o usuário autenticado é o criador do desafio.
3. Não permitir cancelar desafio já `completed`.
4. Se já estiver `cancelled`, responder conflito idempotente.
5. Atualizar `challenges.status` para `cancelled`.
6. Criar notificações para todos os participantes do desafio, exceto o criador.
7. Bloquear novas entradas, mensagens, fotos e pagamentos nesse desafio após o cancelamento.

## Sucesso

`200 OK`

```json
{
  "success": true,
  "message": "Desafio cancelado com sucesso",
  "data": {
    "challengeId": "uuid",
    "notifiedParticipants": 3,
    "status": "cancelled"
  }
}
```

## Erros esperados

### Não autenticado

`401 Unauthorized`

```json
{
  "success": false,
  "message": "NÃ£o autenticado"
}
```

### Não é o criador

`403 Forbidden`

```json
{
  "success": false,
  "message": "Apenas o criador do desafio pode cancelar este desafio"
}
```

### Desafio não encontrado

`404 Not Found`

```json
{
  "success": false,
  "message": "Desafio nÃ£o encontrado"
}
```

### Já cancelado

`409 Conflict`

```json
{
  "success": false,
  "message": "Este desafio jÃ¡ foi cancelado"
}
```

### Já concluído

`409 Conflict`

```json
{
  "success": false,
  "message": "Este desafio jÃ¡ foi concluÃ­do e nÃ£o pode ser cancelado"
}
```
