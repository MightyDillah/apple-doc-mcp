import {trimWithEllipsis} from '../../../markdown.js';
import type {RankedReference} from '../types.js';
import type {ServerContext} from '../../../context.js';

export const buildMatchLines = (matches: RankedReference[], client: ServerContext['client']): string[] => {
	const lines: string[] = [];

	for (const match of matches) {
		lines.push(`### ${match.ref.title}`);
		if (match.ref.kind) {
			lines.push(`   • **Kind:** ${match.ref.kind}`);
		}

		lines.push(`   • **Path:** ${match.ref.url}`);
		const abstractText: string = client.extractText(match.ref.abstract ?? []);
		if (abstractText) {
			lines.push(`   ${trimWithEllipsis(abstractText, 180)}`);
		}

		lines.push('');
	}

	return lines;
};
