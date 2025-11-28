import { header, bold, trimWithEllipsis } from '../markdown.js';
import { buildNoTechnologyMessage } from './no-technology.js';
// Format symbol kind with display name
const formatKind = (kind) => {
    const kindMap = {
        class: 'Class',
        struct: 'Structure',
        protocol: 'Protocol',
        enum: 'Enumeration',
        func: 'Function',
        method: 'Method',
        property: 'Property',
        var: 'Variable',
        typealias: 'Type Alias',
        init: 'Initializer',
        deinit: 'Deinitializer',
        subscript: 'Subscript',
        operator: 'Operator',
        macro: 'Macro',
        symbol: 'Symbol',
    };
    return kindMap[kind.toLowerCase()] ?? kind;
};
// Extract parent context from path (e.g., "SwiftUI.View" from full path)
const extractParentContext = (path, title) => {
    const parts = path.split('/');
    // Find the symbol in the path and get its parent
    const symbolIndex = parts.indexOf(title);
    if (symbolIndex > 1) {
        return parts[symbolIndex - 1];
    }
    return undefined;
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
        // Get or create technology-specific local index from state
        const techLocalIndex = state.getLocalSymbolIndex(client);
        // Build local index from cached files if not already built
        if (techLocalIndex.getSymbolCount() === 0) {
            try {
                console.error('📚 Building symbol index from cache...');
                await techLocalIndex.buildIndexFromCache();
                console.error(`✅ Index built with ${techLocalIndex.getSymbolCount()} symbols`);
            }
            catch (error) {
                console.warn('Failed to build local symbol index:', error instanceof Error ? error.message : String(error));
            }
        }
        // Comprehensive download disabled - it was broken and blocking
        // If local index is empty/small, use direct framework search as fallback
        let symbolResults = techLocalIndex.search(query, maxResults * 2);
        if (symbolResults.length === 0 && techLocalIndex.getSymbolCount() < 50) {
            // Fallback: search framework.references directly (fast, no download needed)
            console.error('📋 Using framework references for search...');
            const frameworkResults = await client.searchFramework(activeTechnology.title, query, { maxResults: maxResults * 2, platform, symbolType });
            symbolResults = frameworkResults.map(r => ({
                id: r.path ?? r.title,
                title: r.title,
                path: r.path ?? '',
                kind: r.symbolKind ?? 'symbol',
                abstract: r.description,
                platforms: r.platforms ? r.platforms.split(', ') : [],
                tokens: [],
                filePath: '',
            }));
        }
        // Apply filters
        let filteredResults = symbolResults;
        if (platform) {
            const platformLower = platform.toLowerCase();
            filteredResults = filteredResults.filter(result => result.platforms.some(p => p.toLowerCase().includes(platformLower)));
        }
        if (symbolType) {
            const typeLower = symbolType.toLowerCase();
            filteredResults = filteredResults.filter(result => result.kind.toLowerCase().includes(typeLower));
        }
        filteredResults = filteredResults.slice(0, maxResults);
        // Validate result relevance
        const technologyIdentifier = activeTechnology.identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, '');
        const isRelevantResult = (result) => {
            const resultPath = result.path.toLowerCase();
            const technologyPath = technologyIdentifier.toLowerCase();
            return resultPath.includes(technologyPath);
        };
        const relevantResults = filteredResults.filter(result => isRelevantResult(result));
        const hasIrrelevantResults = relevantResults.length < filteredResults.length;
        const lines = [
            header(1, `🔍 Search Results for "${query}"`),
            '',
            bold('Technology', activeTechnology.title),
            bold('Matches', filteredResults.length.toString()),
            bold('Total Symbols Indexed', techLocalIndex.getSymbolCount().toString()),
            '',
        ];
        // Add status information
        if (techLocalIndex.getSymbolCount() < 50) {
            lines.push('⚠️ **Limited Results:** Only basic symbols are indexed.', 'For comprehensive results, additional symbols are being downloaded in the background.', '');
        }
        else {
            lines.push('✅ **Comprehensive Index:** Full symbol database is available.', '');
        }
        lines.push(header(2, 'Symbols'), '');
        // Show warning if results seem irrelevant
        if (hasIrrelevantResults && filteredResults.length > 0) {
            lines.push('⚠️ **Note:** Some results may not be from the selected technology.', 'For specific symbol names, try using `get_documentation` instead.', '');
        }
        if (filteredResults.length > 0) {
            for (const result of filteredResults) {
                const kindDisplay = formatKind(result.kind);
                const platforms = result.platforms.length > 0 ? result.platforms.join(', ') : 'All platforms';
                const parentContext = extractParentContext(result.path, result.title);
                const titleDisplay = parentContext ? `${parentContext}.${result.title}` : result.title;
                const abstractDisplay = result.abstract ? trimWithEllipsis(result.abstract, 150) : '';
                lines.push(`### ${titleDisplay}`, `\`${kindDisplay}\` • ${platforms}`, '', abstractDisplay, '', `📄 \`${result.path}\``, '');
            }
        }
        else {
            // Check if this looks like a specific symbol name that should use direct documentation lookup
            const isSpecificSymbol = /^[A-Z][a-zA-Z\d]*$/.test(query) || /^[A-Z][a-zA-Z\d]*\.[A-Z][a-zA-Z\d]*$/.test(query);
            lines.push('No symbols matched those terms within this technology.', '', '**Search Tips:**', '• Try wildcards: `Grid*` or `*Item`', '• Use broader keywords: "grid" instead of "griditem"', '• Check spelling and try synonyms', '');
            if (isSpecificSymbol) {
                lines.push('**💡 Suggestion:** This looks like a specific symbol name.', 'Try using `get_documentation` instead for direct access:', '', '```', `get_documentation { "path": "${query}" }`, '```', '');
            }
            lines.push('**Note:** If this is your first search, symbols are being downloaded in the background.', 'Try searching again in a few moments for more comprehensive results.', '');
        }
        return {
            content: [{ text: lines.join('\n'), type: 'text' }],
        };
    };
};
//# sourceMappingURL=search-symbols.js.map