import type { ClientOptions as AnthropicClientOptions } from "@anthropic-ai/sdk";
import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources";
import type { ClientOptions as OpenAIClientOptions } from "openai";
import { ChatCompletionTool as OpenAITool } from "openai/resources";

export type AvailableModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-4o-2024-08-06"
  | "claude-3-5-sonnet-latest"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-sonnet-20240620"
  | "llava:7b"
  | "llava:13b"
  | "llava:34b"
  | "llama3.2-vision:11b"
  | "llama3.2-vision:90b"
  | "llama3.2:latest";

export type ModelProvider = "openai" | "anthropic" | "ollama";

export type ClientOptions = OpenAIClientOptions | AnthropicClientOptions;

export type ToolCall = AnthropicTool | OpenAITool;
