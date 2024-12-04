import { LLMClient, ChatCompletionOptions } from "./LLMClient";
import { LogLine } from "../../types/log";
import { AvailableModel } from "../../types/model";
import { Ollama } from "ollama";

export class OllamaClient extends LLMClient {
  private client: Ollama;
  public logger: (message: LogLine) => void;

  constructor(
    logger: (message: LogLine) => void,
    modelName: AvailableModel,
    clientOptions?: any,
  ) {
    super(modelName);
    this.client = new Ollama(clientOptions);
    this.logger = logger;
    this.modelName = modelName;
  }

  async createChatCompletion(options: ChatCompletionOptions): Promise<any> {
    this.logger({
      category: "ollama",
      message: "creating chat completion",
      level: 1,
      auxiliary: {
        options: {
          value: JSON.stringify(options),
          type: "object",
        },
      },
    });

    const response = await this.client.chat({
      model: this.modelName,
      messages: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      image: options.image
        ? {
            buffer: options.image.buffer,
            description: options.image.description,
          }
        : undefined,
    });

    this.logger({
      category: "ollama",
      message: "response",
      level: 1,
      auxiliary: {
        response: {
          value: JSON.stringify(response),
          type: "object",
        },
      },
    });

    return response;
  }
}
export default OllamaClient;
