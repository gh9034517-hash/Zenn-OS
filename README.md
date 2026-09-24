# ZENN OS

Sistema interno da **Zenn Works** — Prospecção, CRM, Projetos e Financeiro em uma única aplicação.

React · TypeScript · Vite · Tailwind CSS 4 · Recharts · Lucide React

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de produção
```

Na primeira execução o sistema carrega **dados DEMO** (40 leads, 10 clientes, 8 projetos,
30 tarefas, 30 transações). Todos são fictícios e aparecem marcados como DEMO na interface.
Eles podem ser removidos ou recarregados em **Configurações → Dados**.

## Integrações

Copie `.env.example` para `.env.local` e preencha. Sem as variáveis, cada integração roda em **DEMO MODE**.

| Integração | Variáveis | Sem configuração |
|---|---|---|
| Google Places API (New) | `GOOGLE_MAPS_API_KEY` | Busca gera resultados fictícios com o selo "DEMO MODE" |
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_DATA_PROVIDER=supabase` | Dados no `localStorage` |
| Meta Graph API | `META_ACCESS_TOKEN`, `META_APP_ID`, `META_GRAPH_VERSION` | O enriquecimento de lead retorna dados DEMO |

- **Google Places:** restrinja a chave por HTTP referrer e habilite só a "Places API (New)".
- **Supabase:** rode `supabase/schema.sql` no SQL Editor. O login passa a usar o Supabase Auth.
- **Meta:** usa apenas endpoints oficiais da Graph API, sem scraping. Consultar páginas públicas exige o recurso *Page Public Metadata Access*.

> As variáveis com esses prefixos vão para o bundle do front-end. Use só chaves públicas ou restringíveis.
> Nunca use a `service_role` do Supabase.

## Mascote — Zennzinho

As artes oficiais ficam em `public/brand/`:
- `zennzinho-mark.webp`: personagem com o Z e a órbita
- `zennzinho-head.webp`: avatar
- `zennzinho-desk.webp`: cena de trabalho, usada no onboarding
- `zenn-logo-full.webp` e `zenn-banner.webp`: logos

O componente `src/components/brand/Mascot.tsx` escolhe a variante pelo tamanho.

## Estrutura

```
src/
  components/   ui/ (design system) · layout/ · brand/ · charts/ · leads/ · forms/
  context/      DataContext (estado + ações sincronizadas) · SessionContext
  data/         constantes, navegação e gerador de dados demo
  hooks/        useMetrics, useLeadWorkflow, useLocalStorage…
  layouts/      AppLayout (sidebar recolhível, topbar e menu mobile)
  lib/          env, client Supabase
  pages/        Dashboard, FindLeads, Leads, Clients, ClientDetail, Projects,
                ProjectDetail, Tasks, Finance, Analytics, Settings, Welcome, Login
  services/     database.ts (camada de persistência), supabaseProvider.ts,
                googlePlaces.ts, meta.ts
  types/        modelos de domínio
  utils/        formatação, CSV, métricas
supabase/schema.sql
```

### Persistência

`src/services/database.ts` expõe `getLeads / createLead / updateLead / deleteLead`, `getClients / createClient / updateClient`,
`getProjects / createProject / updateProject`, `getTasks / createTask / updateTask`, `getTransactions / createTransaction` e outras.
Todas passam por um `DataProvider`: hoje `localProvider` (localStorage) ou `supabaseProvider`. Trocar de provider não altera nenhuma página.
