# Backend

API Express + Prisma do TresContas.

## Comandos

```bash
npm run dev
npm run build
npm run typecheck
npm run test
npm run generate:prisma
```

## Ambiente

Crie `backend/.env` a partir de `backend/.env.example`.

Variaveis usadas:

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

## Banco

Antes de rodar em ambiente com banco real, aplique as migracoes:

```bash
npm exec prisma migrate deploy
```

Se quiser apenas validar o schema localmente:

```bash
npm run generate:prisma
```

## Frontend integrado

Se o build do frontend estiver em `../frontend/dist`, o backend o serve na mesma origem.
No deploy unico da Vercel, a API fica em `api/` e o frontend fica em `frontend/dist`.
