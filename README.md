# TresContas

SaaS de contabilidade com portal de clientes, dashboards internos, suporte, plano de contas, DRE e DFC gerencial.

## Estrutura

- `frontend/`: aplicação React + Vite.
- `backend/`: API Express + Prisma.

## Comandos

Na raiz do repositório:

```bash
npm run install:all
npm run lint
npm run test
npm run build
```

Para desenvolvimento:

```bash
npm run dev:frontend
npm run dev:backend
```

## Variáveis de ambiente

- `backend/.env.example`
- `frontend/.env.example`

## Armazenamento de documentos

Os arquivos de clientes ficam em disco por padrão em `backend/storage/client-documents`.
O caminho pode ser alterado com `DOCUMENT_STORAGE_PATH`.
Para migrar documentos antigos do banco para o disco, use:

```bash
npm run migrate:client-documents
```
