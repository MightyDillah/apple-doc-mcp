import type { ServerContext, ToolResponse } from '../context.js';
export declare const buildGetDocumentationHandler: (context: ServerContext) => ({ path }: {
    path: string;
}) => Promise<ToolResponse>;
