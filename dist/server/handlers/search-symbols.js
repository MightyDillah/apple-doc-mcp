import { buildNoTechnologyMessage } from './no-technology.js';
import { ensureFrameworkIndex, expandSymbolReferences, loadActiveFrameworkData, } from '../services/framework-loader.js';
import { header, bold, trimWithEllipsis } from '../markdown.js';
const scoreEntry = (entry, terms) => {
    let score = 0;
    for (const term of terms) {
        if (entry.tokens.includes(term)) {
            score += 3;
        }
        else if (entry.tokens.some(token => token.includes(term))) {
            score += 1;
        }
    }
    return score;
};
const collectMatches = (entries, query, maxResults, filters) => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const ranked = [];
    for (const entry of entries) {
        const score = scoreEntry(entry, terms);
        if (score <= 0) {
            continue;
        }
        if (filters.symbolType && entry.ref.kind?.toLowerCase() !== filters.symbolType.toLowerCase()) {
            continue;
        }
        if (filters.platform) {
            const platformLower = filters.platform.toLowerCase();
            if (!entry.ref.platforms?.some(p => p.name?.toLowerCase().includes(platformLower))) {
                continue;
            }
        }
        ranked.push({ id: entry.id, ref: entry.ref, score });
    }
    return ranked
        .sort((a, b) => b.score - a.score || (a.ref.title ?? '').localeCompare(b.ref.title ?? ''))
        .slice(0, maxResults);
};
const performHierarchicalSearch = async (context, query, frameworkName, maxResults) => {
    const { client } = context;
    const results = [];
    const lowerQuery = query.toLowerCase();
    try {
        const framework = await loadActiveFrameworkData(context);
        // Search through all references with path-based matching
        for (const [id, ref] of Object.entries(framework.references)) {
            if (results.length >= maxResults) {
                break;
            }
            const title = ref.title ?? '';
            const url = ref.url ?? '';
            const abstractText = client.extractText(ref.abstract ?? []);
            // Check for hierarchical path matches (e.g., "tabbar" in "toolbarplacement/tabbar")
            const pathParts = url.toLowerCase().split('/');
            const titleMatch = title.toLowerCase().includes(lowerQuery);
            const pathMatch = pathParts.some(part => part.includes(lowerQuery));
            const abstractMatch = abstractText.toLowerCase().includes(lowerQuery);
            if (titleMatch || pathMatch || abstractMatch) {
                results.push({
                    title: ref.title ?? 'Symbol',
                    framework: frameworkName,
                    path: ref.url,
                    description: abstractText,
                    kind: ref.kind,
                    platforms: client.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
                    foundVia: titleMatch ? 'direct' : pathMatch ? 'hierarchical' : 'direct',
                });
            }
        }
        // If still no results, try expanding more identifiers
        if (results.length === 0) {
            const allIdentifiers = framework.topicSections.flatMap(section => section.identifiers ?? []);
            const batchSize = 50; // Process in batches to avoid overwhelming the API
            for (let i = 0; i < allIdentifiers.length && results.length < maxResults; i += batchSize) {
                const batch = allIdentifiers.slice(i, i + batchSize);
                const expandedIndex = await expandSymbolReferences(context, batch);
                for (const [id, entry] of expandedIndex.entries()) {
                    if (results.length >= maxResults)
                        break;
                    const title = entry.ref.title ?? '';
                    const url = entry.ref.url ?? '';
                    const pathParts = url.toLowerCase().split('/');
                    if (title.toLowerCase().includes(lowerQuery) ||
                        pathParts.some(part => part.includes(lowerQuery))) {
                        const abstractText = client.extractText(entry.ref.abstract ?? []);
                        results.push({
                            title: entry.ref.title ?? 'Symbol',
                            framework: frameworkName,
                            path: entry.ref.url,
                            description: abstractText,
                            kind: entry.ref.kind,
                            platforms: client.formatPlatforms(entry.ref.platforms ?? []),
                            foundVia: 'hierarchical',
                        });
                    }
                }
            }
        }
    }
    catch (error) {
        console.warn(`Hierarchical search failed for ${frameworkName}:`, error instanceof Error ? error.message : String(error));
    }
    return results;
};
const performRegexSearch = async (context, query, frameworkName, maxResults) => {
    const { client } = context;
    const results = [];
    try {
        const framework = await loadActiveFrameworkData(context);
        // Create fuzzy regex pattern from query
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fuzzyPattern = escapedQuery.split('').join('.*?');
        const regex = new RegExp(fuzzyPattern, 'i');
        for (const [id, ref] of Object.entries(framework.references)) {
            if (results.length >= maxResults) {
                break;
            }
            const title = ref.title ?? '';
            const url = ref.url ?? '';
            const abstractText = client.extractText(ref.abstract ?? []);
            if (regex.test(title) || regex.test(url) || regex.test(abstractText)) {
                results.push({
                    title: ref.title ?? 'Symbol',
                    framework: frameworkName,
                    path: ref.url,
                    description: abstractText,
                    kind: ref.kind,
                    platforms: client.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
                    foundVia: 'regex',
                });
            }
        }
    }
    catch (error) {
        console.warn(`Regex search failed for ${frameworkName}:`, error instanceof Error ? error.message : String(error));
    }
    return results;
};
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
        let entries = Array.from(index.values());
        let matches = collectMatches(entries, query, maxResults * 2, { platform, symbolType });
        if (matches.length === 0) {
            const framework = await loadActiveFrameworkData(context);
            const nestedIdentifiers = framework.topicSections.flatMap(section => section.identifiers ?? []).slice(0, 200);
            if (nestedIdentifiers.length > 0) {
                index = await expandSymbolReferences(context, nestedIdentifiers);
                entries = Array.from(index.values());
                matches = collectMatches(entries, query, maxResults * 2, { platform, symbolType });
            }
        }
        let fallbackResults = [];
        let usedFallback = false;
        if (matches.length === 0) {
            usedFallback = true;
            // Try hierarchical search first
            try {
                fallbackResults = await performHierarchicalSearch(context, query, activeTechnology.title, maxResults);
            }
            catch (error) {
                console.warn(`Hierarchical search failed for ${activeTechnology.title}:`, error instanceof Error ? error.message : String(error));
            }
            // If still no results, try regex search as final fallback
            if (fallbackResults.length === 0) {
                try {
                    fallbackResults = await performRegexSearch(context, query, activeTechnology.title, maxResults);
                }
                catch (error) {
                    console.warn(`Regex search failed for ${activeTechnology.title}:`, error instanceof Error ? error.message : String(error));
                }
            }
            // If all advanced searches fail, try the original simple search
            if (fallbackResults.length === 0) {
                try {
                    const simpleResults = await client.searchFramework(activeTechnology.title, query, { maxResults, platform, symbolType });
                    fallbackResults = simpleResults.map(result => ({
                        ...result,
                        foundVia: 'direct',
                    }));
                }
                catch (error) {
                    console.warn(`Simple fallback search failed for ${activeTechnology.title}:`, error instanceof Error ? error.message : String(error));
                }
            }
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
        for (const match of matches) {
            lines.push(`### ${match.ref.title}`);
            if (match.ref.kind) {
                lines.push(`   • **Kind:** ${match.ref.kind}`);
            }
            lines.push(`   • **Path:** ${match.ref.url}`);
            const abstractText = client.extractText(match.ref.abstract ?? []);
            if (abstractText) {
                lines.push(`   ${trimWithEllipsis(abstractText, 180)}`);
            }
            lines.push('');
        }
        if (matches.length === 0) {
            lines.push('No symbols matched those terms within this technology.');
            lines.push('Try broader keywords (e.g. "tab" instead of "tabbar"), explore synonyms ("sheet" vs "modal"), or inspect sections in `discover_technologies`.');
        }
        if (usedFallback && fallbackResults.length > 0) {
            const hierarchicalCount = fallbackResults.filter(r => r.foundVia === 'hierarchical').length;
            const regexCount = fallbackResults.filter(r => r.foundVia === 'regex').length;
            const directCount = fallbackResults.filter(r => r.foundVia === 'direct').length;
            let fallbackTitle = 'Advanced Search Results';
            if (hierarchicalCount > 0) {
                fallbackTitle += ` (${hierarchicalCount} hierarchical`;
                if (regexCount > 0)
                    fallbackTitle += `, ${regexCount} fuzzy`;
                if (directCount > 0)
                    fallbackTitle += `, ${directCount} direct`;
                fallbackTitle += ')';
            }
            else if (regexCount > 0) {
                fallbackTitle += ` (${regexCount} fuzzy matches)`;
            }
            else {
                fallbackTitle += ` (${directCount} direct matches)`;
            }
            lines.push(header(2, fallbackTitle));
            for (const result of fallbackResults) {
                lines.push(`### ${result.title}`);
                if (result.kind) {
                    lines.push(`   • **Kind:** ${result.kind}`);
                }
                lines.push(`   • **Path:** ${result.path}`);
                lines.push(`   • **Found via:** ${result.foundVia} search`);
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
        }
        return {
            content: [{ text: lines.join('\n'), type: 'text' }],
        };
    };
};
//# sourceMappingURL=search-symbols.js.map