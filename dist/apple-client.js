import axios from 'axios';
import { promises as fs } from 'fs';
import { join } from 'path';
const baseUrl = 'https://developer.apple.com/tutorials/data';
const headers = {
    dnt: '1',
    referer: 'https://developer.apple.com/documentation',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};
export class AppleDevDocsClient {
    cache = new Map();
    cacheTimeout = 10 * 60 * 1000; // 10 minutes
    docsDir = join(process.cwd(), 'docs');
    technologiesCachePath = join(this.docsDir, 'technologies.json');
    sanitizeFrameworkName(name) {
        return name.replace(/[^a-z0-9-_]/gi, '_');
    }
    async ensureDocsDir() {
        await fs.mkdir(this.docsDir, { recursive: true });
    }
    getDocsPath(frameworkName) {
        const safeName = this.sanitizeFrameworkName(frameworkName);
        return join(this.docsDir, `${safeName}.json`);
    }
    async loadDocsFramework(frameworkName) {
        await this.ensureDocsDir();
        try {
            const raw = await fs.readFile(this.getDocsPath(frameworkName), 'utf-8');
            return JSON.parse(raw);
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async saveDocsFramework(frameworkName, data) {
        await this.ensureDocsDir();
        await fs.writeFile(this.getDocsPath(frameworkName), JSON.stringify(data, null, 2));
    }
    async saveSymbolCache(path, data) {
        await this.ensureDocsDir();
        const safePath = path.replace(/[\/]/g, '__');
        await fs.writeFile(join(this.docsDir, `${safePath}.json`), JSON.stringify(data, null, 2));
    }
    async loadSymbolCache(path) {
        try {
            const safePath = path.replace(/[\/]/g, '__');
            const raw = await fs.readFile(join(this.docsDir, `${safePath}.json`), 'utf-8');
            return JSON.parse(raw);
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async loadCachedTechnologies() {
        await this.ensureDocsDir();
        try {
            const data = await fs.readFile(this.technologiesCachePath, 'utf-8');
            const parsed = JSON.parse(data);
            return parsed.references || parsed;
        }
        catch (error) {
            if (error?.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async saveCachedTechnologies(technologies) {
        await this.ensureDocsDir();
        await fs.writeFile(this.technologiesCachePath, JSON.stringify(technologies, null, 2));
    }
    // Helper to extract text from abstract array
    extractText(abstract = []) {
        return abstract?.map(item => item.text).join('') || '';
    }
    // Helper to format platform availability
    formatPlatforms(platforms) {
        if (!platforms || platforms.length === 0) {
            return 'All platforms';
        }
        return platforms
            .map(p => `${p.name} ${p.introducedAt}${p.beta ? ' (Beta)' : ''}`)
            .join(', ');
    }
    async getFramework(frameworkName) {
        const docsCached = await this.loadDocsFramework(frameworkName);
        if (docsCached) {
            return docsCached;
        }
        const url = `${baseUrl}/documentation/${frameworkName}.json`;
        const data = await this.makeRequest(url);
        await this.saveDocsFramework(frameworkName, data);
        return data;
    }
    async refreshFramework(frameworkName) {
        const url = `${baseUrl}/documentation/${frameworkName}.json`;
        const data = await this.makeRequest(url);
        await this.saveDocsFramework(frameworkName, data);
        return data;
    }
    async getSymbol(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        const url = `${baseUrl}/${cleanPath}.json`;
        const cached = await this.loadSymbolCache(cleanPath);
        if (cached) {
            return cached;
        }
        const data = await this.makeRequest(url);
        await this.saveSymbolCache(cleanPath, data);
        return data;
    }
    async getTechnologies() {
        // Try to load from persistent cache first
        const cached = await this.loadCachedTechnologies();
        if (cached) {
            return cached;
        }
        // If no cache, download from API and save
        const url = `${baseUrl}/documentation/technologies.json`;
        const data = await this.makeRequest(url);
        if (data) {
            await this.saveCachedTechnologies(data);
        }
        return data || {};
    }
    // Force refresh technologies cache (user-invoked)
    async refreshTechnologies() {
        const url = `${baseUrl}/documentation/technologies.json`;
        const data = await this.makeRequest(url);
        if (data) {
            await this.saveCachedTechnologies(data);
        }
        return data || {};
    }
    async searchFramework(frameworkName, query, options = {}) {
        const { maxResults = 20 } = options;
        const results = [];
        try {
            const framework = await this.getFramework(frameworkName);
            const lowerQuery = query.toLowerCase();
            for (const ref of Object.values(framework.references)) {
                if (results.length >= maxResults) {
                    break;
                }
                const title = ref.title ?? '';
                const abstractText = this.extractText(ref.abstract ?? []);
                if (!title.toLowerCase().includes(lowerQuery) && !abstractText.toLowerCase().includes(lowerQuery)) {
                    continue;
                }
                if (options.symbolType && ref.kind?.toLowerCase() !== options.symbolType.toLowerCase()) {
                    continue;
                }
                if (options.platform) {
                    const platformLower = options.platform.toLowerCase();
                    if (!ref.platforms?.some(p => p.name?.toLowerCase().includes(platformLower))) {
                        continue;
                    }
                }
                results.push({
                    title: ref.title ?? 'Symbol',
                    framework: frameworkName,
                    path: ref.url,
                    description: abstractText,
                    symbolKind: ref.kind,
                    platforms: this.formatPlatforms(ref.platforms ?? framework.metadata.platforms),
                });
            }
            return results;
        }
        catch (error) {
            throw new Error(`Framework search failed for ${frameworkName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async makeRequest(url) {
        // Simple cache check
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        try {
            const response = await axios.get(url, {
                headers,
                timeout: 15_000, // 15 second timeout
            });
            // Cache the result
            this.cache.set(url, {
                data: response.data,
                timestamp: Date.now(),
            });
            return response.data;
        }
        catch (error) {
            console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : String(error));
            throw new Error(`Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=apple-client.js.map