import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "ollama-mcp",
  version: "1.0.0",
});

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

server.tool(
  "ollama_chat",
  "Chat with a local Ollama model using multi-turn conversation history, just like Claude",
  {
    model: z.string().default("qwen3-coder").describe("Ollama model name"),
    messages: z
      .array(MessageSchema)
      .describe(
        "Conversation history as an array of {role, content} objects. " +
        "Roles: 'system' (optional, sets behavior), 'user' (human turns), 'assistant' (model turns). " +
        "Pass the full history each call to maintain context."
      ),
  },
  async ({ model, messages }) => {
    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: [{ type: "text", text: data.message.content }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
