# TresContas

SaaS de contabilidade com portal de clientes, dashboards internos, suporte, plano de contas, DRE e DFC.

## Estrutura

- `frontend/`: React + Vite.
- `backend/`: API Express + Prisma.

## Deploy unificado na Vercel

O frontend sobe como site estatico e o backend sobe como funcoes `api/` no mesmo deploy.

Fluxo recomendado:

```bash
npm run build
```

Na Vercel, o `vercel.json` da raiz faz o build do `frontend` e do `backend`, e o projeto usa:

- `frontend/dist` para os arquivos estaticos
- `api/[...path].ts` para a API Express

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

No deploy unico da Vercel, `VITE_API_URL` pode ficar vazio e o app usa `/api`.
Nesse mesmo deploy, `ALLOWED_ORIGINS` e `FRONTEND_URL` devem receber a URL publica exata do projeto, por exemplo `https://trescontas.vercel.app`.

## Documentos

Os documentos de clientes ficam em disco por padrao em `backend/storage/client-documents`.
O caminho pode ser alterado com `DOCUMENT_STORAGE_PATH`.

## Migracoes

Para aplicar migracoes em ambiente com banco real:

```bash
npm exec --prefix backend prisma migrate deploy
```
