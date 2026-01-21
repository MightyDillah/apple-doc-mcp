import type { ServerContext, ToolResponse } from '../context.js';
type SearchArgs = {
    maxResults?: number;
    platform?: string;
    query: string;
    symbolType?: string;
};
export declare const buildSearchSymbolsHandler: (context: ServerContext) => (args: SearchArgs) => Promise<ToolResponse>;
export {};
