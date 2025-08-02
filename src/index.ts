#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import type { SearchResult, Technology } from "./lib/index.js";
import { AppleDevDocsClient } from "./lib/index.js";

const execAsync = promisify(exec);

// Constants
const CONFIG = {
  SERVER_NAME: "apple-dev-docs-mcp",
  SERVER_VERSION: "1.0.0",
  DEFAULT_MAX_RESULTS: 20,
  MAX_DESCRIPTION_LENGTH: 150,
  MAX_REFERENCE_DESC_LENGTH: 100,
  MAX_TECHNOLOGIES_DISPLAY: 15,
  MAX_ADDITIONAL_TECH_DISPLAY: 10,
  MAX_TOPIC_REFS: 5,
  GIT_TIMEOUT: 5000,
} as const;

const ERROR_MESSAGES = {
  UNKNOWN_TOOL: (name: string) => `Unknown tool: ${name}`,
  EXECUTION_ERROR: (error: string) => `Error executing tool: ${error}`,
  CONTAINER_UNAVAILABLE:
    "Apple Container documentation may not be publicly available yet.",
  CONTAINERIZATION_UNAVAILABLE:
    "Apple Containerization documentation may not be publicly available yet.",
  GLOBAL_SEARCH_NOT_SUPPORTED:
    "Global search across all frameworks is not yet implemented.",
  GIT_CHECK_FAILED: "Unable to check for updates from the git repository.",
} as const;

// Types
interface ToolArguments {
  [key: string]: unknown;
}

interface SearchArguments extends ToolArguments {
  query: string;
  framework?: string;
  symbolType?: string;
  platform?: string;
  maxResults?: number;
}

interface DocumentationArguments extends ToolArguments {
  path: string;
}

interface GitInfo {
  branch: string;
  behindCount: number;
  aheadCount: number;
  localCommit: string;
  remoteCommit: string;
}

/**
 * MCP Server for Apple Developer Documentation
 * Provides tools for searching and retrieving Apple documentation
 */
class AppleDevDocsMcpServer {
  private readonly server: Server;
  private readonly client: AppleDevDocsClient;

