# Acolhe Web

Portal web do **Acolhe**, plataforma de socorro e acompanhamento de pessoas idosas ou com deficiência.
Aqui a **família/rede de cuidadores** e os **médicos** acompanham alertas, remédios, rotina, receitas e consultas.

> O app mobile (pessoa cuidada e cuidadores) fica no repositório `acolhe-app`.

## Tecnologias

- React 19 + TypeScript + Vite
- React Router (rotas e áreas protegidas por perfil)
- TanStack React Query (busca e cache de dados)
- CSS Modules (estilo por componente) + variáveis CSS geradas a partir do tema
- lucide-react (ícones)

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:5173.

Contas de demonstração (senha `12345678`), também disponíveis com um clique na tela de login:

| Perfil | E-mail |
| --- | --- |
| Familiar (Ana, filha da Dona Maria) | `ana@exemplo.com` |
| Médico (Dr. Paulo Mendes) | `paulo@exemplo.com` |

Outros comandos: `npm run build` (gera a versão de produção) e `npm run typecheck`.

## Estrutura de pastas

```
src/
├── theme/          # Cores (colors.ts), tokens e CSS global
├── types/          # Modelos de dados (Patient, Caregiver, EmergencyAlert...)
├── services/       # Camada de dados: uma função por chamada de API
├── mocks/          # Dados simulados usados enquanto não há backend
├── hooks/          # Hooks do React Query (usePatients, useCaregivers, useCare...)
├── contexts/       # AuthContext (login/sessão)
├── routes/         # Rotas, caminhos e proteção por perfil
├── components/
│   ├── ui/         # Componentes genéricos (Button, Card, Modal, Tabs...)
│   ├── domain/     # Componentes do Acolhe (Timeline, AlertsTable, CaregiverFormModal...)
│   └── layout/     # Layout do portal (menu lateral + topo) e grades
├── pages/
│   ├── auth/       # Login
│   ├── family/     # Painel, Alertas, Rotina, Receitas, Rede de cuidadores
│   ├── doctor/     # Pacientes, Perfil do paciente, Nova receita, Agenda, Relatórios
│   └── shared/     # Configurações, 404
└── utils/          # Datas, CSV, armazenamento local

server/             # Back-end do portal (Hono + Prisma)
├── routes/         # Rotas da API (/api/...), um arquivo por assunto
├── db.ts           # Conexão com o PostgreSQL
└── dev.ts          # Servidor local (npm run dev:api)
api/index.ts        # Entrada da API no Vercel (usa server/routes/index.ts)
prisma/
├── schema.prisma   # Estrutura do banco, compartilhada com o back-end do app mobile
├── migrations/     # Histórico de mudanças nas tabelas
└── seed.ts         # Dados de demonstração
```

## Cores e tema

Todas as cores ficam em **`src/theme/colors.ts`**. Ao iniciar, `applyTheme()` transforma cada cor em uma
variável CSS (`colors.primarySoft` → `var(--color-primary-soft)`), usada pelos arquivos `.module.css`.
Para mudar uma cor no portal inteiro, mude só esse arquivo.

## Back-end e banco de dados

O back-end do portal fica neste repositório (`server/`) e, no Vercel, sai no mesmo deploy do site, em `/api`.
O banco é um PostgreSQL no **Prisma Postgres** (nuvem), **compartilhado com o back-end do app mobile**
(`acolhe-app`), que é um projeto separado.

### Rodar localmente

```bash
npm install            # também gera o cliente do Prisma
cp .env.example .env   # e coloque a DATABASE_URL do banco do Acolhe
npm run dev            # sobe a API (porta 3334) e o site (5173) juntos
```

Num banco novo (vazio), antes do primeiro `npm run dev`:

```bash
npm run db:deploy      # cria as tabelas (aplica as migrações)
npm run db:seed        # dados de demonstração
```

**Cuidado:** o banco é o mesmo para todo mundo (site, app e produção). `npm run db:seed` e `npm run db:reset`
**apagam todos os dados**, inclusive os de quem estiver testando o app. Combine antes de rodar.

Teste: http://localhost:5173/api/health deve responder `{"ok":true,"database":true}`.
Para ver e editar os dados numa interface: `npm run db:studio`.
Para subir só um dos dois: `npm run dev:site` ou `npm run dev:api`.

