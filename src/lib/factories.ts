import type {
  FrameworkData,
  Platform,
  SearchResult,
  SymbolData,
  Technology,
} from "./types.js";
import { SearchUtils } from "./utils.js";

interface ApiResponse<T> {
  references?: Record<string, T>;
}

export class SearchResultFactory {
  static create(
    ref: Technology,
    frameworkName: string,
    frameworkPlatforms?: Platform[],
  ): SearchResult {
    const platforms = (
      "platforms" in ref ? ref.platforms : frameworkPlatforms
    ) as Platform[] | undefined;

    return {
      title: ref.title,
      description: SearchUtils.extractText(ref.abstract || []),
      path: ref.url,
      framework: frameworkName,
      symbolKind: ref.kind,
      platforms: SearchUtils.formatPlatforms(platforms || []),
    };
  }
}

export class ResponseValidator {
  static validateTechnologies(data: unknown): Record<string, Technology> {
    if (!data || typeof data !== "object") return {};
    const response = data as ApiResponse<Technology>;
    return response.references || {};
  }

  static validateFrameworkData(data: unknown): FrameworkData {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid framework data received");
    }
    const framework = data as FrameworkData;
    if (!framework.metadata?.title) {
      throw new Error("Framework data missing required metadata");
    }
    return framework;
  }

  static validateSymbolData(data: unknown): SymbolData {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid symbol data received");
    }
    const symbol = data as SymbolData;
    if (!symbol.metadata?.title) {
      throw new Error("Symbol data missing required metadata");
    }
    return symbol;
  }
}
