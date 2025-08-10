import axios, { AxiosInstance, AxiosResponse } from "axios";
import { CONFIG, DEFAULT_HEADERS } from "./constants";
import { ErrorFactory } from "./errors";
import { LRUCache } from "./utils";

export class DocHttpClient {
  private readonly client: AxiosInstance;
  private readonly cache = new LRUCache<unknown>();

  constructor() {
    this.client = axios.create({
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: DEFAULT_HEADERS,
    });
  }

  async get<T>(url: string, referrer: string): Promise<T> {
    const cached = this.cache.get(url);
    if (cached) return cached as T;

    try {
      const response: AxiosResponse<T> = await this.client.get(url, {
        headers: { Referer: referrer },
      });

      this.cache.set(url, response.data);
      return response.data;
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error("Unknown error");
      throw ErrorFactory.httpRequest(url, originalError);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
