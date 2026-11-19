# Acolhe — Portal web

**Acolhe** aproxima a pessoa idosa ou dependente da sua rede de apoio: um toque para pedir ajuda e uma rotina de
cuidados compartilhada entre família, cuidadores e profissionais de saúde.

Este repositório é o **portal web** (familiares/cuidadores e profissionais de saúde) e a **API** usada pelo portal e
pelo app. O app mobile fica em [acolhe-app](https://github.com/web-design-on/acolhe-app).

| | |
| --- | --- |
| **Portal web (deploy)** | https://acolhe-web-tau.vercel.app |
| **App mobile** | [github.com/web-design-on/acolhe-app](https://github.com/web-design-on/acolhe-app) — veja "Como executar o app" no README dele |
| **Portal web + API** | [github.com/web-design-on/acolhe-web](https://github.com/web-design-on/acolhe-web) |

## Integrantes

| Nome | GitHub |
| --- | --- |
| Natali Schers | [@natali-schers](https://github.com/natali-schers) |
| Rebeca Luiza Soares Cerqueira | [@Rebeca-Soares](https://github.com/Rebeca-Soares) |
| Sarah Raquel Soares Maranhão | [@smaranha](https://github.com/smaranha) |

## O problema

Quando uma pessoa idosa ou dependente precisa de ajuda, acionar a rede de apoio pode depender de ações que se tornam
difíceis justamente no momento em que ela está fragilizada, confusa ou machucada. Para familiares e cuidadores, o
desafio é saber quem está disponível, evitar deslocamentos desnecessários, acompanhar a rotina de cuidados e manter
todos informados.

A ideia surgiu de duas experiências pessoais do grupo: uma senhora que mora sozinha passou mal de madrugada e, ainda
confusa no hospital, acreditava ter pedido ajuda a vários familiares, mas só tinha conseguido fazer uma ligação, que
não foi atendida; e a dificuldade de encontrar medicamentos que nem sempre estão disponíveis, obrigando a ligar ou
visitar vários estabelecimentos.

**Públicos:**

- **Pessoa cuidada:** pede ajuda em emergências e acompanha lembretes, consultas e orientações.
- **Familiar ou cuidador:** recebe e responde aos alertas e acompanha a rotina de cuidados.
- **Profissional de saúde:** acompanha pacientes, registra prescrições e consulta o histórico de cuidados.

## A solução

O Acolhe combina um **app mobile** para a pessoa assistida e sua rede de apoio com um **portal web** para
acompanhamento e gestão do cuidado. No celular ficam as ações rápidas e acessíveis (emergência e dia a dia); na web,
as informações e tarefas que pedem uma tela maior e uma visão geral do histórico.

**App mobile** ([acolhe-app](https://github.com/web-design-on/acolhe-app))

- **Pedido de ajuda:** ao tocar em "Preciso de ajuda", no app ou pelo **widget** na tela inicial do celular, começa
  uma contagem de 5 segundos que pode ser cancelada. Depois o pedido é enviado e o andamento pode ser acompanhado.
  Há também um atalho para ligar para o **SAMU (192)**; o app não substitui o serviço de emergência.
- **Resposta ao alerta:** o familiar/cuidador vê o alerta, assume ou recusa o atendimento, liga para a pessoa,
  abre o endereço no mapa e registra a chegada.
- **Canais:** cada familiar/cuidador escolhe receber alertas pelo app, pelo WhatsApp ou pelos dois. Contatos
  secundários opcionais (vizinhos, pessoas de confiança) recebem só o alerta, por SMS ou WhatsApp, sem acesso a
  dados de saúde. Sem internet, o alerta sai por SMS.
- **Dia a dia:** doses do dia (confirmar ou adiar, ouvir as orientações em voz alta), receitas, consultas, rotina e
  rede de apoio.

**Portal web** (este repositório)

- **Família/cuidadores:** alertas, rotina, medicamentos, consultas e rede de apoio, sem depender do celular.
- **Profissional de saúde:** pacientes, prescrições e histórico de cuidados.
- **Disponibilidade nas UBSs:** onde encontrar o medicamento na rede pública (estoque, endereço, telefone e mapa),
  com dados da BNAFAR, do Ministério da Saúde.

## Como a integração funciona

```
 App mobile (Expo)                Portal web (React)
 pessoa cuidada / cuidador        família / médico
          │                               │
          └──── HTTPS + token JWT ────────┘
                         │
              API /api  (Hono, na Vercel)   ──▶  Dados Abertos do Ministério da Saúde
                         │                       (estoque de medicamentos nas UBSs)
              PostgreSQL (Prisma Postgres)
```

- **Uma API para os dois.** A API fica no repositório `acolhe-web` (pasta `server/`) e é publicada junto com o
  portal, em `https://acolhe-web-tau.vercel.app/api`. App e portal só falam com essa API; nenhum acessa o banco
  diretamente.
- **Mesmas contas.** O login devolve um token JWT, enviado em cada chamada (`Authorization: Bearer <token>`).
  Perfis: `pessoa` e `cuidador` usam o app; `cuidador` (como "familiar") e `medico` usam o portal. Cada pessoa só vê
  as pessoas cuidadas a que está ligada.
- **Mesmos modelos de dados.** Os tipos em `src/types` são iguais nos dois repositórios, assim como as cores do tema.
- **Alerta de SOS, ponta a ponta:**
  1. a pessoa cuidada toca em "Preciso de ajuda" (app ou widget) → `POST /api/patients/:id/alerts`;
  2. a API cria o alerta com um destinatário por cuidador e o canal de cada um (app, WhatsApp ou SMS; sem internet, SMS);
  3. o app do cuidador e o portal consultam o alerta ativo periodicamente e mostram o pedido;
  4. quem assume, recusa ou chega atualiza o alerta, e todos (inclusive a pessoa cuidada) veem o andamento.
     O link enviado por WhatsApp/SMS abre uma página pública do alerta no portal, sem login.
- **Receita vira rotina:** o médico assina a receita no portal, cada item vira um medicamento com horários, e as
  doses aparecem no app da pessoa cuidada. As confirmações e adiamentos feitos no app aparecem no portal.

## Como executar o portal

O portal está no ar em **https://acolhe-web-tau.vercel.app**. Para rodar localmente:

**Pré-requisitos:** Node.js 20+.

```bash
git clone https://github.com/web-design-on/acolhe-web.git
cd acolhe-web
npm install
cp .env.example .env
npm run dev
```

Abra http://localhost:5173.

Por padrão (`VITE_USE_MOCKS=true`) o site usa os dados simulados de `src/mocks` e não precisa de banco. Para usar a API
e o banco, veja [Back-end e banco de dados](#back-end-e-banco-de-dados).

Contas de demonstração (senha `12345678`), também disponíveis com um clique na tela de login:

| Perfil | E-mail |
| --- | --- |
| Familiar (Ana, filha da Dona Maria) | `ana@exemplo.com` |
| Médico (Dr. Paulo Mendes) | `paulo@exemplo.com` |

Outros comandos: `npm run build` (gera a versão de produção) e `npm run typecheck`.

## Tecnologias

- React 19 + TypeScript + Vite
- React Router (rotas e áreas protegidas por perfil)
- TanStack React Query (busca e cache de dados)
- CSS Modules (estilo por componente) + variáveis CSS geradas a partir do tema
- lucide-react (ícones)
- API: Hono + Prisma + PostgreSQL (Prisma Postgres), publicada como função da Vercel

## Estrutura de pastas

```
src/
├── theme/          # Cores (colors.ts), tokens e CSS global
├── types/          # Modelos de dados (os mesmos do acolhe-app)
├── services/       # Camada de dados: uma função por chamada de API
├── mocks/          # Dados simulados
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

server/             # API do Acolhe (Hono + Prisma), usada pelo portal e pelo app
├── routes/         # Rotas da API (/api/...), um arquivo por assunto
├── db.ts           # Conexão com o PostgreSQL
└── dev.ts          # Servidor local (npm run dev:api)
api/index.ts        # Entrada da API na Vercel (usa server/routes/index.ts)
prisma/
├── schema.prisma   # Estrutura do banco
├── migrations/     # Histórico de mudanças nas tabelas
└── seed.ts         # Dados de demonstração
```

## Cores e tema

Todas as cores ficam em **`src/theme/colors.ts`** (com os mesmos valores do app). Ao iniciar, `applyTheme()`
transforma cada cor em uma variável CSS (`colors.primarySoft` → `var(--color-primary-soft)`), usada pelos arquivos
`.module.css`. Para mudar uma cor no portal inteiro, mude só esse arquivo.

## Back-end e banco de dados

A API fica neste repositório (`server/`) e, na Vercel, sai no mesmo deploy do site, em `/api`. É a mesma API usada
pelo app mobile. O banco é um PostgreSQL no **Prisma Postgres** (nuvem).

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
Para o app rodando no navegador (`expo start --web`) chamar a API local, a origem dele precisa estar em `CORS_ORIGINS`.

### Disponibilidade nas UBSs

A **Disponibilidade** de remédios (Receitas → Disponibilidade) sempre usa a API
(`GET /api/medications/availability`), mesmo com `VITE_USE_MOCKS=true`. Ela consulta o estoque real do SUS (BNAFAR) na
[API de Dados Abertos do Ministério da Saúde](https://apidadosabertos.saude.gov.br), por isso precisa da API rodando
(o `npm run dev` já sobe). Na cidade de São Paulo o estoque não vem por UBS, então o site mostra o link do Remédio na
Hora, da prefeitura.

A busca usa o código CATMAT de cada remédio, que vem do catálogo em `src/data/susCatalog.ts` (cerca de 375 remédios
distribuídos pelo SUS). Ao criar a receita, o médico vê sugestões do catálogo e um aviso quando a dose não existe no SUS.
Para atualizar o catálogo: `npm run catalog:update`.

### Detalhes da API

- Cada função de `src/services` chama uma rota de `server/routes/`, e as respostas seguem os tipos de `src/types`.
- O login devolve um token JWT, enviado como `Authorization: Bearer <token>` (veja `src/services/http.ts`).
- Cada pessoa só vê as pessoas cuidadas a que está ligada: o médico, os pacientes dele; a família, quem ela cuida.
- As rotas `/alerts/:id` são públicas, para a página aberta pelo link do WhatsApp/SMS funcionar sem login.
- Perfis em `users.role`: `pessoa` (pessoa cuidada), `cuidador` (aparece como "familiar" no portal) e `medico`.
- Senhas: hash **bcrypt** (custo 10) em `users.password_hash`.
- Os dados de demonstração usam os mesmos ids dos mocks dos dois apps (`u-ana`, `u-maria`, `p-maria`, `c-ana`...).
- **Receita vira rotina:** ao assinar uma receita, cada item vira um remédio em `medications`, com `times` (horários),
  `starts_at`, `ends_at` (vazio = uso contínuo) e `prescription_id`.
- **Doses são criadas sob demanda** (veja `server/doses.ts`), ao listar as doses do dia:
  1. para cada remédio, cria as doses que faltam dos últimos 30 dias até o fim de hoje: uma por horário de `times`,
     no fuso de São Paulo, só entre `starts_at` e `ends_at`;
  2. não recria a dose que foi adiada (a que tem `original_scheduled_at` naquele horário);
  3. dose `pendente` ou `adiado` que passou do horário mais `medication_rules.tolerance_minutes` (padrão 30) vira `atrasado`.

  A regra única `(medication_id, scheduled_at)` impede doses duplicadas quando duas chamadas criam ao mesmo tempo.
- **Mudanças no banco** são feitas em `prisma/schema.prisma` + `npm run db:migrate -- --name descricao-da-mudanca`,
  que já aplica no banco. Se mudar algum tipo, atualize também `src/types` no `acolhe-app`.

### Deploy na Vercel

O `vercel.json` já manda `/api/*` para a função `api/index.ts` e as demais rotas para o `index.html` (React Router).
Para o site no ar usar o banco:

1. Em **Settings → Environment Variables** do projeto na Vercel, adicionar:
   - `DATABASE_URL`: a mesma URL do Prisma Postgres usada no `.env`;
   - `JWT_SECRET`: um segredo novo (gere com `openssl rand -base64 32`);
   - `VITE_USE_MOCKS=false`.
2. O script `vercel-build` do `package.json` aplica as migrações novas (`prisma migrate deploy`) a cada deploy.
   Por isso a `DATABASE_URL` precisa estar configurada antes, senão o build falha.
3. Fazer um novo deploy (as variáveis `VITE_*` só valem depois de um build novo).
