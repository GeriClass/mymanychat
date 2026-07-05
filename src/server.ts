import { createWorkersAI } from "workers-ai-provider";
import { callable, routeAgentRequest, type Schedule } from "agents";
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

// Modelo aberto no Workers AI com bom suporte a tool-calling.
// Alternativa: "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
const MODEL = "@cf/moonshotai/kimi-k2.6";

export type TaskLogEntry = {
  description: string;
  result: string;
  at: string;
};

export type AgentState = {
  taskLog: TaskLogEntry[];
};

export class ChatAgent extends AIChatAgent<Env, AgentState> {
  initialState: AgentState = { taskLog: [] };
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
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
