import { tool } from "ai";
import { z } from "zod";
import { scheduleSchema } from "agents/schedule";
import type { ChatAgent } from "./server";

const MAX_HTTP_BODY_CHARS = 4000;

/**
 * Ferramentas de automação executáveis no servidor — usadas no chat web,
 * no WhatsApp e dentro de tarefas agendadas (executeTask).
 */
export function createAutomationTools(agent: ChatAgent) {
  return {
    scheduleTask: tool({
      description:
        "Agenda uma tarefa para executar depois (atraso em segundos, data específica ou cron recorrente). A descrição será executada mais tarde por um agente de IA com acesso a estas mesmas ferramentas.",
      inputSchema: scheduleSchema,
      execute: async ({ when, description }) => {
        if (when.type === "no-schedule") {
          return "Entrada de agendamento inválida";
        }
        const input =
          when.type === "scheduled"
            ? when.date
            : when.type === "delayed"
              ? when.delayInSeconds
              : when.type === "cron"
                ? when.cron
                : null;
        if (!input) return "Tipo de agendamento inválido";
        try {
          const schedule = await agent.schedule(
            input,
            "executeTask",
            description,
            { idempotent: true }
          );
          return `Tarefa agendada (id ${schedule.id}): "${description}" (${when.type}: ${input})`;
        } catch (error) {
          return `Erro ao agendar tarefa: ${error}`;
        }
      }
    }),

    getScheduledTasks: tool({
      description: "Lista todas as tarefas agendadas pendentes",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = agent.getSchedules();
        return tasks.length > 0 ? tasks : "Nenhuma tarefa agendada.";
      }
    }),

    cancelScheduledTask: tool({
      description: "Cancela uma tarefa agendada pelo ID",
      inputSchema: z.object({
        taskId: z.string().describe("O ID da tarefa a cancelar")
      }),
      execute: async ({ taskId }) => {
        try {
          await agent.cancelSchedule(taskId);
          return `Tarefa ${taskId} cancelada.`;
        } catch (error) {
          return `Erro ao cancelar tarefa: ${error}`;
        }
      }
    }),

    // A primitiva que substitui o Make/n8n: chamar qualquer API/webhook.
    httpRequest: tool({
      description:
        "Faz uma requisição HTTP para qualquer URL — chamar webhooks, consultar APIs, enviar dados para outros serviços.",
      inputSchema: z.object({
        url: z.string().describe("URL completa (https://...)"),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .default("GET"),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe("Headers HTTP opcionais"),
        body: z
          .string()
          .optional()
          .describe("Corpo da requisição (ex.: JSON como string)")
      }),
      execute: async ({ url, method, headers, body }) => {
        try {
          const response = await fetch(url, {
            method,
            headers,
            body: method === "GET" ? undefined : body
          });
          const text = await response.text();
          return {
            status: response.status,
            ok: response.ok,
            body:
              text.length > MAX_HTTP_BODY_CHARS
                ? `${text.slice(0, MAX_HTTP_BODY_CHARS)}… [truncado]`
                : text
          };
        } catch (error) {
          return { error: String(error) };
        }
      }
    })
  };
}

/** Ferramentas executadas no navegador do usuário (só fazem sentido no chat web). */
export const clientTools = {
  getUserTimezone: tool({
    description:
      "Obtém o fuso horário do usuário a partir do navegador. Use quando precisar saber o horário local do usuário (ex.: para converter agendamentos para UTC).",
    inputSchema: z.object({})
  })
};
