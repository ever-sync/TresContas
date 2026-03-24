# Frontend

Aplicacao React + TypeScript + Vite do TresContas.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

## Ambiente

Crie `frontend/.env` a partir de `frontend/.env.example`.

Variaveis usadas:

- `VITE_API_URL`

## Sessao

O frontend usa cookies `httpOnly` para autenticacao. Nao ha mais persistencia de token em `localStorage` ou `sessionStorage`.
