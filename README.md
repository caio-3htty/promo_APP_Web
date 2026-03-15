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
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Build e testes
```bash
npm run lint
npm run test
npm run build
npm run bundle:report
npm run bundle:check
```

## Code Hygiene
```bash
npm run cleanup:analyze
npm run cleanup:verify
```

## Performance Budget
- Baseline inicial: `docs/performance/bundle-baseline.json`
- Orcamento vigente: `docs/performance/bundle-budget.json`
- Relatorio do build: `dist/bundle-report.json` e `dist/bundle-report.txt`

No CI, o workflow `web-ci` falha quando o budget e excedido.

Atualizacao de base do browserslist:
```bash
npm run browserslist:update
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

## Checklist de release web
1. `npm run lint`, `npm run test`, `npm run build` e `npm run bundle:check` verdes.
2. Sem warnings criticos no build.
3. Rotas principais carregando e rotas lazy funcionando sem regressao de guardas.
4. Variaveis de ambiente validadas no provedor de deploy.
5. Rollback pronto via redeploy da ultima release estavel.

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

