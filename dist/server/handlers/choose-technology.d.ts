import type { ServerContext, ToolResponse } from '../context.js';
export declare const buildChooseTechnologyHandler: ({ client, state }: ServerContext) => (args: {
    name?: string;
    identifier?: string;
}) => Promise<ToolResponse>;
