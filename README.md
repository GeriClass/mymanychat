# 💬 MyManyChat — DMs automáticas no Instagram

App de automação de mensagens do Instagram (estilo ManyChat): responde DMs e
comentários automaticamente usando a **API oficial do Instagram** (Meta).

## Recursos

- ⚡ **DM com palavra-chave** — alguém manda uma DM contendo "link" → o app responde na hora.
- 💬 **Comentário → DM** — alguém comenta "EU QUERO" em um post → o app responde o comentário em público (opcional) e manda o conteúdo por DM.
- 👋 **Boas-vindas** — primeira mensagem de um contato novo → resposta automática de boas-vindas.
- 📥 **Caixa de entrada** — todas as conversas em um só lugar, com envio manual de respostas.
- 📊 **Painel** — contadores de automações, conversas e disparos.

## Stack

- [Next.js 15](https://nextjs.org) (App Router) + TypeScript
- [Prisma](https://prisma.io) + SQLite (troque a `DATABASE_URL` para usar Postgres/MySQL)
- Instagram Platform API (API com Login do Instagram)

## Rodando localmente

```bash
npm install
cp .env.example .env      # preencha as variáveis (veja abaixo)
npm run db:push           # cria o banco SQLite
npm run dev               # http://localhost:3000
```

## Configuração na Meta (obrigatória)

A automação usa a API oficial, então você precisa de:

1. **Conta profissional do Instagram** (Business ou Creator).
2. **App na Meta**: crie em [developers.facebook.com](https://developers.facebook.com)
   (tipo *Empresa*) e adicione o produto **Instagram → API com Login do Instagram**.
3. Copie o **ID do app** e a **Chave secreta** para o `.env`
   (`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`).
4. **URI de redirecionamento OAuth**: `https://SEU_DOMINIO/api/auth/instagram/callback`
5. **Webhook**: URL `https://SEU_DOMINIO/api/webhooks/instagram`, com o token
   de verificação igual ao `WEBHOOK_VERIFY_TOKEN` do `.env`. Assine os campos
   `messages` e `comments`.
6. No app, abra **Configurações** e clique em **Conectar com Instagram**.

> 💡 Em desenvolvimento, a Meta exige HTTPS público para OAuth e webhooks.
> Use um túnel (`ngrok http 3000` ou `cloudflared tunnel`) e coloque a URL
> gerada em `APP_URL` no `.env`.

> ⚠️ Enquanto o app da Meta estiver em **modo de desenvolvimento**, só contas
> listadas como testadoras (Instagram testers) conseguem interagir. Para uso
> público é preciso passar pela revisão do app (App Review) com as permissões
> `instagram_business_manage_messages` e `instagram_business_manage_comments`.

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Conexão do banco (padrão: SQLite local) |
| `APP_URL` | URL pública do app (HTTPS) |
| `INSTAGRAM_APP_ID` | ID do app do Instagram na Meta |
| `INSTAGRAM_APP_SECRET` | Chave secreta do app (também valida a assinatura dos webhooks) |
| `WEBHOOK_VERIFY_TOKEN` | Valor que você inventa e repete no painel da Meta |

## Como funciona

```
Instagram (Meta) ──webhook──▶ /api/webhooks/instagram
                                    │
                              motor de automações
                              (palavra-chave, boas-vindas,
                               comentário → DM)
                                    │
                     Graph API ◀── envia DM / responde comentário
```

- O webhook valida a assinatura `X-Hub-Signature-256` com a chave secreta do app.
- Eventos são deduplicados pelo `mid` da mensagem (a Meta reenvia eventos sem resposta 200).
- Dispara **uma automação por mensagem** (a mais antiga que casar), para evitar spam.
- O token de acesso é de longa duração (60 dias) — reconecte em Configurações para renovar.

## Estrutura

```
src/
  app/
    page.tsx                     # Painel
    automacoes/page.tsx          # CRUD de automações
    inbox/page.tsx               # Caixa de entrada
    configuracoes/page.tsx       # Conexão da conta + guia de setup
    api/
      auth/instagram/            # OAuth (login + callback)
      webhooks/instagram/        # Recebe eventos da Meta
      automations/               # CRUD de automações
      conversations/             # Conversas + envio manual
      account/                   # Conta conectada
  lib/
    instagram.ts                 # Cliente da Graph API
    automation-engine.ts         # Regras de disparo
    db.ts, config.ts
prisma/schema.prisma             # Modelos (conta, automação, conversa, mensagem)
```
