#!/usr/bin/env node

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './server/app.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Apple Developer Documentation MCP server running on stdio');
