import OpenAI from "openai";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { LLMClient, ChatCompletionOptions } from "./LLMClient";
import { LLMCache } from "../cache/LLMCache";
import { LogLine } from "lib/types";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private cache: LLMCache;
  public logger: (message: LogLine) => void;
  private enableCaching: boolean;
  private requestId: string;

  constructor(
    logger: (message: LogLine) => void,
    enableCaching = false,
    cache: LLMCache,
    requestId: string,
  ) {
    this.client = new OpenAI();
    this.logger = logger;
    this.requestId = requestId;
    this.cache = cache;
    this.enableCaching = enableCaching;
  }

  async createChatCompletion(options: ChatCompletionOptions) {
    const { image: _, ...optionsWithoutImage } = options;
    this.logger({
      category: "openai",
      message: "creating chat completion",
      level: 1,
      auxiliary: {
        options: {
          value: JSON.stringify(optionsWithoutImage),
          type: "object",
        },
      },
    });
    const cacheOptions = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      image: options.image,
      response_model: options.response_model,
    };

    if (this.enableCaching) {
      const cachedResponse = await this.cache.get(cacheOptions, this.requestId);
      if (cachedResponse) {
        this.logger({
          category: "llm_cache",
          message: "LLM cache hit - returning cached response",
          level: 1,
          auxiliary: {
            requestId: {
              value: this.requestId,
              type: "string",
            },
            cachedResponse: {
              value: JSON.stringify(cachedResponse),
              type: "object",
            },
          },
        });
        return cachedResponse;
      } else {
        this.logger({
          category: "llm_cache",
          message: "LLM cache miss - no cached response found",
          level: 1,
          auxiliary: {
            requestId: {
              value: this.requestId,
              type: "string",
            },
          },
        });
      }
    }

    if (options.image) {
      const screenshotMessage: any = {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${options.image.buffer.toString("base64")}`,
            },
          },
          ...(options.image.description
            ? [{ type: "text", text: options.image.description }]
            : []),
        ],
      };

      options.messages = [...options.messages, screenshotMessage];
    }

    const { image, response_model, ...openAiOptions } = options;

    let responseFormat = undefined;
    if (options.response_model) {
      responseFormat = zodToJsonSchema(
        options.response_model.schema,
        options.response_model.name,
      );
    }

    const response = await this.client.chat.completions.create({
      ...openAiOptions,
      response_format: responseFormat,
    });

    this.logger({
      category: "openai",
      message: "response",
      level: 1,
      auxiliary: {
        response: {
          value: JSON.stringify(response),
          type: "object",
        },
        requestId: {
          value: this.requestId,
          type: "string",
        },
      },
    });

    if (response_model) {
      const extractedData = response.choices[0].message.content;
      const parsedData = JSON.parse(extractedData);

      if (this.enableCaching) {
        this.cache.set(
          cacheOptions,
          {
            ...parsedData,
          },
          this.requestId,
        );
      }

      return {
        ...parsedData,
      };
    }

    if (this.enableCaching) {
      this.logger({
        category: "llm_cache",
        message: "caching response",
        level: 1,
        auxiliary: {
          requestId: {
            value: this.requestId,
            type: "string",
          },
          cacheOptions: {
            value: JSON.stringify(cacheOptions),
            type: "object",
          },
          response: {
            value: JSON.stringify(response),
            type: "object",
          },
        },
      });
      this.cache.set(cacheOptions, response, this.requestId);
    }

    return response;
  }
}
