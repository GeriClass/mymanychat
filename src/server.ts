import { createWorkersAI } from "workers-ai-provider";
import {
  callable,
  getAgentByName,
  routeAgentRequest,
  type Schedule
} from "agents";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  generateText,
  pruneMessages,
  stepCountIs,
  streamText
} from "ai";
import { buildSystemPrompt } from "./prompts";
import { clientTools, createAutomationTools } from "./tools";
import { parseWhatsAppWebhook, sendWhatsAppText } from "./whatsapp";

// Modelo aberto no Workers AI com bom suporte a tool-calling.
// Alternativa: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
const MODEL = "@cf/moonshotai/kimi-k2.6";

export type TaskLogEntry = {
  description: string;
  result: string;
  at: string;
};

export type AgentState = {
  channel: "web" | "whatsapp";
  whatsappPhone?: string;
  taskLog: TaskLogEntry[];
};

export class ChatAgent extends AIChatAgent<Env, AgentState> {
  initialState: AgentState = { channel: "web", taskLog: [] };
  maxPersistedMessages = 100;
  chatRecovery = true;

  onStart() {
    // Configure OAuth popup behavior for MCP servers that require authentication
    this.mcp.configureOAuthCallback({
      customHandler: (result) => {
        if (result.authSuccess) {
          return new Response("<script>window.close();</script>", {
            headers: { "content-type": "text/html" },
            status: 200
          });
        }
        return new Response(
          `Authentication Failed: ${result.authError || "Unknown error"}`,
          { headers: { "content-type": "text/plain" }, status: 400 }
        );
      }
    });
  }

  @callable()
  async addServer(name: string, url: string) {
    return await this.addMcpServer(name, url);
  }

  @callable()
  async removeServer(serverId: string) {
    await this.removeMcpServer(serverId);
  }

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const mcpTools = this.mcp.getAITools();
    const workersai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: workersai(MODEL, {
        sessionAffinity: this.sessionAffinity
      }),
      system: buildSystemPrompt(),
      // Prune old tool calls to save tokens on long conversations
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages"
      }),
      tools: {
        ...mcpTools,
        ...createAutomationTools(this),
        ...clientTools
      },
      stopWhen: stepCountIs(8),
      abortSignal: options?.abortSignal
    });

    return result.toUIMessageStreamResponse();
  }

  /**
   * Executa uma tarefa agendada usando o próprio LLM com as ferramentas de
   * automação — assim "todo dia às 8h, consulte X e me avise" funciona de
   * verdade, e não apenas como lembrete.
   */
  async executeTask(description: string, _task: Schedule<string>) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    let resultText: string;
    try {
      const { text } = await generateText({
        model: workersai(MODEL),
        system: buildSystemPrompt(
          "Você está executando uma tarefa agendada agora. Execute-a usando as ferramentas disponíveis e responda com um resumo curto do resultado."
        ),
        prompt: `Tarefa agendada: ${description}`,
        tools: createAutomationTools(this),
        stopWhen: stepCountIs(8)
      });
      resultText = text || "(tarefa executada sem resposta em texto)";
    } catch (error) {
      resultText = `Erro ao executar a tarefa: ${error}`;
    }

    this.setState({
      ...this.state,
      taskLog: [
        ...this.state.taskLog,
        { description, result: resultText, at: new Date().toISOString() }
      ].slice(-50)
    });

    // Notifica clientes conectados via broadcast em vez de saveMessages()
    // para não injetar a notificação no histórico do chat (evita loops da IA).
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        result: resultText,
        timestamp: new Date().toISOString()
      })
    );

    if (this.state.channel === "whatsapp" && this.state.whatsappPhone) {
      await sendWhatsAppText(
        this.env,
        this.state.whatsappPhone,
        `✅ Tarefa executada: ${description}\n\n${resultText}`
      );
    }
  }

  /**
   * Trata uma mensagem recebida pelo WhatsApp (chamada via RPC pelo worker).
   * Cada número de telefone tem sua própria instância de agente (`wa-{fone}`),
   * com histórico próprio em SQLite e suas próprias tarefas agendadas.
   */
  async onWhatsAppMessage(from: string, text: string) {
    if (
      this.state.channel !== "whatsapp" ||
      this.state.whatsappPhone !== from
    ) {
      this.setState({
        ...this.state,
        channel: "whatsapp",
        whatsappPhone: from
      });
    }

    this
      .sql`CREATE TABLE IF NOT EXISTS wa_history (role TEXT, content TEXT, at INTEGER)`;
    this
      .sql`INSERT INTO wa_history (role, content, at) VALUES ('user', ${text}, ${Date.now()})`;
    const history = this.sql<{ role: "user" | "assistant"; content: string }>`
      SELECT role, content FROM
        (SELECT * FROM wa_history ORDER BY at DESC LIMIT 20)
      ORDER BY at ASC
    `;

    const workersai = createWorkersAI({ binding: this.env.AI });
    let reply: string;
    try {
      const { text: generated } = await generateText({
        model: workersai(MODEL),
        system: buildSystemPrompt(
          "Canal: WhatsApp — respostas curtas e diretas, sem markdown pesado."
        ),
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        tools: createAutomationTools(this),
        stopWhen: stepCountIs(8)
      });
      reply = generated || "Desculpe, não consegui gerar uma resposta.";
    } catch (error) {
      console.error("Erro ao gerar resposta para o WhatsApp:", error);
      reply = "Desculpe, ocorreu um erro ao processar sua mensagem.";
    }

    this
      .sql`INSERT INTO wa_history (role, content, at) VALUES ('assistant', ${reply}, ${Date.now()})`;
    await sendWhatsAppText(this.env, from, reply);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/webhooks/whatsapp") {
      // Handshake de verificação do webhook (Meta)
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (
          mode === "subscribe" &&
          token === env.WHATSAPP_VERIFY_TOKEN &&
          challenge
        ) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      }

      // Mensagens recebidas
      if (request.method === "POST") {
        let message = null;
        try {
          message = parseWhatsAppWebhook(await request.json());
        } catch {
          // payload inválido — confirma recebimento mesmo assim
        }
        if (message) {
          const agent = await getAgentByName(
            env.ChatAgent,
            `wa-${message.from}`
          );
          // Responde 200 imediatamente e processa em segundo plano
          ctx.waitUntil(agent.onWhatsAppMessage(message.from, message.text));
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      }
    }

    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
