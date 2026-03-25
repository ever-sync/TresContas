# TresContas

SaaS de contabilidade com portal de clientes, dashboards internos, suporte, plano de contas, DRE e DFC.

## Estrutura

- `frontend/`: React + Vite.
- `backend/`: API Express + Prisma.

## Deploy

O caminho mais simples e menos confuso e manter o backend como deploy separado em `backend/`.

Para a Vercel:

- crie o projeto apontando para a pasta `backend/`
- use `backend/vercel.json`
- configure as variaveis de ambiente do backend no projeto da Vercel

O frontend continua sendo um app separado e aponta para a URL publica do backend.

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

No frontend em producao, `VITE_API_URL` deve apontar para a URL publica do backend, por exemplo `https://trescontas-backend.vercel.app/api`.
No backend em producao, `ALLOWED_ORIGINS` e `FRONTEND_URL` devem receber a URL publica do frontend, por exemplo `https://trescontas.vercel.app`.

## Documentos

Os documentos de clientes ficam em disco por padrao em `backend/storage/client-documents`.
O caminho pode ser alterado com `DOCUMENT_STORAGE_PATH`.

## Migracoes

Para aplicar migracoes em ambiente com banco real:

```bash
npm exec --prefix backend prisma migrate deploy
```
