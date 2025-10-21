import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';
import {ServerState} from '../state.js';

const fuzzyScore = (a: string | undefined, b: string | undefined): number => {
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
};

const ensureFramework = (technology: {kind?: string; role?: string; title?: string}): void => {
	if (technology.kind !== 'symbol' || technology.role !== 'collection') {
		throw new McpError(
			ErrorCode.InvalidRequest,
			`${technology.title ?? 'Unknown technology'} is not a framework collection. Please choose a framework technology instead.`,
		);
	}
};

export const buildChooseTechnologyHandler = ({client, state}: ServerContext) =>
	async (args: {name?: string; identifier?: string}): Promise<ToolResponse> => {
		const {name, identifier} = args;
		const technologies = await client.getTechnologies();
		const candidates = Object.values(technologies).filter(tech => typeof tech?.title === 'string' && typeof tech?.identifier === 'string');

		// Normalize search terms - case insensitive
		const normalizedName = name?.toLowerCase().trim();
		const normalizedIdentifier = identifier?.toLowerCase().trim();

		let chosen: typeof candidates[0] | undefined = undefined;

		// Try identifier first (most specific)
		if (normalizedIdentifier) {
			chosen = candidates.find(tech => tech.identifier?.toLowerCase() === normalizedIdentifier);
		}

		// Try exact name match (case-insensitive)
		if (!chosen && normalizedName) {
			chosen = candidates.find(tech => tech.title?.toLowerCase() === normalizedName);
		}

		// Try fuzzy match on name only if we have a name
		if (!chosen && normalizedName) {
			const scored = candidates
				.map(tech => ({tech, score: fuzzyScore(tech.title, name)}))
				.sort((a, b) => a.score - b.score);
			// Only use fuzzy match if it's reasonably good (score < 3)
			if (scored[0] && scored[0].score < 3) {
				chosen = scored[0].tech;
			}
		}

		if (!chosen) {
			const searchTerm = normalizedName ?? normalizedIdentifier ?? '';
			const suggestions = candidates
				.filter(tech => tech.title?.toLowerCase().includes(searchTerm))
				.slice(0, 5)
				.map(tech => `• ${tech.title} — \`choose_technology "${tech.title}"\``);

			const lines = [
				header(1, '❌ Technology Not Found'),
				`Could not resolve "${name ?? identifier ?? 'unknown'}".`,
				'',
				header(2, 'Suggestions'),
				...(suggestions.length > 0
					? suggestions
					: ['• Use `discover_technologies { "query": "keyword" }` to find candidates']),
			];

			return {
				content: [{text: lines.join('\n'), type: 'text'}],
			};
		}

		ensureFramework(chosen);
		state.setActiveTechnology(chosen);
		state.clearActiveFrameworkData();

		const lines = [
			header(1, '✅ Technology Selected'),
			'',
			bold('Name', chosen.title),
			bold('Identifier', chosen.identifier ?? 'Unknown'),
			'',
			header(2, 'Next actions'),
			'• `search_symbols { "query": "keyword" }` — fuzzy search within this framework',
			'• `get_documentation { "path": "SymbolName" }` — open a symbol page',
			'• `discover_technologies` — pick another framework',
		];

		return {
			content: [{text: lines.join('\n'), type: 'text'}],
		};
	};

