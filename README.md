# ZENN OS

Sistema interno da **Zenn Works** — Prospecção, CRM, Projetos e Financeiro em uma única aplicação —
e, em **espaços separados**, a administração do trabalho (empresa) e das finanças pessoais.

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

## Espaços (Pessoal, Trabalho…)

No topo do menu ficam **Visão geral**, **Zenn Works** e os espaços (por padrão *Pessoal* e *Trabalho*;
dá para renomear e criar outros em Configurações → Espaços). Cada espaço tem dinheiro próprio, nada se mistura:

- **Resumo**: receitas, despesas, lucro (ou "sobra", no pessoal), saldo e o que vence nos próximos 7 dias
- **Movimentações**: lançamentos dia a dia, com filtros, parcelas e planilha (CSV para o Excel)
- **Contas a pagar / receber**: atrasadas, hoje, próximos 7 dias; um toque em "Paguei"
- **Contas fixas**: aluguel, luz, salários… lançadas sozinhas todo mês como "a pagar"
- **Carteiras**: banco, caixa, cartão, com o saldo de cada uma e transferência entre elas
- **Orçamento e metas**: limite de gasto por categoria e dinheiro guardado para objetivos
- **Relatório**: lucro por categoria, mês ou ano, comparação com o período anterior, PDF
- **Lembretes**
- **Meu pagamento**: vira despesa no Trabalho e entrada no Pessoal de uma vez
- **Quadro de serviços** (espaços de empresa): mini Trello com Para fechar → Aprovado → Em produção → Entregue,
  checklist por cartão, sinal, pagamento, custos, lucro, material do estoque, orçamento e recibo para imprimir
- **Clientes**: montados a partir dos serviços — quem está para fechar, quem tem serviço em andamento e quem deve,
  com mensagem pronta no WhatsApp
- **Estoque**: chapas, fitas e ferragens com + / −, compra (vira despesa), uso em serviço, contagem, alerta de
  estoque baixo e pedido ao fornecedor pelo WhatsApp
- **Agenda**: entregas, contas e lembretes dia a dia
- **Mandar resumo**: resumo da semana pronto para o WhatsApp de quem é dono do negócio

## Calculadoras

Porcentagem (inclusive preço pela margem real), gastos por dia/semana/mês/ano, orçamento de móvel
(material, mão de obra, custos da oficina, imposto e lucro), frete (km, diesel, desgaste, pedágio, ajudante,
preço por chapa), quantas chapas um projeto usa (com perda e fita de borda), maquininha e parcelado × à vista.
O preço do móvel ou do frete vira um serviço com um toque. Contas em `src/services/calcMath.ts`.

## Personalizar e acessos

- **Personalizar**: nome do sistema, cor de destaque (metálicas), tamanho da letra, página inicial e o que aparece
  no menu. Fica salvo na conta (Supabase `user_metadata.prefs`) e no aparelho.
- **Acessos** (Configurações, só o administrador): a pessoa cria a conta em “Criar conta” e o administrador libera
  um espaço para ela — “ver e lançar” ou “só ver”. É assim que o sistema cresce para mais clientes: um espaço por
  cliente, cada um vendo só o seu. Regras no banco: `space_members`, `can_read_space`, `can_write_space`,
  `grant_space_access` (supabase/schema.sql). O cadastro público do Supabase Auth precisa estar ligado.

O olho no topo oculta todos os valores da tela. O site pode ser instalado no celular (Adicionar à tela inicial).
As tabelas ficam em `supabase/schema.sql` (seção "Espaços") com o mesmo controle de acesso por `app_members`.

## Integrações

Copie `.env.example` para `.env.local` e preencha. Sem as variáveis, cada integração roda em **DEMO MODE**.

| Integração | Variáveis | Sem configuração |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_DATA_PROVIDER=supabase` | Dados no `localStorage` |
| Meta Graph API | `META_ACCESS_TOKEN`, `META_APP_ID`, `META_GRAPH_VERSION` | O enriquecimento de lead retorna dados DEMO |

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
  context/      DataContext (Zenn Works) · SpacesContext (espaços) · SessionContext
  data/         constantes, navegação e gerador de dados demo
  hooks/        useMetrics, useLeadWorkflow, useLocalStorage…
  layouts/      AppLayout (sidebar recolhível, topbar e menu mobile) · SpaceLayout
  lib/          env, client Supabase
  pages/        Dashboard, FindLeads, Leads, Clients, ClientDetail, Projects,
                ProjectDetail, Tasks, Finance, Analytics, Settings, Welcome, Login,
                Overview (visão geral) e space/ (páginas dos espaços)
  services/     database.ts (camada de persistência), supabaseProvider.ts,
                googlePlaces.ts, osmSearch.ts, meta.ts, spaceMath.ts (cálculos dos espaços)
  types/        modelos de domínio
  utils/        formatação, CSV, métricas
supabase/schema.sql
```

### Persistência

`src/services/database.ts` expõe `getLeads / createLead / updateLead / deleteLead`, `getClients / createClient / updateClient`,
`getProjects / createProject / updateProject`, `getTasks / createTask / updateTask`, `getTransactions / createTransaction` e outras.
Todas passam por um `DataProvider`: hoje `localProvider` (localStorage) ou `supabaseProvider`. Trocar de provider não altera nenhuma página.
