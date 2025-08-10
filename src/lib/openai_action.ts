import OpenAI from "openai";
import { z } from "zod";

export interface GeneratePythonA2AServerParams {
  agentDescription: string;
  services?: Record<string, unknown>;
  model?: string; // default: "gpt-5"
  reasoningEffort?: "minimal" | "medium" | "high";
}

export const StructuredA2AServerOutputSchema = z.object({
  files: z.array(z.object({ path: z.string(), content: z.string() })).min(2)
});
export type StructuredA2AServerOutput = z.infer<typeof StructuredA2AServerOutputSchema>;

const systemPrompt = `You are an expert Python engineer who specializes in the A2A (Agent-to-Agent) Protocol. Generate a minimal, production-ready A2A server using the official a2a-sdk Python package (version 0.3.0) that integrates with OpenAI's responses API, strictly complying with the A2A Protocol specification.

CRITICAL REQUIREMENTS - USE a2a-sdk 0.3.0 WITH OPENAI RESPONSES API:

1. USE a2a AND OPENAI IMPORTS:
- from a2a.server.apps import A2AStarletteApplication
- from a2a.server.request_handlers import DefaultRequestHandler
- from a2a.server.tasks import InMemoryTaskStore
- from a2a.types import AgentCapabilities, AgentCard, AgentSkill
- from a2a.server.agent_execution import AgentExecutor, RequestContext
- from a2a.server.events import EventQueue
- from a2a.utils import new_agent_text_message
- import openai
- import os
- from dotenv import load_dotenv

2. OPENAI RESPONSES API INTEGRATION:
- Use OpenAI client.responses.create() method
- Handle API key from environment variables
- Implement proper async calls to OpenAI responses API
- Handle OpenAI API errors gracefully
- Support system prompts for agent behavior

3. AGENT EXECUTOR WITH OPENAI RESPONSES:
- Subclass AgentExecutor and implement execute() and cancel() methods
- Use OpenAI client.responses.create() in execute() method
- Pass user input and instructions to OpenAI responses API
- Handle API responses properly
- IMPORTANT: Use "await event_queue.enqueue_event()" - it's async!

4. REQUIRED FILES (EXACTLY 4 FILES):
- main.py: A2A server with OpenAI responses API integration
- requirements.txt: Include a2a-sdk, openai, python-dotenv, and other dependencies
- README.md: Setup instructions including OpenAI API key
- .env.example: Environment variables including OPENAI_API_KEY

MAIN.PY STRUCTURE WITH OPENAI RESPONSES API:
python
import os
import uvicorn
import openai
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import InMemoryTaskStore
from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.utils import new_agent_text_message
from dotenv import load_dotenv

load_dotenv()

class OpenAIAgentExecutor(AgentExecutor):
    def __init__(self):
        # Initialize OpenAI client
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-5")
        self.system_prompt = os.getenv("SYSTEM_PROMPT", "You are a helpful AI assistant.")
        self.reasoning_effort = os.getenv("REASONING_EFFORT", "medium")
    
    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        try:
            # Get user input from context
            user_input = context.get_user_input()
            
            if not user_input or not str(user_input).strip():
                await event_queue.enqueue_event(
                    new_agent_text_message("I didn't receive any input to process.")
                )
                return
            
            try:
                # Use OpenAI responses.create API
                response = await self.client.responses.create(
                    model=self.model,
                    input=str(user_input),
                    instructions=self.system_prompt,
                    reasoning={"effort": self.reasoning_effort}
                )
                
                # Extract response text from the responses API format
                response_text = ""
                if hasattr(response, 'output_text') and response.output_text:
                    response_text = response.output_text
                elif hasattr(response, 'output') and response.output:
                    # Handle structured output format
                    if isinstance(response.output, list) and len(response.output) > 0:
                        for output_item in response.output:
                            if hasattr(output_item, 'content') and output_item.content:
                                for content_item in output_item.content:
                                    if hasattr(content_item, 'text'):
                                        if hasattr(content_item.text, 'value'):
                                            response_text += content_item.text.value
                                        else:
                                            response_text += str(content_item.text)
                
                if not response_text:
                    response_text = "I couldn't generate a proper response. Please try again."
                
                # Send response back through A2A
                await event_queue.enqueue_event(new_agent_text_message(response_text))
                
            except openai.APIError as e:
                error_message = f"OpenAI API error: {str(e)}"
                await event_queue.enqueue_event(new_agent_text_message(error_message))
            except Exception as e:
                error_message = f"Error contacting OpenAI: {str(e)}"
                await event_queue.enqueue_event(new_agent_text_message(error_message))
                
        except Exception as e:
            error_message = f"Error processing request: {str(e)}"
            try:
                await event_queue.enqueue_event(new_agent_text_message(error_message))
            except Exception:
                pass
    
    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        try:
            await event_queue.enqueue_event(new_agent_text_message("Task cancelled"))
        except Exception:
            pass
        raise Exception("Cancel operation not supported")

if __name__ == '__main__':
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "9000"))
    AGENT_NAME = os.getenv("AGENT_NAME", "OpenAI Assistant")
    AGENT_DESCRIPTION = os.getenv("AGENT_DESCRIPTION", "An AI assistant powered by OpenAI")
    
    # Define agent skills based on the provided description
    skill = AgentSkill(
        id='openai_assistant',
        name='AI Assistant',
        description='Provides intelligent responses using OpenAI models with reasoning capabilities',
        tags=['ai', 'assistant', 'openai', 'reasoning'],
        examples=['Help me with a question', 'Solve this problem', 'Explain this concept'],
    )
    
    # Create agent card
    agent_card = AgentCard(
        name=AGENT_NAME,
        description=AGENT_DESCRIPTION,
        url=f'http://{HOST}:{PORT}/',
        version='1.0.0',
        default_input_modes=['text'],
        default_output_modes=['text'],
        capabilities=AgentCapabilities(streaming=True),
        skills=[skill],
    )
    
    # Create server
    request_handler = DefaultRequestHandler(
        agent_executor=OpenAIAgentExecutor(),
        task_store=InMemoryTaskStore(),
    )
    
    server = A2AStarletteApplication(
        agent_card=agent_card,
        http_handler=request_handler,
    )
    
    print(f"Starting OpenAI-powered A2A server on {HOST}:{PORT}")
    print(f"Agent: {AGENT_NAME}")
    print(f"Model: {os.getenv('OPENAI_MODEL', 'gpt-5')}")
    print(f"Reasoning: {os.getenv('REASONING_EFFORT', 'medium')}")
    
    uvicorn.run(server.build(), host=HOST, port=PORT)


REQUIREMENTS.TXT WITH OPENAI:
a2a-sdk>=0.3.0
openai>=1.0.0
uvicorn[standard]>=0.24.0
python-dotenv

.ENV.EXAMPLE WITH OPENAI RESPONSES:
HOST=0.0.0.0
PORT=9000
LOG_LEVEL=INFO
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5
REASONING_EFFORT=medium
SYSTEM_PROMPT=You are a helpful AI assistant.
AGENT_NAME=OpenAI Assistant
AGENT_DESCRIPTION=An intelligent assistant powered by OpenAI with reasoning capabilities

OPENAI RESPONSES API FEATURES:
- Uses client.responses.create() method for enhanced reasoning
- Supports reasoning effort levels (minimal, medium, high)
- Handles structured output from responses API
- Proper error handling for API failures
- Environment-based configuration for model and reasoning
- Compatible with GPT-5 and other reasoning-capable models

RESPONSE PARSING:
- Handles both output_text and structured output formats
- Extracts text content from nested response structures
- Provides fallback messages for empty responses
- Robust parsing for various response formats

OUTPUT FORMAT:
Return ONLY a JSON object exactly like:
{"files":[{"path":"main.py","content":"..."},{"path":"requirements.txt","content":"..."},{"path":"README.md","content":"..."},{"path":".env.example","content":"..."}]}
No code fences. No extra keys. EXACTLY 4 files.

CRITICAL: Generate an A2A server that uses OpenAI's client.responses.create() API with proper response parsing, reasoning capabilities, and environment-based configuration. Handle the structured response format correctly and provide robust error handling.`;

function stripCodeFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}

function coerceServerShape(parsed: unknown): StructuredA2AServerOutput {
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as any).files)
  ) {
    const files = (parsed as any).files
      .filter((f: any) => f && typeof f.path === "string" && typeof f.content === "string")
      .map((f: any) => ({ path: f.path, content: f.content }));
    if (files.length >= 2) return { files };
  }
  throw new Error("Model output missing or invalid 'files' array");
}

/**
 * Calls GPT-5 to generate structured Python files for a uvicorn-run FastAPI A2A server.
 * Returns a JSON object { files: [{ path, content }, ...] }.
 */
export async function generatePythonA2AServer(params: {
  agentDescription: string;
  services?: Record<string, unknown>;
  model?: string;
  reasoningEffort?: "minimal" | "medium" | "high";
}): Promise<StructuredA2AServerOutput> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = params.model || "gpt-5";
  const reasoningEffort = params.reasoningEffort || "minimal";

  const userPrompt = [
    `Agent Description:\n${params.agentDescription || "(none provided)"}`,
    `Services:\n${JSON.stringify(params.services ?? {}, null, 2)}`,
    'Output ONLY: {"files":[{"path":"...","content":"..."}]}'
  ].join("\n\n");

  try {
    // Try responses.parse first (if available)
    const resp = await (client as any).responses.parse({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      reasoning: { effort: reasoningEffort },
      response_format: StructuredA2AServerOutputSchema
    });
    
    if (resp.parsed) {
      return resp.parsed;
    }
    throw new Error("No parsed output from responses.parse");
  } catch (error) {
    // Fallback to responses.create
    const resp = await (client as any).responses.create({
      model,
      input: userPrompt,
      instructions: systemPrompt,
      reasoning: { effort: reasoningEffort }
    });

    const contents = resp?.output?.flatMap((o: any) => o?.content ?? []) ?? [];
    let text: string | undefined =
      (resp as any)?.output_text ??
      contents.map((c: any) => c?.text?.value ?? c?.text ?? "").filter(Boolean).join("\n");

    if (!text) throw new Error("Empty model output");

    const raw = stripCodeFences(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}$/m);
      if (!m) throw new Error("Failed to parse JSON from model output");
      parsed = JSON.parse(m[0]);
    }

    // Validate with Zod
    return StructuredA2AServerOutputSchema.parse(parsed);
  }
}
