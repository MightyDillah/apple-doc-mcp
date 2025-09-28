#!/usr/bin/env node
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { AppleDevDocsClient } from './apple-client.js';
const execAsync = promisify(exec);
class AppleDevDocsMcpServer {
    client;
    server;
    activeTechnology;
    activeFrameworkData;
    lastDiscovery;
    constructor() {
        this.server = new Server({
            name: 'apple-dev-docs-mcp',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.client = new AppleDevDocsClient();
        this.setupToolHandlers();
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Apple Developer Documentation MCP server running on stdio');
    }
    async checkAndDisplayUpdates() {
        try {
            // Quietly fetch latest info
            await execAsync('git fetch origin', { timeout: 5000 });
            const { stdout: currentBranch } = await execAsync('git branch --show-current');
            const branch = currentBranch.trim();
            const { stdout: behind } = await execAsync(`git rev-list --count HEAD..origin/${branch}`);
            const behindCount = Number.parseInt(behind.trim(), 10);
            if (behindCount > 0) {
                console.error(`🔄 ${behindCount} update${behindCount > 1 ? 's' : ''} available! Use 'check_updates' tool for details and update instructions.`);
            }
        }
        catch {
            // Silent fail - don't spam console with git errors
        }
    }
    async handleDiscoverTechnologies(args) {
        const { query, page = 1, pageSize = 25 } = args;
        const technologies = await this.client.getTechnologies();
        const frameworks = Object.values(technologies).filter(tech => tech.kind === 'symbol' && tech.role === 'collection');
        let filtered = frameworks;
        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = frameworks.filter(tech => tech.title.toLowerCase().includes(lowerQuery)
                || this.client.extractText(tech.abstract).toLowerCase().includes(lowerQuery));
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const currentPage = Math.min(Math.max(page, 1), totalPages);
        const start = (currentPage - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);
        this.lastDiscovery = {
            query,
            results: pageItems,
        };
        const lines = [
            `# Discover Apple Technologies${query ? ` (filtered by "${query}")` : ''}\n`,
            `**Total frameworks:** ${frameworks.length}`,
            `**Matches:** ${filtered.length}`,
            `**Page:** ${currentPage} / ${totalPages}\n`,
            '## Available Frameworks\n',
        ];
        for (const framework of pageItems) {
            const description = this.client.extractText(framework.abstract);
            lines.push(`### ${framework.title}`);
            if (description) {
                lines.push(`   ${description.slice(0, 180)}${description.length > 180 ? '...' : ''}`);
            }
            lines.push(`   • **Identifier:** ${framework.identifier}`);
            lines.push(`   • **Select:** \`choose_technology "${framework.title}"\``);
            lines.push('');
        }
        if (totalPages > 1) {
            const paginationLines = [];
            if (currentPage > 1) {
                paginationLines.push(`• Previous: \`discover_technologies { "query": "${query ?? ''}", "page": ${currentPage - 1} }\``);
            }
            if (currentPage < totalPages) {
                paginationLines.push(`• Next: \`discover_technologies { "query": "${query ?? ''}", "page": ${currentPage + 1} }\``);
            }
            lines.push('*Pagination*');
            lines.push(...paginationLines);
        }
        lines.push('\n## Next Step');
        lines.push('Call `choose_technology` with the framework title or identifier to make it active.');
        return {
            content: [
                {
                    text: lines.join('\n'),
                    type: 'text',
                },
            ],
        };
    }
    async handleCheckUpdates() {
        try {
            // Fetch latest changes from remote
            await execAsync('git fetch origin');
            // Check current branch
            const { stdout: currentBranch } = await execAsync('git branch --show-current');
            const branch = currentBranch.trim();
            // Compare local vs remote commits
            const { stdout: behind } = await execAsync(`git rev-list --count HEAD..origin/${branch}`);
            const { stdout: ahead } = await execAsync(`git rev-list --count origin/${branch}..HEAD`);
            const behindCount = Number.parseInt(behind.trim(), 10);
            const aheadCount = Number.parseInt(ahead.trim(), 10);
            // Get latest commit info
            const { stdout: localCommit } = await execAsync('git log -1 --format="%h %s (%an, %ar)"');
            const { stdout: remoteCommit } = await execAsync(`git log -1 --format="%h %s (%an, %ar)" origin/${branch}`);
            let status = '';
            let icon = '';
            if (behindCount === 0 && aheadCount === 0) {
                status = 'Up to date';
                icon = '✅';
            }
            else if (behindCount > 0 && aheadCount === 0) {
                status = `${behindCount} update${behindCount > 1 ? 's' : ''} available`;
                icon = '🔄';
            }
            else if (behindCount === 0 && aheadCount > 0) {
                status = `${aheadCount} local change${aheadCount > 1 ? 's' : ''} ahead`;
                icon = '🚀';
            }
            else {
                status = `${behindCount} update${behindCount > 1 ? 's' : ''} available, ${aheadCount} local change${aheadCount > 1 ? 's' : ''} ahead`;
                icon = '⚡';
            }
            const content = [
                `# ${icon} Git Repository Status\n`,
                `**Branch:** ${branch}`,
                `**Status:** ${status}\n`,
                '## Current State',
                `**Local commit:** ${localCommit.trim()}`,
                `**Remote commit:** ${remoteCommit.trim()}\n`,
            ];
            if (behindCount > 0) {
                const updateText = `There ${behindCount === 1 ? 'is' : 'are'} **${behindCount}** new commit${behindCount > 1 ? 's' : ''} available.`;
                const updateInstruction = `**To update:** Run \`git pull origin ${branch}\` in your terminal, then restart the MCP server.`;
                content.push('## 💡 Available Updates', updateText, updateInstruction);
            }
            if (aheadCount > 0) {
                const localText = `You have **${aheadCount}** local commit${aheadCount > 1 ? 's' : ''} that haven't been pushed.`;
                const localInstruction = `**To share:** Run \`git push origin ${branch}\` in your terminal.`;
                content.push('## 🚀 Local Changes', localText, localInstruction);
            }
            if (behindCount === 0 && aheadCount === 0) {
                content.push('## 🎉 All Good!', 'Your local repository is in sync with the remote repository.');
            }
            return {
                content: [
                    {
                        text: content.join('\n'),
                        type: 'text',
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        text: [
                            '# ❌ Git Update Check Failed\n',
                            'Unable to check for updates from the git repository.',
                            `\n**Error:** ${error instanceof Error ? error.message : String(error)}`,
                            '\n**Common Issues:**',
                            '• Not in a git repository',
                            '• No internet connection',
                            '• Git not installed or configured',
                            '• Repository access issues',
                        ].join('\n'),
                        type: 'text',
                    },
                ],
            };
        }
    }
    async handleGetDocumentation(args) {
        const { path } = args;
        if (!this.activeTechnology) {
            return this.formatNoTechnologyMessage();
        }
        const framework = await this.loadActiveFrameworkData();
        const identifierParts = this.activeTechnology.identifier.split('/');
        const frameworkName = identifierParts[identifierParts.length - 1];
        let targetPath = path;
        if (!path.startsWith('documentation/')) {
            targetPath = `documentation/${frameworkName}/${path}`;
        }
        try {
            const data = await this.client.getSymbol(targetPath);
            const title = data.metadata?.title || 'Symbol';
            const kind = data.metadata?.symbolKind || 'Unknown';
            const platforms = this.client.formatPlatforms(data.metadata?.platforms);
            const description = this.client.extractText(data.abstract);
            const content = [
                `# ${title}\n`,
                `**Technology:** ${this.activeTechnology.title}`,
                `**Type:** ${kind}`,
                `**Platforms:** ${platforms}\n`,
                '## Overview',
                description,
            ];
            this.addTopicSections(data, content);
            return {
                content: [
                    {
                        text: content.join('\n'),
                        type: 'text',
                    },
                ],
            };
        }
        catch (error) {
            throw new McpError(ErrorCode.InvalidRequest, `Failed to load documentation for ${targetPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    addTopicSections(data, content) {
        if (!data.topicSections || data.topicSections.length === 0) {
            return;
        }
        content.push('\n## API Reference\n');
        for (const section of data.topicSections) {
            content.push(`### ${section.title}`);
            if (section.identifiers && section.identifiers.length > 0) {
                for (const id of section.identifiers.slice(0, 5)) {
                    const ref = data.references?.[id];
                    if (ref) {
                        const refDesc = this.client.extractText(ref.abstract ?? []);
                        content.push(`• **${ref.title}** - ${refDesc.slice(0, 100)}${refDesc.length > 100 ? '...' : ''}`);
                    }
                }
                if (section.identifiers.length > 5) {
                    content.push(`*... and ${section.identifiers.length - 5} more items*`);
                }
            }
            content.push('');
        }
    }
    fuzzyMatchSymbols(entries, query, options) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const ranked = [];
        for (const entry of entries) {
            const haystacks = [entry.ref.title ?? '', this.client.extractText(entry.ref.abstract ?? []).toLowerCase()];
            let score = 0;
            for (const term of terms) {
                if (haystacks.some(h => h.toLowerCase().includes(term))) {
                    score += 1;
                }
            }
            if (score > 0) {
                ranked.push({ ref: entry.ref, id: entry.id, score });
            }
        }
        ranked.sort((a, b) => b.score - a.score || a.ref.title.localeCompare(b.ref.title));
        return ranked.slice(0, options.maxResults);
    }
    async handleSearchSymbols(args) {
        if (!this.activeTechnology) {
            return this.formatNoTechnologyMessage();
        }
        const { query, maxResults = 20, platform, symbolType } = args;
        const entries = await this.ensureFrameworkIndex();
        let matches = this.fuzzyMatchSymbols(entries, query, { maxResults: maxResults * 2 });
        if (symbolType) {
            matches = matches.filter(match => match.ref.kind?.toLowerCase() === symbolType.toLowerCase());
        }
        if (platform) {
            matches = matches.filter(match => match.ref.platforms?.some(p => p.name?.toLowerCase().includes(platform.toLowerCase())) ?? true);
        }
        matches = matches.slice(0, maxResults);
        const lines = [
            `# 🔍 Search Results for "${query}"\n`,
            `**Technology:** ${this.activeTechnology.title}`,
            `**Matches:** ${matches.length}\n`,
            '## Symbols\n',
        ];
        for (const match of matches) {
            lines.push(`### ${match.ref.title}`);
            if (match.ref.kind) {
                lines.push(`   • **Kind:** ${match.ref.kind}`);
            }
            lines.push(`   • **Path:** ${match.ref.url}`);
            const abstractText = this.client.extractText(match.ref.abstract ?? []);
            if (abstractText) {
                lines.push(`   ${abstractText.slice(0, 180)}${abstractText.length > 180 ? '...' : ''}`);
            }
            lines.push('');
        }
        if (matches.length === 0) {
            lines.push('No symbols matched those terms within this technology.');
            lines.push('Try different keywords, inspect `discover_technologies`, or switch frameworks with `choose_technology`.');
        }
        return {
            content: [
                {
                    text: lines.join('\n'),
                    type: 'text',
                },
            ],
        };
    }
    async loadActiveFrameworkData() {
        if (!this.activeTechnology) {
            throw new McpError(ErrorCode.InvalidRequest, 'No technology selected. Use `discover_technologies` then `choose_technology` first.');
        }
        if (this.activeFrameworkData) {
            return this.activeFrameworkData;
        }
        const identifierParts = this.activeTechnology.identifier.split('/');
        const frameworkName = identifierParts[identifierParts.length - 1];
        const data = await this.client.getFramework(frameworkName);
        this.activeFrameworkData = data;
        return data;
    }
    async ensureFrameworkIndex() {
        const framework = await this.loadActiveFrameworkData();
        return Object.entries(framework.references).map(([id, ref]) => ({ id, ref }));
    }
    formatNoTechnologyMessage() {
        const lines = [
            '# 🚦 Technology Not Selected\n',
            'Before you can search or view documentation, choose a framework/technology.',
            '',
            '## How to get started',
            '• `discover_technologies` — explore frameworks (supports `query` filtering)',
            '• `choose_technology "Framework Name"` — set your active selection',
        ];
        if (this.lastDiscovery?.results?.length) {
            lines.push('', '### Recently discovered frameworks');
            for (const result of this.lastDiscovery.results.slice(0, 5)) {
                lines.push(`• ${result.title} (\`choose_technology "${result.title}"\`)`);
            }
        }
        return {
            content: [
                {
                    text: lines.join('\n'),
                    type: 'text',
                },
            ],
        };
    }
    static fuzzyScore(a, b) {
        if (!a || !b) {
            return Number.POSITIVE_INFINITY;
        }
        const lowerA = a.toLowerCase();
        const lowerB = b.toLowerCase();
        if (lowerA === lowerB) {
            return 0;
        }
        if (lowerA.startsWith(lowerB) || lowerB.startsWith(lowerA)) {
            return 1;
        }
        if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) {
            return 2;
        }
        return 3;
    }
    async handleChooseTechnology(args) {
        const { name, identifier } = args;
        const technologies = await this.client.getTechnologies();
        const candidates = Object.values(technologies);
        let chosen;
        if (identifier) {
            const lowerIdentifier = identifier.toLowerCase();
            chosen = candidates.find(tech => tech.identifier?.toLowerCase() === lowerIdentifier);
        }
        if (!chosen && name) {
            const lower = name.toLowerCase();
            chosen = candidates.find(tech => tech.title && tech.title.toLowerCase() === lower);
        }
        if (!chosen && name) {
            const scored = candidates
                .map(tech => ({ tech, score: AppleDevDocsMcpServer.fuzzyScore(tech.title, name) }))
                .sort((a, b) => a.score - b.score);
            chosen = scored[0]?.tech;
        }
        if (!chosen) {
            const searchTerm = (name ?? identifier ?? '').toLowerCase();
            const suggestions = candidates
                .filter(tech => tech.title?.toLowerCase().includes(searchTerm))
                .slice(0, 5);
            const lines = [
                '# ❌ Technology Not Found\n',
                `Could not resolve "${name ?? identifier ?? 'unknown'}".`,
                '',
                '## Suggestions',
            ];
            if (suggestions.length > 0) {
                for (const suggestion of suggestions) {
                    lines.push(`• ${suggestion.title} — \`choose_technology "${suggestion.title}"\``);
                }
            }
            else {
                lines.push('• Use `discover_technologies { "query": "keyword" }` to find candidates');
            }
            return {
                content: [
                    {
                        text: lines.join('\n'),
                        type: 'text',
                    },
                ],
            };
        }
        if (chosen.kind !== 'symbol' || chosen.role !== 'collection') {
            return {
                content: [
                    {
                        text: `# ⚠️ Unsupported Selection\n${chosen.title} is not a framework collection. Please choose a framework technology instead.`,
                        type: 'text',
                    },
                ],
            };
        }
        this.activeTechnology = chosen;
        this.activeFrameworkData = undefined;
        const lines = [
            '# ✅ Technology Selected\n',
            `**Name:** ${chosen.title}`,
            `**Identifier:** ${chosen.identifier}`,
            '',
            '## Next actions',
            '• `search_symbols { "query": "keyword" }` — fuzzy search within this framework',
            '• `get_documentation { "path": "SymbolName" }` — open a symbol page',
            '• `discover_technologies` — pick another framework',
        ];
        return {
            content: [
                {
                    text: lines.join('\n'),
                    type: 'text',
                },
            ],
        };
    }
    async handleCurrentTechnology() {
        if (!this.activeTechnology) {
            return this.formatNoTechnologyMessage();
        }
        const tech = this.activeTechnology;
        const lines = [
            '# 📘 Current Technology\n',
            `**Name:** ${tech.title}`,
            `**Identifier:** ${tech.identifier}`,
            '',
            '## Next actions',
            '• `search_symbols { "query": "keyword" }` to find symbols',
            '• `get_documentation { "path": "SymbolName" }` to open docs',
            '• `choose_technology "Another Framework"` to switch',
        ];
        return {
            content: [
                {
                    text: lines.join('\n'),
                    type: 'text',
                },
            ],
        };
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    description: 'Explore and filter available Apple technologies/frameworks before choosing one',
                    inputSchema: {
                        properties: {
                            page: {
                                description: 'Optional page number (default 1)',
                                type: 'number',
                            },
                            pageSize: {
                                description: 'Optional page size (default 25, max 100)',
                                type: 'number',
                            },
                            query: {
                                description: 'Optional keyword to filter technologies',
                                type: 'string',
                            },
                        },
                        required: [],
                        type: 'object',
                    },
                    name: 'discover_technologies',
                },
                {
                    description: 'Select the framework/technology to scope all subsequent searches and documentation lookups',
                    inputSchema: {
                        properties: {
                            identifier: {
                                description: 'Optional technology identifier (e.g. doc://.../SwiftUI)',
                                type: 'string',
                            },
                            name: {
                                description: 'Technology name/title (e.g. SwiftUI)',
                                type: 'string',
                            },
                        },
                        required: [],
                        type: 'object',
                    },
                    name: 'choose_technology',
                },
                {
                    description: 'Report the currently selected technology and how to change it',
                    inputSchema: {
                        properties: {},
                        required: [],
                        type: 'object',
                    },
                    name: 'current_technology',
                },
                {
                    description: 'Get detailed documentation for symbols within the selected technology (accepts relative symbol names)',
                    inputSchema: {
                        properties: {
                            path: {
                                description: 'Symbol path or relative name (e.g. "View")',
                                type: 'string',
                            },
                        },
                        required: ['path'],
                        type: 'object',
                    },
                    name: 'get_documentation',
                },
                {
                    description: 'Search symbols within the currently selected technology (supports fuzzy keywords)',
                    inputSchema: {
                        properties: {
                            maxResults: {
                                description: 'Optional maximum number of results (default 20)',
                                type: 'number',
                            },
                            platform: {
                                description: 'Optional platform filter (iOS, macOS, etc.)',
                                type: 'string',
                            },
                            query: {
                                description: 'Search keywords (supports wildcards)',
                                type: 'string',
                            },
                            symbolType: {
                                description: 'Optional symbol kind filter (class, protocol, etc.)',
                                type: 'string',
                            },
                        },
                        required: ['query'],
                        type: 'object',
                    },
                    name: 'search_symbols',
                },
                {
                    description: 'Check for available updates from the git repository',
                    inputSchema: {
                        properties: {},
                        required: [],
                        type: 'object',
                    },
                    name: 'check_updates',
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case 'discover_technologies': {
                        return await this.handleDiscoverTechnologies(request.params.arguments);
                    }
                    case 'choose_technology': {
                        return await this.handleChooseTechnology(request.params.arguments);
                    }
                    case 'current_technology': {
                        return await this.handleCurrentTechnology();
                    }
                    case 'check_updates': {
                        return await this.handleCheckUpdates();
                    }
                    case 'get_documentation': {
                        return await this.handleGetDocumentation(request.params.arguments);
                    }
                    case 'search_symbols': {
                        return await this.handleSearchSymbols(request.params.arguments);
                    }
                    default: {
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                    }
                }
            }
            catch (error) {
                throw new McpError(ErrorCode.InternalError, `Error executing tool: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
}
const server = new AppleDevDocsMcpServer();
await server.run();
//# sourceMappingURL=index.js.map