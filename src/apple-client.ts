import {HttpClient} from './apple-client/http-client.js';
import {FileCache} from './apple-client/cache/file-cache.js';
import {extractText, formatPlatforms} from './apple-client/formatters.js';
import type {
	FrameworkData, SymbolData, Technology, SearchResult,
} from './apple-client/types/index.js';

// Re-export types for backward compatibility
export type {
	PlatformInfo,
	FrameworkData,
	SearchResult,
	SymbolData,
	Technology,
	TopicSection,
	ReferenceData,
} from './apple-client/types/index.js';

export class AppleDevDocsClient {
	// Expose formatter methods for backward compatibility
	extractText = extractText;
	formatPlatforms = formatPlatforms;

	private readonly httpClient: HttpClient;
	private readonly fileCache: FileCache;

	constructor() {
		this.httpClient = new HttpClient();
		this.fileCache = new FileCache();
	}

	async getFramework(frameworkName: string): Promise<FrameworkData> {
		const cached = await this.fileCache.loadFramework(frameworkName);
		if (cached) {
			return cached;
		}

		const data = await this.httpClient.getDocumentation<FrameworkData>(`documentation/${frameworkName}`);
		await this.fileCache.saveFramework(frameworkName, data);
		return data;
	}

	async refreshFramework(frameworkName: string): Promise<FrameworkData> {
		const data = await this.httpClient.getDocumentation<FrameworkData>(`documentation/${frameworkName}`);
		await this.fileCache.saveFramework(frameworkName, data);
		return data;
	}

	async getSymbol(path: string): Promise<SymbolData> {
		// Remove leading slash if present
		const cleanPath = path.startsWith('/') ? path.slice(1) : path;

		const cached = await this.fileCache.loadSymbol(cleanPath);
		if (cached) {
			return cached;
		}

		const data = await this.httpClient.getDocumentation<SymbolData>(cleanPath);
		await this.fileCache.saveSymbol(cleanPath, data);
		return data;
	}

	async getTechnologies(): Promise<Record<string, Technology>> {
		// Try to load from persistent cache first
		const cached = await this.fileCache.loadTechnologies();
		if (cached && Object.keys(cached).length > 0) {
			return cached;
		}

		// If no cache, download from API and save
		const response = await this.httpClient.getDocumentation<unknown>('documentation/technologies');

		// The API returns a structure with 'references' containing the technologies
		let technologies: Record<string, Technology> = {};

		if (response && typeof response === 'object') {
			if ('references' in response && response.references) {
				technologies = response.references as Record<string, Technology>;
			} else if (typeof response === 'object' && !Array.isArray(response)) {
				// Fallback: treat the whole response as technologies if no references key
				technologies = response as Record<string, Technology>;
			}
		}

		// Save the extracted technologies (not the full response)
		if (Object.keys(technologies).length > 0) {
			await this.fileCache.saveTechnologies(technologies);
		}

		return technologies;
	}

	// Force refresh technologies cache (user-invoked)
	async refreshTechnologies(): Promise<Record<string, Technology>> {
		const response = await this.httpClient.getDocumentation<unknown>('documentation/technologies');

		// The API returns a structure with 'references' containing the technologies
		let technologies: Record<string, Technology> = {};

		if (response && typeof response === 'object') {
			if ('references' in response && response.references) {
				technologies = response.references as Record<string, Technology>;
			} else if (typeof response === 'object' && !Array.isArray(response)) {
				// Fallback: treat the whole response as technologies if no references key
				technologies = response as Record<string, Technology>;
			}
		}

		// Save the extracted technologies (not the full response)
		if (Object.keys(technologies).length > 0) {
			await this.fileCache.saveTechnologies(technologies);
		}

		return technologies;
	}

	async searchFramework(frameworkName: string, query: string, options: {
		maxResults?: number;
		platform?: string;
		symbolType?: string;
	} = {}): Promise<SearchResult[]> {
		const {maxResults = 20} = options;
		const results: SearchResult[] = [];

		try {
			const framework = await this.getFramework(frameworkName);
			const lowerQuery = query.toLowerCase();

			for (const ref of Object.values(framework.references)) {
				if (results.length >= maxResults) {
					break;
				}

				const title = ref.title ?? '';
				const abstractText = extractText(ref.abstract ?? []);
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
					platforms: formatPlatforms(ref.platforms ?? framework.metadata.platforms),
				});
			}

			return results;
		} catch (error) {
			throw new Error(`Framework search failed for ${frameworkName}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
