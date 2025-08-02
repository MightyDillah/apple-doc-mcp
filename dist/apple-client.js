import axios from 'axios';
const BASE_URL = 'https://developer.apple.com/tutorials/data';
const CONTAINER_BASE_URL = 'https://apple.github.io/container/data';
const CONTAINERIZATION_BASE_URL = 'https://apple.github.io/containerization/data';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    'Referer': 'https://developer.apple.com/documentation',
    'DNT': '1'
};
export class AppleDevDocsClient {
    cache = new Map();
    cacheTimeout = 10 * 60 * 1000; // 10 minutes
    async makeRequest(url) {
        // Simple cache check
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        try {
            const response = await axios.get(url, {
                headers: HEADERS,
                timeout: 15000 // 15 second timeout
            });
            // Cache the result
            this.cache.set(url, {
                data: response.data,
                timestamp: Date.now()
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching ${url}:`, error);
            throw new Error(`Failed to fetch documentation: ${error}`);
        }
    }
    async getTechnologies() {
        const url = `${BASE_URL}/documentation/technologies.json`;
        const data = await this.makeRequest(url);
        return data.references || {};
    }
    async getContainerTechnologies() {
        const url = `${CONTAINER_BASE_URL}/documentation.json`;
        const data = await this.makeRequest(url);
        return data.references || {};
    }
    async getContainerizationTechnologies() {
        const url = `${CONTAINERIZATION_BASE_URL}/documentation.json`;
        const data = await this.makeRequest(url);
        return data.references || {};
    }
    async getFramework(frameworkName) {
        const url = `${BASE_URL}/documentation/${frameworkName}.json`;
        return await this.makeRequest(url);
    }
    async getContainerFramework(frameworkName) {
        const url = `${CONTAINER_BASE_URL}/documentation/${frameworkName}.json`;
        return await this.makeRequest(url);
    }
    async getContainerizationFramework(frameworkName) {
        const url = `${CONTAINERIZATION_BASE_URL}/documentation/${frameworkName}.json`;
        return await this.makeRequest(url);
    }
    async getSymbol(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const url = `${BASE_URL}/${cleanPath}.json`;
        return await this.makeRequest(url);
    }
    async getContainerSymbol(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const url = `${CONTAINER_BASE_URL}/${cleanPath}.json`;
        return await this.makeRequest(url);
    }
    async getContainerizationSymbol(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const url = `${CONTAINERIZATION_BASE_URL}/${cleanPath}.json`;
        return await this.makeRequest(url);
    }
    // NEW: Search across all frameworks
    async searchGlobal(query, options = {}) {
        const { maxResults = 50 } = options;
        const results = [];
        try {
            const technologies = await this.getTechnologies();
            const frameworks = Object.values(technologies).filter(tech => tech.kind === 'symbol' && tech.role === 'collection');
            // Use all available frameworks (limited to avoid API abuse)
            const searchFrameworks = frameworks.slice(0, 20); // Limit to avoid API abuse
            for (const framework of searchFrameworks) {
                if (results.length >= maxResults)
                    break;
                try {
                    const frameworkResults = await this.searchFramework(framework.title, query, {
                        symbolType: options.symbolType,
                        platform: options.platform,
                        maxResults: Math.ceil(maxResults / 4) // Distribute across frameworks
                    });
                    results.push(...frameworkResults);
                }
                catch (error) {
                    // Continue on individual framework errors
                    console.warn(`Failed to search ${framework.title}:`, error);
                }
            }
            return results.slice(0, maxResults);
        }
        catch (error) {
            throw new Error(`Global search failed: ${error}`);
        }
    }
    // NEW: Search within a specific framework
    async searchFramework(frameworkName, query, options = {}) {
        const { maxResults = 20 } = options;
        const results = [];
        try {
            const framework = await this.getFramework(frameworkName);
            const searchPattern = this.createSearchPattern(query);
            Object.entries(framework.references).forEach(([id, ref]) => {
                if (results.length >= maxResults)
                    return;
                if (this.matchesSearch(ref, searchPattern, options)) {
                    results.push({
                        title: ref.title,
                        description: this.extractText(ref.abstract || []),
                        path: ref.url,
                        framework: frameworkName,
                        symbolKind: ref.kind,
                        platforms: this.formatPlatforms(ref.platforms || framework.metadata?.platforms)
                    });
                }
            });
            return results.sort((a, b) => this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query));
        }
        catch (error) {
            throw new Error(`Framework search failed for ${frameworkName}: ${error}`);
        }
    }
    // NEW: Search within Container frameworks
    async searchContainerFramework(frameworkName, query, options = {}) {
        const { maxResults = 20 } = options;
        const results = [];
        try {
            const framework = await this.getContainerFramework(frameworkName);
            const searchPattern = this.createSearchPattern(query);
            Object.entries(framework.references).forEach(([id, ref]) => {
                if (results.length >= maxResults)
                    return;
                if (this.matchesSearch(ref, searchPattern, options)) {
                    results.push({
                        title: ref.title,
                        description: this.extractText(ref.abstract || []),
                        path: ref.url,
                        framework: frameworkName,
                        symbolKind: ref.kind,
                        platforms: this.formatPlatforms(ref.platforms || framework.metadata?.platforms)
                    });
                }
            });
            return results.sort((a, b) => this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query));
        }
        catch (error) {
            throw new Error(`Container framework search failed for ${frameworkName}: ${error}`);
        }
    }
    // NEW: Search within Containerization frameworks
    async searchContainerizationFramework(frameworkName, query, options = {}) {
        const { maxResults = 20 } = options;
        const results = [];
        try {
            const framework = await this.getContainerizationFramework(frameworkName);
            const searchPattern = this.createSearchPattern(query);
            Object.entries(framework.references).forEach(([id, ref]) => {
                if (results.length >= maxResults)
                    return;
                if (this.matchesSearch(ref, searchPattern, options)) {
                    results.push({
                        title: ref.title,
                        description: this.extractText(ref.abstract || []),
                        path: ref.url,
                        framework: frameworkName,
                        symbolKind: ref.kind,
                        platforms: this.formatPlatforms(ref.platforms || framework.metadata?.platforms)
                    });
                }
            });
            return results.sort((a, b) => this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query));
        }
        catch (error) {
            throw new Error(`Containerization framework search failed for ${frameworkName}: ${error}`);
        }
    }
    // Helper: Create search pattern (supports wildcards)
    createSearchPattern(query) {
        // Convert wildcard pattern to regex
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
        return new RegExp(pattern, 'i');
    }
    // Helper: Check if reference matches search criteria
    matchesSearch(ref, pattern, options) {
        if (!ref.title)
            return false;
        // Title match
        if (!pattern.test(ref.title))
            return false;
        // Symbol type filter
        if (options.symbolType && ref.kind !== options.symbolType)
            return false;
        // Platform filter (simplified)
        if (options.platform && ref.platforms) {
            const hasPlat = ref.platforms.some((p) => p.name?.toLowerCase().includes(options.platform.toLowerCase()));
            if (!hasPlat)
                return false;
        }
        return true;
    }
    // Helper: Score match quality (lower = better)
    scoreMatch(title, query) {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.replace(/\*/g, '').toLowerCase();
        if (lowerTitle === lowerQuery)
            return 0; // Exact match
        if (lowerTitle.startsWith(lowerQuery))
            return 1; // Prefix match
        if (lowerTitle.includes(lowerQuery))
            return 2; // Contains match
        return 3; // Pattern match
    }
    // Helper to extract text from abstract array
    extractText(abstract) {
        return abstract?.map(item => item.text).join('') || '';
    }
    // Helper to format platform availability
    formatPlatforms(platforms) {
        if (!platforms || platforms.length === 0)
            return 'All platforms';
        return platforms
            .map(p => `${p.name} ${p.introducedAt}+${p.beta ? ' (Beta)' : ''}`)
            .join(', ');
    }
}
//# sourceMappingURL=apple-client.js.map