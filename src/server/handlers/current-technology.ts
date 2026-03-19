import type { ServerContext, ToolResponse } from '../context.js';
import { bold, header } from '../markdown.js';
import { buildNoTechnologyMessage } from './no-technology.js';

export const buildCurrentTechnologyHandler = (context: ServerContext) => {
	const noTechnology = buildNoTechnologyMessage(context);

	return async (): Promise<ToolResponse> => {
		const active = context.state.getActiveTechnology();
		if (!active) {
			return noTechnology();
		}

		const lines = [
			header(1, '📘 Current Technology'),
			'',
			bold('Name', active.title),
			bold('Identifier', active.identifier),
			'',
			header(2, 'Next actions'),
			'• `search_symbols { "query": "keyword" }` to search symbols and related docs',
			'• `get_documentation { "path": "SymbolName" }` to open docs',
			'• `choose_technology "Another Framework"` to switch',
		];

		return {
			content: [{ text: lines.join('\n'), type: 'text' }],
		};
	};
};
