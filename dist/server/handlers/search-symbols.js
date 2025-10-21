import { ensureFrameworkIndex, expandSymbolReferences, loadActiveFrameworkData } from '../services/framework-loader.js';
import { header, bold } from '../markdown.js';
import { buildNoTechnologyMessage } from './no-technology.js';
import { collectMatches } from './search/scoring.js';
import { performFallbackSearches } from './search/strategies/fallback-search.js';
import { buildMatchLines } from './search/formatters/match-formatter.js';
import { buildFallbackLines } from './search/formatters/fallback-formatter.js';
export const buildSearchSymbolsHandler = (context) => {
    const { client, state } = context;
    const noTechnology = buildNoTechnologyMessage(context);
    return async (args) => {
        const activeTechnology = state.getActiveTechnology();
        if (!activeTechnology) {
            return noTechnology();
        }
        const { query, maxResults = 20, platform, symbolType } = args;
        let index = await ensureFrameworkIndex(context);
        let entries = [...index.values()];
        const filters = { platform, symbolType };
        let matches = collectMatches(entries, query, maxResults * 2, filters);
        if (matches.length === 0) {
            const framework = await loadActiveFrameworkData(context);
            // Expand more comprehensive set of identifiers for better coverage
            const nestedIdentifiers = framework.topicSections
                .flatMap(section => section.identifiers ?? [])
                .slice(0, 300); // Increased from 200 for better coverage
            if (nestedIdentifiers.length > 0) {
                index = await expandSymbolReferences(context, nestedIdentifiers);
                entries = [...index.values()];
                matches = collectMatches(entries, query, maxResults * 2, filters);
            }
        }
        let fallbackResults = [];
        let usedFallback = false;
        if (matches.length === 0) {
            usedFallback = true;
            fallbackResults = await performFallbackSearches(context, query, activeTechnology, { maxResults, platform, symbolType });
        }
        matches = matches.slice(0, maxResults);
        const lines = [
            header(1, `🔍 Search Results for "${query}"`),
            '',
            bold('Technology', activeTechnology.title),
            bold('Matches', matches.length.toString()),
            '',
            header(2, 'Symbols'),
            '',
        ];
        lines.push(...buildMatchLines(matches, client));
        if (matches.length === 0) {
            lines.push('No symbols matched those terms within this technology.', 'Try broader keywords (e.g. "tab" instead of "tabbar"), explore synonyms ("sheet" vs "modal"), or inspect sections in `discover_technologies`.');
        }
        if (usedFallback && fallbackResults.length > 0) {
            lines.push(...buildFallbackLines(fallbackResults));
        }
        return {
            content: [{ text: lines.join('\n'), type: 'text' }],
        };
    };
};
//# sourceMappingURL=search-symbols.js.map