Para o site usar o banco, coloque `VITE_USE_MOCKS=false` no `.env` e reinicie o `npm run dev`.
Com `true` (padrão), ele usa os dados simulados de `src/mocks` e não precisa de banco nem de API.
A exceção é a **Disponibilidade** de remédios (Receitas → Disponibilidade): ela sempre usa a API
(`GET /api/medications/availability`), que consulta o estoque real do SUS na
[API de Dados Abertos do Ministério da Saúde](https://apidadosabertos.saude.gov.br). Por isso precisa da API rodando (o `npm run dev` já sobe).
Na cidade de São Paulo o estoque não vem por UBS, então o site mostra o link do Remédio na Hora, da prefeitura.
A busca usa o código CATMAT de cada remédio, que vem do catálogo em `src/data/susCatalog.ts` (cerca de 375 remédios
distribuídos pelo SUS). Ao criar a receita, o médico vê sugestões do catálogo e um aviso quando a dose não existe no SUS.
Para atualizar o catálogo: `npm run catalog:update`.
Cada função de `src/services` chama uma rota de `server/routes/`, e as respostas seguem os tipos de `src/types`.
O login devolve um token JWT, enviado como `Authorization: Bearer <token>` (veja `src/services/http.ts`).
Cada pessoa só vê as pessoas cuidadas a que está ligada: o médico, os pacientes dele; a família, quem ela cuida.
As rotas `/alerts/:id` são públicas, para a página aberta pelo link do WhatsApp/SMS funcionar sem login.

### Banco compartilhado com o app mobile

- **Só este repositório cria e altera tabelas.** Mudanças na estrutura são combinadas entre as duas equipes
  e feitas em `prisma/schema.prisma` + `npm run db:migrate -- --name descricao-da-mudanca`, que já aplica no banco.
- O back-end do app copia `prisma/schema.prisma` e roda só `prisma generate` (nunca `migrate`).
  Se não usar Prisma, os nomes de tabelas e colunas estão em snake_case no banco (veja `@@map` / `@map`).
- Perfis em `users.role`: `pessoa` (pessoa cuidada), `cuidador` (aparece como "familiar" no portal) e `medico`.
- Senhas: hash **bcrypt** (custo 10) em `users.password_hash`, nos dois back-ends.
- Os dados de demonstração usam os mesmos ids dos mocks dos dois apps (`u-ana`, `u-maria`, `p-maria`, `c-ana`...).
- **Receita vira rotina:** ao assinar uma receita, cada item vira um remédio em `medications`, com `times` (horários),
  `starts_at`, `ends_at` (vazio = uso contínuo) e `prescription_id`.
- **Doses são criadas sob demanda** (veja `server/doses.ts`). O back-end do app deve seguir a mesma regra ao listar
  as doses do dia:
  1. para cada remédio, criar as doses que faltam dos últimos 30 dias até o fim de hoje: uma por horário de `times`,
     no fuso de São Paulo, só entre `starts_at` e `ends_at`;
  2. não recriar a dose que foi adiada (a que tem `original_scheduled_at` naquele horário);
  3. dose `pendente` ou `adiado` que passou do horário mais `medication_rules.tolerance_minutes` (padrão 30) vira `atrasado`.

  A regra única `(medication_id, scheduled_at)` impede doses duplicadas quando os dois back-ends criam ao mesmo tempo
  (use "ignorar duplicadas" ao inserir, como `createMany({ skipDuplicates: true })`).

### Deploy no Vercel

O `vercel.json` já manda `/api/*` para a função `api/index.ts` e as demais rotas para o `index.html` (React Router).
Para o site no ar usar o banco:

1. Em **Settings → Environment Variables** do projeto no Vercel, adicionar:
   - `DATABASE_URL`: a mesma URL do Prisma Postgres usada no `.env`;
   - `JWT_SECRET`: um segredo novo (gere com `openssl rand -base64 32`);
   - `VITE_USE_MOCKS=false`.
2. O script `vercel-build` do `package.json` aplica as migrações novas (`prisma migrate deploy`) a cada deploy.
   Por isso a `DATABASE_URL` precisa estar configurada antes, senão o build falha.
3. Fazer um novo deploy (as variáveis `VITE_*` só valem depois de um build novo).

### Pontos a evoluir

- **Alertas em tempo real:** hoje `useActiveAlert` consulta a cada 15 s. Funções serverless não mantêm
  WebSocket aberto; para tempo real, usar um serviço como Pusher/Ably.
- **Escalar o alerta** (avisar o próximo da fila depois de X minutos): precisa de um agendador externo
  (ex.: Upstash QStash), pois a função termina ao responder.
- **Assinatura digital de receitas:** hoje é simulada. Na prática, usar um provedor ICP-Brasil.
