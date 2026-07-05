# ⚙️ MyManyChat — Agentes de IA na nuvem com Cloudflare

Uma plataforma de automações com agentes de IA rodando na Cloudflare — a alternativa em código ao Make/n8n. Você conversa com o agente (pelo chat web ou pelo WhatsApp) e ele:

- ⏰ **Agenda tarefas** — uma vez, com atraso ("em 10 minutos") ou recorrentes ("todo dia às 8h", via cron)
- 🌐 **Chama qualquer API ou webhook** — GET/POST/PUT/PATCH/DELETE com headers e body
- 🤖 **Executa as tarefas agendadas com IA** — a tarefa é executada pelo próprio agente com acesso às ferramentas, então "todo dia às 8h, busque a cotação do dólar e me avise" funciona de verdade
- 📋 **Mostra o histórico** — painel "Tarefas" na interface com o resultado de cada execução

Construído com o [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) (Durable Objects + SQLite), [Workers AI](https://developers.cloudflare.com/workers-ai/) (sem chave de API externa!) e React.

## Requisitos

- [Node.js](https://nodejs.org) 22 ou superior
- Uma conta gratuita na [Cloudflare](https://dash.cloudflare.com/sign-up) (o plano free inclui Workers, Durable Objects e 10.000 neurons/dia de Workers AI)

## Como rodar

```sh
npm install
npx wrangler login   # abre o navegador para conectar sua conta Cloudflare
npm run dev          # abre http://localhost:5173
```

> O binding de IA usa `"remote": true`: mesmo em desenvolvimento local, a inferência roda na sua conta Cloudflare — por isso o `wrangler login` é necessário.

Experimente no chat:

- "Me lembre em 5 minutos de fazer uma pausa"
- "Faça um GET em https://api.github.com/zen e me mostre o resultado"
- "Todo dia às 8h, busque a cotação do dólar em https://economia.awesomeapi.com.br/last/USD-BRL e me avise"
- "Liste minhas tarefas agendadas" / "Cancele a tarefa X"

## Deploy (publicar na internet)

```sh
npm run deploy
```

Sua URL será algo como `https://mymanychat.<seu-subdominio>.workers.dev`.

> ⚠️ A URL do chat é pública. Para uso pessoal/interno, proteja-a com [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) (grátis para até 50 usuários).

## WhatsApp (opcional)

O agente também atende pelo WhatsApp via [Cloud API da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api). Cada número de telefone ganha sua própria instância de agente, com histórico e tarefas próprios — e o resultado de tarefas agendadas chega como mensagem no WhatsApp.

### 1. Crie o app na Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** (tipo _Business_)
2. Adicione o produto **WhatsApp** ao app
3. Na página **WhatsApp → API Setup**, anote:
   - o **token de acesso temporário** (vale 24h; para produção, crie um token permanente de _System User_ no Business Manager)
   - o **Phone number ID** do número de teste

### 2. Configure os segredos

Escolha também uma senha qualquer para o `WHATSAPP_VERIFY_TOKEN` (você vai digitá-la no painel da Meta no passo 3).

Em produção:

```sh
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
npm run deploy
```

Para desenvolvimento local, copie `.dev.vars.example` para `.dev.vars` e preencha os valores.

### 3. Configure o webhook na Meta

Na página **WhatsApp → Configuration** do seu app:

- **Callback URL**: `https://mymanychat.<seu-subdominio>.workers.dev/webhooks/whatsapp`
- **Verify token**: o mesmo valor que você colocou em `WHATSAPP_VERIFY_TOKEN`
- Clique em **Verify and save**
- Em **Webhook fields**, assine o campo **`messages`**

### 4. Teste

Adicione seu celular como número de destinatário de teste (página API Setup), envie um "olá" para o número de teste e acompanhe os logs com:

```sh
npx wrangler tail
```

### Limitações conhecidas (v1)

- Só mensagens de **texto** são tratadas (mídia e áudio são ignorados)
- **Janela de 24h da Meta**: o bot pode responder livremente por 24h após a última mensagem do usuário. Notificações de tarefas agendadas fora dessa janela exigem _message templates_ aprovados (não implementado)
- A assinatura `X-Hub-Signature-256` do webhook não é verificada (hardening futuro); o handshake com verify token está implementado

## Estrutura do projeto

```
src/
├── server.ts    # ChatAgent (Durable Object): chat, WhatsApp e execução de tarefas
├── tools.ts     # Ferramentas de automação: agendar/listar/cancelar + httpRequest
├── prompts.ts   # System prompt em pt-BR
├── whatsapp.ts  # Parse do webhook e envio via Graph API
├── app.tsx      # Interface do chat (React + kumo)
└── client.tsx   # Entry point do frontend
wrangler.jsonc   # Bindings: AI, Durable Object (SQLite), assets
```

## Comandos úteis

| Comando             | O que faz                                                |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento (localhost:5173)             |
| `npm run deploy`    | Build + deploy para a Cloudflare                         |
| `npm run check`     | Formatação, lint e typecheck                             |
| `npm run types`     | Regenera `env.d.ts` a partir do wrangler.jsonc/.dev.vars |
| `npx wrangler tail` | Logs em tempo real do worker em produção                 |

## Como funciona

- Cada conversa vive em um **Durable Object** (classe `ChatAgent`) com banco **SQLite embutido** — estado e histórico sobrevivem a reinícios sem precisar de banco externo.
- Agendamentos usam `this.schedule()` do Agents SDK (alarmes de Durable Object): **cron roda em UTC**, e o prompt instrui o modelo a converter usando o fuso do usuário.
- Quando uma tarefa dispara, `executeTask` roda o LLM (`@cf/moonshotai/kimi-k2.6` no Workers AI) com as mesmas ferramentas do chat, grava o resultado no estado e notifica a interface (e o WhatsApp, se for o canal).
- O modelo pode ser trocado na constante `MODEL` em `src/server.ts`.

---

Baseado no template oficial [cloudflare/agents-starter](https://github.com/cloudflare/agents-starter) (MIT).
