import {header, trimWithEllipsis} from '../../../markdown.js';
import type {HierarchicalSearchResult} from '../types.js';

export const buildFallbackTitle = (fallbackResults: HierarchicalSearchResult[]): string => {
	const hierarchicalCount = fallbackResults.filter(r => r.foundVia === 'hierarchical').length;
	const regexCount = fallbackResults.filter(r => r.foundVia === 'regex').length;
	const directCount = fallbackResults.filter(r => r.foundVia === 'direct').length;

	let fallbackTitle = 'Advanced Search Results';
	if (hierarchicalCount > 0) {
		fallbackTitle += ` (${hierarchicalCount} hierarchical`;
		if (regexCount > 0) {
			fallbackTitle += `, ${regexCount} fuzzy`;
		}

		if (directCount > 0) {
			fallbackTitle += `, ${directCount} direct`;
		}

		fallbackTitle += ')';
	} else if (regexCount > 0) {
		fallbackTitle += ` (${regexCount} fuzzy matches)`;
	} else {
		fallbackTitle += ` (${directCount} direct matches)`;
	}

	return fallbackTitle;
};

export const buildFallbackLines = (fallbackResults: HierarchicalSearchResult[]): string[] => {
	const lines: string[] = [];
	const hierarchicalCount = fallbackResults.filter(r => r.foundVia === 'hierarchical').length;
	const regexCount = fallbackResults.filter(r => r.foundVia === 'regex').length;

	const fallbackTitle = buildFallbackTitle(fallbackResults);
	lines.push(header(2, fallbackTitle));

	for (const result of fallbackResults) {
		lines.push(`### ${result.title}`);
		if (result.kind) {
			lines.push(`   • **Kind:** ${result.kind}`);
		}

		lines.push(`   • **Path:** ${result.path}`, `   • **Found via:** ${result.foundVia} search`);
		if (result.platforms) {
			lines.push(`   • **Platforms:** ${result.platforms}`);
		}

		if (result.description) {
			lines.push(`   ${trimWithEllipsis(result.description, 180)}`);
		}

		lines.push('');
	}

	if (hierarchicalCount > 0) {
		lines.push('🔍 **Hierarchical results** include symbols found in nested paths (e.g., "tabbar" found in "toolbarplacement/tabbar").');
	}

	if (regexCount > 0) {
		lines.push('🎯 **Fuzzy results** include partial character matches across symbol names and paths.');
	}

	return lines;
};
