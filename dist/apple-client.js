import { HttpClient } from './apple-client/http-client.js';
import { FileCache } from './apple-client/cache/file-cache.js';
import { extractText, formatPlatforms } from './apple-client/formatters.js';
export class AppleDevDocsClient {
    // Expose formatter methods for backward compatibility
    extractText = extractText;
    formatPlatforms = formatPlatforms;
    httpClient;
    fileCache;
    constructor() {
        this.httpClient = new HttpClient();
        this.fileCache = new FileCache();
    }
    async getFramework(frameworkName) {
        const cached = await this.fileCache.loadFramework(frameworkName);
        if (cached) {
            return cached;
        }
        const data = await this.httpClient.getDocumentation(`documentation/${frameworkName}`);
        await this.fileCache.saveFramework(frameworkName, data);
        return data;
    }
    async refreshFramework(frameworkName) {
        const data = await this.httpClient.getDocumentation(`documentation/${frameworkName}`);
        await this.fileCache.saveFramework(frameworkName, data);
        return data;
    }
    async getSymbol(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const cached = await this.fileCache.loadSymbol(cleanPath);
        if (cached) {
            return cached;
        }
        const data = await this.httpClient.getDocumentation(cleanPath);
        await this.fileCache.saveSymbol(cleanPath, data);
        return data;
    }
    async getTechnologies() {
        // Try to load from persistent cache first
        const cached = await this.fileCache.loadTechnologies();
        if (cached && Object.keys(cached).length > 0) {
            return cached;
        }
        // If no cache, download from API and save
        const response = await this.httpClient.getDocumentation('documentation/technologies');
        // The API returns a structure with 'references' containing the technologies
        let technologies = {};
        if (response && typeof response === 'object') {
            if ('references' in response && response.references) {
                technologies = response.references;
            }
            else if (typeof response === 'object' && !Array.isArray(response)) {
                // Fallback: treat the whole response as technologies if no references key
                technologies = response;
            }
        }
        // Save the extracted technologies (not the full response)
        if (Object.keys(technologies).length > 0) {
            await this.fileCache.saveTechnologies(technologies);
        }
        return technologies;
    }
    // Force refresh technologies cache (user-invoked)
    async refreshTechnologies() {
        const response = await this.httpClient.getDocumentation('documentation/technologies');
        // The API returns a structure with 'references' containing the technologies
        let technologies = {};
        if (response && typeof response === 'object') {
            if ('references' in response && response.references) {
                technologies = response.references;
            }
            else if (typeof response === 'object' && !Array.isArray(response)) {
                // Fallback: treat the whole response as technologies if no references key
                technologies = response;
            }
        }
        // Save the extracted technologies (not the full response)
        if (Object.keys(technologies).length > 0) {
            await this.fileCache.saveTechnologies(technologies);
        }
        return technologies;
    }
    tokenizeSearchText(text) {
        if (!text) {
            return [];
        }
        const tokens = new Set();
        const basicTokens = text.split(/[\s/._-]+/).filter(Boolean);
        for (const token of basicTokens) {
            tokens.add(token.toLowerCase());
            const camelParts = token.split(/(?=[A-Z])/).filter(Boolean);
            if (camelParts.length > 1) {
                for (const part of camelParts) {
                    tokens.add(part.toLowerCase());
                }
                tokens.add(camelParts.join('').toLowerCase());
            }
        }
        return [...tokens];
    }
    buildWildcardPattern(query) {
        const escaped = query.replaceAll(/[.+^${}()|[\]\\]/g, '\\$&');
        const pattern = escaped.replaceAll('*', '.*').replaceAll('?', '.');
        return new RegExp(`^${pattern}$`, 'i');
    }
    matchesSearchFilters(ref, options) {
        if (options.symbolType &&
            ref.kind?.toLowerCase() !== options.symbolType.toLowerCase()) {
            return false;
        }
        if (!options.platform) {
            return true;
        }
        const platformLower = options.platform.toLowerCase();
        return Boolean(ref.platforms?.some((platform) => platform.name?.toLowerCase().includes(platformLower)));
    }
    scoreWildcardReference(title, path, abstractText, wildcardPattern) {
        const searchValues = [
            title,
            path,
            abstractText,
            ...this.tokenizeSearchText(title),
            ...this.tokenizeSearchText(path),
        ];
        return searchValues.some((value) => wildcardPattern.test(value)) ? 100 : 0;
    }
    scoreKeywordReference(title, path, abstractText, lowerQuery, queryTokens) {
        let score = 0;
        if (title.toLowerCase() === lowerQuery || path.toLowerCase() === lowerQuery) {
            score += 120;
        }
        for (const queryToken of queryTokens) {
            if (title.toLowerCase().includes(queryToken)) {
                score += 50;
            }
            if (path.toLowerCase().includes(queryToken)) {
                score += 40;
            }
            if (abstractText.toLowerCase().includes(queryToken)) {
                score += 10;
            }
        }
        return score;
    }
    buildSearchResult(frameworkName, framework, ref, abstractText) {
        return {
            title: ref.title ?? 'Symbol',
            framework: frameworkName,
            path: ref.url,
            description: abstractText,
            symbolKind: ref.kind,
            platforms: formatPlatforms(ref.platforms ?? framework.metadata.platforms),
        };
    }
    async searchFramework(frameworkName, query, options = {}) {
        const { maxResults = 20 } = options;
        const results = [];
        try {
            const framework = await this.getFramework(frameworkName);
            const lowerQuery = query.toLowerCase();
            const queryTokens = this.tokenizeSearchText(query);
            const wildcardPattern = query.includes('*') || query.includes('?')
                ? this.buildWildcardPattern(query)
                : undefined;
            for (const ref of Object.values(framework.references)) {
                const title = ref.title ?? '';
                const path = ref.url ?? '';
                const abstractText = extractText(ref.abstract ?? []);
                if (!this.matchesSearchFilters(ref, options)) {
                    continue;
                }
                const score = wildcardPattern
                    ? this.scoreWildcardReference(title, path, abstractText, wildcardPattern)
                    : this.scoreKeywordReference(title, path, abstractText, lowerQuery, queryTokens);
                if (score === 0) {
                    continue;
                }
                results.push({
                    result: this.buildSearchResult(frameworkName, framework, ref, abstractText),
                    score,
                });
            }
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, maxResults)
                .map((entry) => entry.result);
        }
        catch (error) {
            throw new Error(`Framework search failed for ${frameworkName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=apple-client.js.map