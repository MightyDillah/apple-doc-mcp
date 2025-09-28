import type { ServerContext, ToolResponse } from '../context.js';
export declare const buildDiscoverHandler: ({ client, state }: ServerContext) => (args: {
    query?: string;
    page?: number;
    pageSize?: number;
}) => Promise<ToolResponse>;
