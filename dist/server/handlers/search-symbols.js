import { header, bold } from '../markdown.js';
import { resolveSymbol } from '../services/symbol-resolution.js';
import { buildNoTechnologyMessage } from './no-technology.js';
const looksLikeExactSymbol = (query) => {
    if (query.includes('*') || query.includes('?') || query.includes(' ')) {
        return false;
    }
    return (/^[A-Z][a-zA-Z\d]*(?:[./][A-Z][a-zA-Z\d]*)*$/.test(query) ||
        query.startsWith('documentation/'));
};
const getQueryMode = (query) => {
    if (query.includes('*') || query.includes('?')) {
        return 'wildcard';
    }
    if (looksLikeExactSymbol(query)) {
        return 'exact-symbol';
    }
    return 'keyword';
};
const isArticleKind = (kind) => {
    const normalizedKind = kind.toLowerCase();
    return (normalizedKind === 'article' ||
        normalizedKind === 'overview' ||
        normalizedKind === 'tutorial');
};
const toSearchMatch = (result, score) => ({
    abstract: result.abstract,
    kind: result.kind,
    path: result.path,
    platforms: result.platforms,
    score,
    source: 'local-index',
    title: result.title,
    type: isArticleKind(result.kind) ? 'article' : 'symbol',
});
const mergeMatches = (matches) => {
    const deduped = new Map();
    for (const match of matches.sort((a, b) => b.score - a.score)) {
        const key = `${match.type}:${match.title.toLowerCase()}`;
        const existing = deduped.get(key);
        if (!existing ||
            match.score > existing.score ||
            (existing.path.length === 0 && match.path.length > 0)) {
            deduped.set(key, match);
        }
    }
    return [...deduped.values()];
};
const formatMatch = (match) => {
    const platforms = match.platforms.length > 0 ? match.platforms.join(', ') : 'All platforms';
    return [
        `### ${match.title}`,
        `   • **Kind:** ${match.kind}`,
        `   • **Path:** ${match.path}`,
        `   • **Platforms:** ${platforms}`,
        `   ${match.abstract}`,
        '',
    ];
};
const formatNoResults = (queryMode) => {
    const lines = [
        'No matching symbols or related documentation were found for this query.',
        '',
        '**Search Tips:**',
    ];
    if (queryMode === 'exact-symbol') {
        lines.push('• Check the exact symbol spelling and casing', '• Try a wildcard query such as `Grid*` or `*Style`', '• Try a broader keyword such as `grid` or `button style`');
    }
    else if (queryMode === 'wildcard') {
        lines.push('• Keep `*` and `?` to symbol names or short prefixes', '• Try a broader wildcard such as `Lazy*` or `*Item`', '• Remove wildcards and retry as a keyword search');
    }
    else {
        lines.push('• Try an exact API name such as `ButtonStyle` or `GridItem`', '• Try a wildcard query such as `Grid*` or `*Style`', '• Try related terms or a shorter keyword');
    }
    return lines;
};
const buildExactMatchResponse = (client, technologyTitle, query, queryMode, data, targetPath) => {
    const exactPlatforms = data.metadata?.platforms?.map((item) => item.name).filter(Boolean) ?? [];
    const exactKind = data.metadata?.symbolKind ?? 'symbol';
    const lines = [
        header(1, `🔍 Search Results for "${query}"`),
        '',
        bold('Technology', technologyTitle),
        bold('Query Mode', queryMode),
        bold('Search Source', 'exact-resolution'),
        bold('Symbol Matches', '1'),
        bold('Article Matches', '0'),
        '',
        header(2, 'Exact Match'),
        '',
        ...formatMatch({
            abstract: client.extractText(data.abstract),
            kind: exactKind,
            path: targetPath,
            platforms: exactPlatforms,
            score: 1_000,
            source: 'exact-resolution',
            title: data.metadata?.title ?? query,
            type: 'symbol',
        }),
    ];
    return {
        content: [{ text: lines.join('\n'), type: 'text' }],
    };
};
const matchesExactFilters = (platforms, kind, platform, symbolType) => {
    const platformMatches = !platform ||
        platforms.some((item) => item.toLowerCase().includes(platform.toLowerCase()));
    const symbolTypeMatches = !symbolType || kind.toLowerCase().includes(symbolType.toLowerCase());
    return platformMatches && symbolTypeMatches;
};
const tryExactSymbolMatch = async (client, activeTechnology, query, queryMode, platform, symbolType) => {
    if (queryMode !== 'exact-symbol') {
        return undefined;
    }
    try {
        const { data, targetPath } = await resolveSymbol(client, activeTechnology, query);
        const exactPlatforms = data.metadata?.platforms?.map((item) => item.name).filter(Boolean) ?? [];
        const exactKind = data.metadata?.symbolKind ?? 'symbol';
        if (!matchesExactFilters(exactPlatforms, exactKind, platform, symbolType)) {
            return undefined;
        }
        return buildExactMatchResponse(client, activeTechnology.title, query, queryMode, data, targetPath);
    }
    catch {
        return undefined;
    }
};
const ensureLocalIndexReady = async (techLocalIndex) => {
    if (techLocalIndex.getSymbolCount() > 0) {
        return;
    }
    console.error('📚 Building symbol index from cache...');
    await techLocalIndex.buildIndexFromCache();
    console.error(`✅ Index built with ${techLocalIndex.getSymbolCount()} symbols`);
};
const buildFrameworkMatches = async (client, technologyTitle, query, maxResults, platform, symbolType) => {
    const results = await client.searchFramework(technologyTitle, query, {
        maxResults: maxResults * 4,
        platform,
        symbolType,
    });
    return results.map((result, index) => ({
        abstract: result.description,
        kind: result.symbolKind ?? 'symbol',
        path: result.path ?? '',
        platforms: result.platforms ? result.platforms.split(', ') : [],
        score: 500 - index,
        source: 'framework-references',
        title: result.title,
        type: isArticleKind(result.symbolKind ?? 'symbol') ? 'article' : 'symbol',
    }));
};
const buildSearchResponse = (query, technologyTitle, queryMode, sources, cachedSymbols, symbolResults, articleResults) => {
    const lines = [
        header(1, `🔍 Search Results for "${query}"`),
        '',
        bold('Technology', technologyTitle),
        bold('Query Mode', queryMode),
        bold('Search Sources', [...sources].join(', ')),
        bold('Cached Symbols', cachedSymbols.toString()),
        bold('Symbol Matches', symbolResults.length.toString()),
        bold('Article Matches', articleResults.length.toString()),
        '',
    ];
    if (cachedSymbols === 0) {
        lines.push('Using framework references because there are no cached symbols for this technology yet.', '');
    }
    else {
        lines.push('Local cached symbols were merged with framework references for a symbol-first result set.', '');
    }
    if (symbolResults.length > 0) {
        lines.push(header(2, 'Symbols'), '');
        for (const result of symbolResults) {
            lines.push(...formatMatch(result));
        }
    }
    if (articleResults.length > 0) {
        lines.push(header(2, 'Articles and Guides'), '');
        for (const result of articleResults) {
            lines.push(...formatMatch(result));
        }
    }
    if (symbolResults.length === 0 && articleResults.length === 0) {
        lines.push(...formatNoResults(queryMode), '');
    }
    return {
        content: [{ text: lines.join('\n'), type: 'text' }],
    };
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
        const queryMode = getQueryMode(query);
        const sources = new Set();
        const exactMatchResponse = await tryExactSymbolMatch(client, activeTechnology, query, queryMode, platform, symbolType);
        if (exactMatchResponse) {
            return exactMatchResponse;
        }
        // Get or create technology-specific local index from state
        const techLocalIndex = state.getLocalSymbolIndex(client);
        // Build local index from cached files if not already built
        if (techLocalIndex.getSymbolCount() === 0) {
            try {
                await ensureLocalIndexReady(techLocalIndex);
            }
            catch (error) {
                console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
            }
        }
        const localMatches = techLocalIndex
            .search(query, maxResults * 4)
            .map((result, index) => toSearchMatch(result, 700 - index));
        if (localMatches.length > 0) {
            sources.add('local-index');
        }
        const frameworkMatches = await buildFrameworkMatches(client, activeTechnology.title, query, maxResults, platform, symbolType);
        sources.add('framework-references');
        const mergedResults = mergeMatches([...localMatches, ...frameworkMatches]);
        const symbolResults = mergedResults
            .filter((result) => result.type === 'symbol')
            .slice(0, maxResults);
        const articleResults = mergedResults
            .filter((result) => result.type === 'article')
            .slice(0, maxResults);
        return buildSearchResponse(query, activeTechnology.title, queryMode, sources, techLocalIndex.getSymbolCount(), symbolResults, articleResults);
    };
};
//# sourceMappingURL=search-symbols.js.map