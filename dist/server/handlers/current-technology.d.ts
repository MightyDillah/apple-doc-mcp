import type { ServerContext, ToolResponse } from '../context.js';
export declare const buildCurrentTechnologyHandler: (context: ServerContext) => () => Promise<ToolResponse>;
