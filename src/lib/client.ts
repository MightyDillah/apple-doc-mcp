import {
  CONFIG,
  DOC_SOURCES,
  ROLES,
  SYMBOL_KINDS,
  type DocSourceName,
} from "./constants.js";
import { DocSource } from "./doc-source.js";
import { ErrorFactory } from "./errors.js";
import { DocHttpClient } from "./http-client.js";
import type {
  AbstractItem,
  FrameworkData,
  Platform,
  SearchOptions,
  SearchResult,
  SymbolData,
  Technology,
} from "./types.js";
import { SearchUtils } from "./utils.js";

export class AppleDevDocsClient {
  private readonly httpClient = new DocHttpClient();
  private readonly sources: Record<DocSourceName, DocSource>;

  constructor() {
    this.sources = Object.fromEntries(
      Object.entries(DOC_SOURCES).map(([key, config]) => [
        key,
        new DocSource(config, this.httpClient),
      ]),
    ) as Record<DocSourceName, DocSource>;
  }

  async getTechnologies(): Promise<Record<string, Technology>> {
    return this.sources.main.getTechnologies();
  }

  async getFramework(frameworkName: string): Promise<FrameworkData> {
    return this.sources.main.getFramework(frameworkName);
  }

  async getSymbol(path: string): Promise<SymbolData> {
    return this.sources.main.getSymbol(path);
  }

  async getContainerTechnologies(): Promise<Record<string, Technology>> {
    return this.sources.container.getTechnologies();
  }

  async getContainerFramework(frameworkName: string): Promise<FrameworkData> {
    return this.sources.container.getFramework(frameworkName);
  }

  async getContainerSymbol(path: string): Promise<SymbolData> {
    return this.sources.container.getSymbol(path);
  }

  async getContainerizationTechnologies(): Promise<Record<string, Technology>> {
    return this.sources.containerization.getTechnologies();
  }

  async getContainerizationFramework(
    frameworkName: string,
  ): Promise<FrameworkData> {
    return this.sources.containerization.getFramework(frameworkName);
  }

  async getContainerizationSymbol(path: string): Promise<SymbolData> {
    return this.sources.containerization.getSymbol(path);
  }

  async searchGlobal(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const { maxResults = CONFIG.DEFAULT_MAX_RESULTS } = options;

    try {
      const technologies = await this.getTechnologies();
      const frameworks = this.filterSearchableFrameworks(technologies);
      const results = await this.executeParallelSearch(
        frameworks,
        query,
        options,
        maxResults,
      );

      return results.slice(0, maxResults);
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error("Unknown error");
      throw ErrorFactory.globalSearch(originalError);
    }
  }

  private filterSearchableFrameworks(
    technologies: Record<string, Technology>,
  ): Technology[] {
    return Object.values(technologies)
      .filter(
        (tech) =>
          tech.kind === SYMBOL_KINDS.SYMBOL && tech.role === ROLES.COLLECTION,
      )
      .slice(0, CONFIG.FRAMEWORK_SEARCH_LIMIT);
  }

  private async executeParallelSearch(
    frameworks: Technology[],
    query: string,
    options: SearchOptions,
    maxResults: number,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    const searchPromises = frameworks.map(async (framework) => {
      try {
        return await this.searchFramework(framework.title, query, {
          ...options,
          maxResults: Math.ceil(
            maxResults / CONFIG.SEARCH_RESULTS_PER_FRAMEWORK,
          ),
        });
      } catch (error) {
        console.warn(`Failed to search ${framework.title}:`, error);
        return [];
      }
    });

    const allResults = await Promise.allSettled(searchPromises);

    allResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results.push(...result.value);
      }
    });

    return results;
  }

  async searchFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    return this.sources.main.searchFramework(frameworkName, query, options);
  }

  async searchContainerFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    return this.sources.container.searchFramework(
      frameworkName,
      query,
      options,
    );
  }

  async searchContainerizationFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    return this.sources.containerization.searchFramework(
      frameworkName,
      query,
      options,
    );
  }

  clearCache(): void {
    this.httpClient.clearCache();
  }

  extractText(abstract: AbstractItem[]): string {
    return SearchUtils.extractText(abstract);
  }

  formatPlatforms(platforms: Platform[]): string {
    return SearchUtils.formatPlatforms(platforms);
  }
}
