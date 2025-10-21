import type { ServerContext, ToolResponse } from '../context.js';
export declare const buildNoTechnologyMessage: ({ client, state }: ServerContext) => () => Promise<ToolResponse>;
