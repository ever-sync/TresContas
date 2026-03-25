# TresContas

SaaS de contabilidade com portal de clientes, dashboards internos, suporte, plano de contas, DRE e DFC.

## Estrutura

- `frontend/`: React + Vite.
- `backend/`: API Express + Prisma.

## Deploy unificado

O backend agora pode servir o build do frontend, entao o app inteiro sobe como um unico servico.

Fluxo recomendado:

```bash
npm run build
npm start
```

No Railway, a configuracao de `railway.json` ja faz o build do `frontend` e do `backend` no mesmo deploy.

## Comandos

Na raiz:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Para desenvolvimento:

```bash
npm run dev:frontend
npm run dev:backend
```

## Variaveis de ambiente

Backend:

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `PORT`
- `DOCUMENT_STORAGE_PATH`
- `AUTH_ACCESS_TTL`
- `AUTH_REFRESH_TTL`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_SAME_SITE`
- `ACCOUNT_ACTION_TTL`
- `FRONTEND_URL`
- `GROQ_API_KEY`

Frontend:

- `VITE_API_URL`

Se o frontend e o backend estiverem no mesmo dominio, `VITE_API_URL` pode ficar vazio e o app usa `/api`.

## Documentos

Os documentos de clientes ficam em disco por padrao em `backend/storage/client-documents`.
O caminho pode ser alterado com `DOCUMENT_STORAGE_PATH`.

## Migracoes

Para aplicar migracoes em ambiente com banco real:

```bash
npm exec --prefix backend prisma migrate deploy
```
