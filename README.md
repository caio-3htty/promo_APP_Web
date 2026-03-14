# Promo App Web

Aplicacao web principal do Prumo (Vite + React + Supabase).

## Stack
- Vite + React + TypeScript
- shadcn/ui + Tailwind
- React Query + React Router
- Supabase Auth + RLS/RBAC

## Requisitos
- Node.js 20+
- npm 10+

## Rodar local
```bash
npm install
cp .env.example .env
npm run dev
```

## Variaveis de ambiente
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Build e testes
```bash
npm run build
npm run test
```

## Deploy (Vercel)
Este repositorio inclui workflow de deploy para Vercel.

Secrets necessarios no GitHub:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Fluxo:
- Push em `main`: deploy de producao.
- Pull Request: build de validacao (sem deploy automatico).

## Rotas principais
- `/obras`
- `/dashboard/:obraId`
- `/dashboard/:obraId/pedidos`
- `/dashboard/:obraId/recebimento`
- `/dashboard/:obraId/estoque`
- `/cadastros/fornecedores`
- `/cadastros/materiais`
- `/cadastros/material-fornecedor`
- `/usuarios-acessos`