  constructor() {
    this.server = new Server(
      {
        name: CONFIG.SERVER_NAME,
        version: CONFIG.SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.client = new AppleDevDocsClient();
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getToolDefinitions(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await this.handleToolCall(
          request.params.name,
          request.params.arguments,
        );
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          ERROR_MESSAGES.EXECUTION_ERROR(
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    });
  }

  private getToolDefinitions() {
    return [
      {
        name: "list_technologies",
        description: "List all available Apple technologies/frameworks",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_container_technologies",
        description:
          "List all available Apple Container technologies/frameworks",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "list_containerization_technologies",
        description:
          "List all available Apple Containerization technologies/frameworks",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "get_documentation",
        description:
          "Get detailed documentation for any symbol, class, struct, or framework",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                'Documentation path (e.g., "documentation/SwiftUI/View") or framework name',
            },
          },
          required: ["path"],
        },
      },
      {
        name: "get_container_documentation",
        description:
          "Get detailed documentation for Apple Container symbols, classes, structs, or frameworks",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Container documentation path or framework name",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "get_containerization_documentation",
        description:
          "Get detailed documentation for Apple Containerization symbols, classes, structs, or frameworks",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Containerization documentation path or framework name",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "search_symbols",
        description:
          'Search for symbols across Apple frameworks (supports wildcards like "RPBroadcast*")',
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (supports wildcards: * and ?)",
            },
            framework: {
              type: "string",
              description: "Optional: Search within specific framework only",
            },
            symbolType: {
              type: "string",
              description:
                "Optional: Filter by symbol type (class, protocol, struct, etc.)",
            },
            platform: {
              type: "string",
              description: "Optional: Filter by platform (iOS, macOS, etc.)",
            },
            maxResults: {
              type: "number",
              description: `Optional: Maximum number of results (default: ${CONFIG.DEFAULT_MAX_RESULTS})`,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_container_symbols",
        description:
          "Search for symbols across Apple Container frameworks (supports wildcards)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (supports wildcards: * and ?)",
            },
            framework: {
              type: "string",
              description:
                "Optional: Search within specific Container framework only",
            },
            symbolType: {
              type: "string",
              description: "Optional: Filter by symbol type",
            },
            platform: {
              type: "string",
              description: "Optional: Filter by platform",
            },
            maxResults: {
              type: "number",
              description: `Optional: Maximum number of results (default: ${CONFIG.DEFAULT_MAX_RESULTS})`,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_containerization_symbols",
        description:
          "Search for symbols across Apple Containerization frameworks (supports wildcards)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (supports wildcards: * and ?)",
            },
            framework: {
              type: "string",
              description:
                "Optional: Search within specific Containerization framework only",
            },
            symbolType: {
              type: "string",
              description: "Optional: Filter by symbol type",
            },
            platform: {
              type: "string",
              description: "Optional: Filter by platform",
            },
            maxResults: {
              type: "number",
              description: `Optional: Maximum number of results (default: ${CONFIG.DEFAULT_MAX_RESULTS})`,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "check_updates",
        description: "Check for available updates from the git repository",
        inputSchema: { type: "object", properties: {}, required: [] },
      },
    ];
  }

  private async handleToolCall(
    toolName: string,
    args: ToolArguments,
  ): Promise<CallToolResult> {
    const handlers: Record<
      string,
      (args: ToolArguments) => Promise<CallToolResult>
    > = {
      list_technologies: () => this.handleListTechnologies(),
      list_container_technologies: () => this.handleListContainerTechnologies(),
      list_containerization_technologies: () =>
        this.handleListContainerizationTechnologies(),
      get_documentation: (args) =>
        this.handleGetDocumentation(args as DocumentationArguments),
      get_container_documentation: (args) =>
        this.handleGetContainerDocumentation(args as DocumentationArguments),
      get_containerization_documentation: (args) =>
        this.handleGetContainerizationDocumentation(
          args as DocumentationArguments,
        ),
      search_symbols: (args) =>
        this.handleSearchSymbols(args as SearchArguments),
      search_container_symbols: (args) =>
        this.handleSearchContainerSymbols(args as SearchArguments),
      search_containerization_symbols: (args) =>
        this.handleSearchContainerizationSymbols(args as SearchArguments),
      check_updates: () => this.handleCheckUpdates(),
    };

    const handler = handlers[toolName];
    if (!handler) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        ERROR_MESSAGES.UNKNOWN_TOOL(toolName),
      );
    }

    return handler(args);
  }

  // Technology Listing Handlers
  private async handleListTechnologies(): Promise<CallToolResult> {
    const technologies = await this.client.getTechnologies();
    const { frameworks, others } = this.categorizeTechnologies(technologies);

    const content = this.formatTechnologiesResponse(
      "Apple Developer Technologies",
      "Core Frameworks",
      frameworks,
      "Additional Technologies",
      others,
      "get_documentation",
    );

    return this.createTextResponse(content);
  }

  private async handleListContainerTechnologies(): Promise<CallToolResult> {
    try {
      const technologies = await this.client.getContainerTechnologies();
      const { frameworks, others } = this.categorizeTechnologies(technologies);

      const content = this.formatTechnologiesResponse(
        "Apple Container Technologies",
        "Container Frameworks",
        frameworks,
        "Additional Container Technologies",
        others,
        "get_container_documentation",
      );

      return this.createTextResponse(content);
    } catch (error) {
      return this.createErrorResponse(
        "❌ Apple Container Technologies Unavailable",
        "Unable to fetch Apple Container documentation at this time.",
        error,
        ERROR_MESSAGES.CONTAINER_UNAVAILABLE,
        "Try using the standard `list_technologies` for Apple Developer documentation.",
      );
    }
  }

  private async handleListContainerizationTechnologies(): Promise<CallToolResult> {
    try {
      const technologies = await this.client.getContainerizationTechnologies();
      const { frameworks, others } = this.categorizeTechnologies(technologies);

      const content = this.formatTechnologiesResponse(
        "Apple Containerization Technologies",
        "Containerization Frameworks",
        frameworks,
        "Additional Containerization Technologies",
        others,
        "get_containerization_documentation",
      );

      return this.createTextResponse(content);
    } catch (error) {
      return this.createErrorResponse(
        "❌ Apple Containerization Technologies Unavailable",
        "Unable to fetch Apple Containerization documentation at this time.",
        error,
        ERROR_MESSAGES.CONTAINERIZATION_UNAVAILABLE,
        "Try using the standard `list_technologies` for Apple Developer documentation.",
      );
    }
  }

  // Documentation Handlers
  private async handleGetDocumentation(
    args: DocumentationArguments,
  ): Promise<CallToolResult> {
    try {
      const data = await this.client.getSymbol(args.path);
      return this.createDocumentationResponse(data, "Symbol");
    } catch (error) {
      const frameworkName = await this.checkIfTechnology(args.path);
      if (frameworkName) {
        return this.handleTechnologyFallback(frameworkName, args.path);
      }
      return this.createSymbolNotFoundResponse(args.path);
    }
  }

  private async handleGetContainerDocumentation(
    args: DocumentationArguments,
  ): Promise<CallToolResult> {
    try {
      const data = await this.client.getContainerSymbol(args.path);
      return this.createDocumentationResponse(
        data,
        "Container Symbol",
        "Apple Container Documentation",
      );
    } catch (error) {
      return this.createErrorResponse(
        `❌ Container Symbol Not Found: ${args.path}`,
        "The requested Container symbol could not be located in Apple's Container documentation.",
        error,
        undefined,
        [
          "• **List Container frameworks:** Use `list_container_technologies` to see available frameworks",
          "• **Search Container symbols:** Use `search_container_symbols <query>` to find specific symbols",
          "• **Try standard docs:** Use `get_documentation` for Apple Developer documentation",
        ].join("\n"),
      );
    }
  }

  private async handleGetContainerizationDocumentation(
    args: DocumentationArguments,
  ): Promise<CallToolResult> {
    try {
      const data = await this.client.getContainerizationSymbol(args.path);
      return this.createDocumentationResponse(
        data,
        "Containerization Symbol",
        "Apple Containerization Documentation",
      );
    } catch (error) {
      return this.createErrorResponse(
        `❌ Containerization Symbol Not Found: ${args.path}`,
        "The requested Containerization symbol could not be located in Apple's Containerization documentation.",
        error,
        undefined,
        [
          "• **List Containerization frameworks:** Use `list_containerization_technologies` to see available frameworks",
          "• **Search Containerization symbols:** Use `search_containerization_symbols <query>` to find specific symbols",
          "• **Try standard docs:** Use `get_documentation` for Apple Developer documentation",
        ].join("\n"),
      );
    }
  }

  // Search Handlers
  private async handleSearchSymbols(
    args: SearchArguments,
  ): Promise<CallToolResult> {
    const {
      query,
      framework,
      symbolType,
      platform,
      maxResults = CONFIG.DEFAULT_MAX_RESULTS,
    } = args;

    const results = framework
      ? await this.client.searchFramework(framework, query, {
          symbolType,
          platform,
          maxResults,
        })
      : await this.client.searchGlobal(query, {
          symbolType,
          platform,
          maxResults,
        });

    return this.createSearchResponse(query, results, {
      framework,
      symbolType,
      platform,
      scope: framework ? `Framework: ${framework}` : "All frameworks",
      docCommand: "get_documentation",
    });
  }

  private async handleSearchContainerSymbols(
    args: SearchArguments,
  ): Promise<CallToolResult> {
    const {
      query,
      framework,
      symbolType,
      platform,
      maxResults = CONFIG.DEFAULT_MAX_RESULTS,
    } = args;

    try {
      if (!framework) {
        return this.createGlobalSearchNotSupportedResponse(
          "Container",
          "search_container_symbols",
          "list_container_technologies",
        );
      }

      const results = await this.client.searchContainerFramework(
        framework,
        query,
        {
          symbolType,
          platform,
          maxResults,
        },
      );

      return this.createSearchResponse(query, results, {
        framework,
        symbolType,
        platform,
        scope: `Framework: ${framework}`,
        docCommand: "get_container_documentation",
        sourceType: "Container",
      });
    } catch (error) {
      return this.createSearchFailedResponse("Container", error);
    }
  }

  private async handleSearchContainerizationSymbols(
    args: SearchArguments,
  ): Promise<CallToolResult> {
    const {
      query,
      framework,
      symbolType,
      platform,
      maxResults = CONFIG.DEFAULT_MAX_RESULTS,
    } = args;

    try {
      if (!framework) {
        return this.createGlobalSearchNotSupportedResponse(
          "Containerization",
          "search_containerization_symbols",
          "list_containerization_technologies",
        );
      }

      const results = await this.client.searchContainerizationFramework(
        framework,
        query,
        {
          symbolType,
          platform,
          maxResults,
        },
      );

      return this.createSearchResponse(query, results, {
        framework,
        symbolType,
        platform,
        scope: `Framework: ${framework}`,
        docCommand: "get_containerization_documentation",
        sourceType: "Containerization",
      });
    } catch (error) {
      return this.createSearchFailedResponse("Containerization", error);
    }
  }

  // Git Update Handler
  private async handleCheckUpdates(): Promise<CallToolResult> {
    try {
      const gitInfo = await this.getGitInfo();
      const content = this.formatGitStatus(gitInfo);
      return this.createTextResponse(content);
    } catch (error) {
      return this.createErrorResponse(
        "❌ Git Update Check Failed",
        ERROR_MESSAGES.GIT_CHECK_FAILED,
        error,
        undefined,
        [
          "**Common Issues:**",
          "• Not in a git repository",
          "• No internet connection",
          "• Git not installed or configured",
          "• Repository access issues",
        ].join("\n"),
      );
    }
  }

  // Helper Methods
  private categorizeTechnologies(technologies: Record<string, Technology>) {
    const frameworks: Array<{ name: string; description: string }> = [];
    const others: Array<{ name: string; description: string }> = [];

    Object.values(technologies).forEach((tech) => {
      const description = this.client.extractText(tech.abstract);
      const item = { name: tech.title, description };

      if (tech.kind === "symbol" && tech.role === "collection") {
        frameworks.push(item);
      } else {
        others.push(item);
      }
    });

    return { frameworks, others };
  }

  private formatTechnologiesResponse(
    title: string,
    frameworksTitle: string,
    frameworks: Array<{ name: string; description: string }>,
    othersTitle: string,
    others: Array<{ name: string; description: string }>,
    command: string,
  ): string {
    return [
      `# ${title}\n`,
      `## ${frameworksTitle}\n`,
      ...frameworks
        .slice(0, CONFIG.MAX_TECHNOLOGIES_DISPLAY)
        .map((f) => `• **${f.name}** - ${f.description}`),
      `\n## ${othersTitle}\n`,
      ...others
        .slice(0, CONFIG.MAX_ADDITIONAL_TECH_DISPLAY)
        .map((f) => `• **${f.name}** - ${f.description}`),
      `\n*Use \`${command} <name>\` to explore any framework or symbol*`,
      `\n\n**Total: ${frameworks.length + others.length} technologies available**`,
    ].join("\n");
  }

  private createDocumentationResponse(
    data: any,
    defaultTitle: string,
    source?: string,
  ): CallToolResult {
    const title = data.metadata?.title || defaultTitle;
    const kind = data.metadata?.symbolKind || "Unknown";
    const platforms = this.client.formatPlatforms(data.metadata?.platforms);
    const description = this.client.extractText(data.abstract);

    const content = [
      `# ${title}\n`,
      `**Type:** ${kind}`,
      `**Platforms:** ${platforms}`,
      ...(source ? [`**Source:** ${source}`] : []),
      "\n## Overview",
      description,
    ];

    if (data.topicSections?.length > 0) {
      content.push("\n## API Reference\n");
      this.addTopicSections(content, data);
    }

    return this.createTextResponse(content.join("\n"));
  }

  private addTopicSections(content: string[], data: any): void {
    data.topicSections.forEach((section: any) => {
      content.push(`### ${section.title}`);
      if (section.identifiers?.length > 0) {
        section.identifiers
          .slice(0, CONFIG.MAX_TOPIC_REFS)
          .forEach((id: string) => {
            const ref = data.references?.[id];
            if (ref) {
              const refDesc = this.client.extractText(ref.abstract || []);
              content.push(
                `• **${ref.title}** - ${this.truncateText(refDesc, CONFIG.MAX_REFERENCE_DESC_LENGTH)}`,
              );
            }
          });
        if (section.identifiers.length > CONFIG.MAX_TOPIC_REFS) {
          content.push(
            `*... and ${section.identifiers.length - CONFIG.MAX_TOPIC_REFS} more items*`,
          );
        }
      }
      content.push("");
    });
  }

  private async checkIfTechnology(path: string): Promise<string | null> {
    try {
      const technologies = await this.client.getTechnologies();
      const cleanPath = path.replace(/^documentation\//, "").toLowerCase();
      const potentialFramework = cleanPath.split("/")[0];

      for (const tech of Object.values(technologies)) {
        if (tech?.title) {
          const titleLower = tech.title.toLowerCase();
          if (titleLower === potentialFramework || titleLower === cleanPath) {
            return tech.title;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async handleTechnologyFallback(
    frameworkName: string,
    originalPath: string,
  ): Promise<CallToolResult> {
    try {
      const data = await this.client.getFramework(frameworkName);
      const title = data.metadata?.title || frameworkName;
      const description = this.client.extractText(data.abstract);
      const platforms = this.client.formatPlatforms(data.metadata?.platforms);

      const content = [
        `# 🔍 Framework Detected: ${title}\n`,
        "⚠️ **You searched for a framework instead of a specific symbol.**",
        `To access symbols within this framework, use the format: **framework/symbol**`,
        `**Example:** \`documentation/${frameworkName}/View\` instead of \`${originalPath}\`\n`,
        `**Platforms:** ${platforms}\n`,
        "## Framework Overview",
        description,
        "\n## Available Symbol Categories\n",
        ...data.topicSections.map((section: any) => {
          const count = section.identifiers?.length || 0;
          return `• **${section.title}** (${count} symbols)`;
        }),
        "\n## Next Steps",
        `• **Browse symbols:** Use \`documentation/${frameworkName}/[SymbolName]\``,
        "• **Search symbols:** Use `search_symbols` with a specific symbol name",
        `• **Explore framework:** Use \`get_documentation ${frameworkName}\` for detailed structure`,
      ].join("\n");

      return this.createTextResponse(content);
    } catch {
      return this.createSymbolNotFoundResponse(originalPath);
    }
  }

  private createSymbolNotFoundResponse(path: string): CallToolResult {
    const content = [
      `# ❌ Symbol Not Found: ${path}\n`,
      "The requested symbol could not be located in Apple's documentation.",
      "\n## Common Issues",
      "• **Incorrect path format:** Expected `documentation/Framework/Symbol`",
      `• **Framework vs Symbol:** "${path}" may be a framework name rather than a symbol`,
      '• **Case sensitivity:** Ensure proper capitalization (e.g., "SwiftUI" not "swiftui")',
      "\n## Recommended Actions",
      "• **List frameworks:** Use `list_technologies` to see available frameworks",
      "• **Browse framework:** Use `get_documentation <name>` to explore structure",
      "• **Search symbols:** Use `search_symbols <query>` to find specific symbols",
      '• **Example search:** `search_symbols "View"` to find View-related symbols',
    ].join("\n");

    return this.createTextResponse(content);
  }

  private createSearchResponse(
    query: string,
    results: SearchResult[],
    options: {
      framework?: string;
      symbolType?: string;
      platform?: string;
      scope: string;
      docCommand: string;
      sourceType?: string;
    },
  ): CallToolResult {
    const { symbolType, platform, scope, docCommand, sourceType } = options;

    const header = [
      `# ${sourceType ? `${sourceType} ` : ""}Search Results for "${query}"\n`,
      `**Scope:** ${scope}`,
      ...(symbolType ? [`**Symbol Type:** ${symbolType}`] : []),
      ...(platform ? [`**Platform:** ${platform}`] : []),
      `**Found:** ${results.length} results\n`,
    ];

    if (results.length === 0) {
      return this.createNoResultsResponse(header.join("\n"));
    }

    const content = [
      ...header,
      "## Results\n",
      ...this.formatSearchResults(results, docCommand),
      `*Use \`${docCommand}\` with any path above to see detailed documentation*`,
    ];

    return this.createTextResponse(content.join("\n"));
  }

  private formatSearchResults(
    results: SearchResult[],
    docCommand: string,
  ): string[] {
    return results.flatMap((result, index) => [
      `### ${index + 1}. ${result.title}`,
      `**Framework:** ${result.framework}${
        result.symbolKind ? ` | **Type:** ${result.symbolKind}` : ""
      }`,
      ...(result.platforms ? [`**Platforms:** ${result.platforms}`] : []),
      `**Path:** \`${result.path}\``,
      ...(result.description
        ? [this.truncateText(result.description, CONFIG.MAX_DESCRIPTION_LENGTH)]
        : []),
      "",
    ]);
  }

  private createNoResultsResponse(header: string): CallToolResult {
    const content = [
      header,
      "## No Results Found\n",
      "Try:",
      "• Broader search terms",
      '• Wildcard patterns (e.g., "UI*", "*View*")',
      "• Removing filters",
    ].join("\n");

    return this.createTextResponse(content);
  }

  private createGlobalSearchNotSupportedResponse(
    sourceType: string,
    searchCommand: string,
    listCommand: string,
  ): CallToolResult {
    const content = [
      `# ⚠️ ${sourceType} Global Search Not Supported\n`,
      `Global search across all ${sourceType} frameworks is not yet implemented.`,
      "\n**Recommendation:** Specify a framework name for targeted search.",
      `\n**Example:** \`${searchCommand} "Image*" --framework "Container${sourceType}"\``,
      `\n**Available:** Use \`${listCommand}\` to see available frameworks`,
    ].join("\n");

    return this.createTextResponse(content);
  }

  private createSearchFailedResponse(
    sourceType: string,
    error: unknown,
  ): CallToolResult {
    return this.createErrorResponse(
      `❌ ${sourceType} Search Failed`,
      `Unable to search Apple ${sourceType} documentation.`,
      error,
      `Apple ${sourceType} documentation may not be publicly available yet.`,
      `Try using the standard \`search_symbols\` for Apple Developer documentation.`,
    );
  }

  private async getGitInfo(): Promise<GitInfo> {
    await execAsync("git fetch origin");

    const [currentBranch, behind, ahead, localCommit, remoteCommit] =
      await Promise.all([
        execAsync("git branch --show-current").then((r) => r.stdout.trim()),
        execAsync(
          "git rev-list --count HEAD..origin/$(git branch --show-current)",
        ).then((r) => parseInt(r.stdout.trim())),
        execAsync(
          "git rev-list --count origin/$(git branch --show-current)..HEAD",
        ).then((r) => parseInt(r.stdout.trim())),
        execAsync('git log -1 --format="%h %s (%an, %ar)"').then((r) =>
          r.stdout.trim(),
        ),
        execAsync(
          'git log -1 --format="%h %s (%an, %ar)" origin/$(git branch --show-current)',
        ).then((r) => r.stdout.trim()),
      ]);

    return {
      branch: currentBranch,
      behindCount: behind,
      aheadCount: ahead,
      localCommit,
      remoteCommit,
    };
  }

  private formatGitStatus(gitInfo: GitInfo): string {
    const { branch, behindCount, aheadCount, localCommit, remoteCommit } =
      gitInfo;

    let status = "";
    let icon = "";

    if (behindCount === 0 && aheadCount === 0) {
      status = "Up to date";
      icon = "✅";
    } else if (behindCount > 0 && aheadCount === 0) {
      status = `${behindCount} update${behindCount > 1 ? "s" : ""} available`;
      icon = "🔄";
    } else if (behindCount === 0 && aheadCount > 0) {
      status = `${aheadCount} local change${aheadCount > 1 ? "s" : ""} ahead`;
      icon = "🚀";
    } else {
      status = `${behindCount} update${behindCount > 1 ? "s" : ""} available, ${aheadCount} local change${aheadCount > 1 ? "s" : ""} ahead`;
      icon = "⚡";
    }

    const content = [
      `# ${icon} Git Repository Status\n`,
      `**Branch:** ${branch}`,
      `**Status:** ${status}\n`,
      "## Current State",
      `**Local commit:** ${localCommit}`,
      `**Remote commit:** ${remoteCommit}\n`,
    ];

    if (behindCount > 0) {
      content.push(
        "## 💡 Available Updates",
        `There ${behindCount === 1 ? "is" : "are"} **${behindCount}** new commit${behindCount > 1 ? "s" : ""} available.`,
        `**To update:** Run \`git pull origin ${branch}\` in your terminal, then restart the MCP server.\n`,
      );
    }

    if (aheadCount > 0) {
      content.push(
        "## 🚀 Local Changes",
        `You have **${aheadCount}** local commit${aheadCount > 1 ? "s" : ""} that haven't been pushed.`,
        `**To share:** Run \`git push origin ${branch}\` in your terminal.\n`,
      );
    }

    if (behindCount === 0 && aheadCount === 0) {
      content.push(
        "## 🎉 All Good!",
        "Your local repository is in sync with the remote repository.",
      );
    }

    return content.join("\n");
  }

  // Utility Methods
  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;
  }

  private createTextResponse(text: string): CallToolResult {
    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    };
  }

  private createErrorResponse(
    title: string,
    message: string,
    error: unknown,
    note?: string,
    additionalInfo?: string,
  ): CallToolResult {
    const content = [
      `# ${title}\n`,
      message,
      `\n**Error:** ${error instanceof Error ? error.message : String(error)}`,
      ...(note ? [`\n**Note:** ${note}`] : []),
      ...(additionalInfo ? [`\n${additionalInfo}`] : []),
    ].join("\n");

    return this.createTextResponse(content);
  }

  private async checkAndDisplayUpdates(): Promise<void> {
    try {
      await execAsync("git fetch origin", { timeout: CONFIG.GIT_TIMEOUT });
      const { stdout: currentBranch } = await execAsync(
        "git branch --show-current",
      );
      const branch = currentBranch.trim();
      const { stdout: behind } = await execAsync(
        `git rev-list --count HEAD..origin/${branch}`,
      );
      const behindCount = parseInt(behind.trim());

      if (behindCount > 0) {
        console.error(
          `🔄 ${behindCount} update${
            behindCount > 1 ? "s" : ""
          } available! Use 'check_updates' tool for details and update instructions.`,
        );
      }
    } catch {
      // Silent fail - don't spam console with git errors
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    await this.checkAndDisplayUpdates();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Apple Developer Documentation MCP server running on stdio");
  }
}

// Start the server
const server = new AppleDevDocsMcpServer();
server.run().catch(console.error);
