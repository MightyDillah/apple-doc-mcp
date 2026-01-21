import {writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {
	AppleDevDocsClient,
	SymbolData,
	FrameworkData,
	ReferenceData,
} from '../../apple-client.js';
import type {LocalSymbolIndex} from './local-symbol-index.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = dirname(currentFilename);

export type IndexerStatus = {
	isRunning: boolean;
	downloadedCount: number;
	totalQueued: number;
	errorCount: number;
	currentSymbol?: string;
	technologyTitle?: string;
};

type QueueItem = {
	path: string;
	depth: number;
};

const rateLimitMs = 150;
const maxDepth = 3;
const maxSymbolsPerTechnology = 500;

const sleep = async (ms: number): Promise<void> =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

export class ProgressiveSymbolIndexer {
	private readonly cacheDir: string;
	private readonly queue: QueueItem[] = [];
	private readonly visited = new Set<string>();
	private running = false;
	private cancelled = false;
	private downloaded = 0;
	private errorCount = 0;
	private current?: string;
	private techTitle?: string;
	private localIndex?: LocalSymbolIndex;

	constructor() {
		this.cacheDir = join(currentDirname, '../../../.cache');
	}

	cancel(): void {
		if (this.running) {
			console.error('🛑 Cancelling progressive indexer');
			this.cancelled = true;
		}
	}

	getStatus(): IndexerStatus {
		return {
			isRunning: this.running,
			downloadedCount: this.downloaded,
			totalQueued: this.queue.length + this.downloaded,
			errorCount: this.errorCount,
			currentSymbol: this.current,
			technologyTitle: this.techTitle,
		};
	}

	async startIndexing(
		client: AppleDevDocsClient,
		technologyTitle: string,
		technologyIdentifier: string,
		localIndex: LocalSymbolIndex,
	): Promise<void> {
		if (this.running) {
			console.error('⚠️ Indexer already running, cancelling previous run');
			this.cancel();
			await this.waitForStop();
		}

		this.reset();
		this.running = true;
		this.techTitle = technologyTitle;
		this.localIndex = localIndex;

		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, {recursive: true});
		}

		console.error(`🚀 Starting progressive indexing for ${technologyTitle}`);

		try {
			const frameworkName = this.extractFrameworkName(technologyIdentifier);
			const framework = await client.getFramework(frameworkName);

			this.seedQueueFromFramework(framework);
			console.error(`📊 Queued ${this.queue.length} symbols for indexing`);

			// Start background processing with error handling
			void (async () => {
				try {
					await this.processQueue(client);
				} catch (error: unknown) {
					console.error('Queue processing failed:', error instanceof Error ? error.message : String(error));
					this.running = false;
				}
			})();
		} catch (error) {
			console.error(`Failed to start indexing for ${technologyTitle}:`, error instanceof Error ? error.message : String(error));
			this.running = false;
		}
	}

	private reset(): void {
		this.queue.length = 0;
		this.visited.clear();
		this.running = false;
		this.cancelled = false;
		this.downloaded = 0;
		this.errorCount = 0;
		this.current = undefined;
		this.techTitle = undefined;
		this.localIndex = undefined;
	}

	private async waitForStop(): Promise<void> {
		while (this.running) {
			// eslint-disable-next-line no-await-in-loop -- Intentional polling loop
			await sleep(50);
		}
	}

	private extractFrameworkName(identifier: string): string {
		const parts = identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, '').split('/');
		return parts[0] ?? identifier;
	}

	private seedQueueFromFramework(framework: FrameworkData): void {
		for (const ref of Object.values(framework.references)) {
			if (ref.kind === 'symbol' && ref.url) {
				const path = this.normalizeDocPath(ref.url);
				if (!this.visited.has(path)) {
					this.queue.push({path, depth: 1});
					this.visited.add(path);
				}
			}
		}

		this.seedFromTopicSections(framework);
	}

	private seedFromTopicSections(framework: FrameworkData): void {
		if (!framework.topicSections) {
			return;
		}

		for (const section of framework.topicSections) {
			if (!section.identifiers) {
				continue;
			}

			for (const id of section.identifiers) {
				const ref = framework.references[id];
				if (ref?.url) {
					const path = this.normalizeDocPath(ref.url);
					if (!this.visited.has(path)) {
						this.queue.push({path, depth: 1});
						this.visited.add(path);
					}
				}
			}
		}
	}

	private normalizeDocPath(url: string): string {
		let path = url.startsWith('/') ? url.slice(1) : url;
		if (!path.startsWith('documentation/')) {
			path = `documentation/${path}`;
		}

		return path;
	}

	private async processQueue(client: AppleDevDocsClient): Promise<void> {
		while (this.queue.length > 0 && !this.cancelled) {
			// eslint-disable-next-line no-await-in-loop -- Intentional rate limiting delay
			await sleep(rateLimitMs);

			if (this.cancelled || this.downloaded >= maxSymbolsPerTechnology) {
				if (this.downloaded >= maxSymbolsPerTechnology) {
					console.error(`📊 Reached maximum symbols (${maxSymbolsPerTechnology}), stopping indexer`);
				}

				break;
			}

			const item = this.queue.shift();
			if (!item) {
				continue;
			}

			// eslint-disable-next-line no-await-in-loop -- Intentional sequential processing
			await this.processItem(client, item);
		}

		this.running = false;
		this.current = undefined;

		if (this.cancelled) {
			console.error('🛑 Progressive indexer cancelled');
		} else {
			console.error(`✅ Progressive indexing complete: ${this.downloaded} symbols indexed, ${this.errorCount} errors`);
		}
	}

	private async processItem(client: AppleDevDocsClient, item: QueueItem): Promise<void> {
		try {
			this.current = item.path;
			const data = await client.getSymbol(item.path);
			this.downloaded++;

			this.saveToCache(item.path, data);

			if (this.localIndex) {
				const filePath = this.getCacheFilePath(item.path);
				this.localIndex.addSymbolFromData(data, filePath);
			}

			if (item.depth < maxDepth && data.references) {
				this.queueChildReferences(data.references, item.depth + 1);
			}

			if (this.downloaded % 10 === 0) {
				console.error(`📚 Indexed ${this.downloaded} symbols, ${this.queue.length} remaining`);
			}
		} catch (error) {
			this.errorCount++;
			if (this.errorCount <= 5 || this.errorCount % 10 === 0) {
				console.error(`Failed to index ${item.path}:`, error instanceof Error ? error.message : String(error));
			}
		}
	}

	private queueChildReferences(references: Record<string, ReferenceData>, depth: number): void {
		for (const ref of Object.values(references)) {
			if (ref.kind === 'symbol' && ref.url) {
				const path = this.normalizeDocPath(ref.url);
				if (!this.visited.has(path)) {
					this.queue.push({path, depth});
					this.visited.add(path);
				}
			}
		}
	}

	private getCacheFilePath(docPath: string): string {
		const safeFileName = docPath.replaceAll('/', '_').replaceAll(':', '_');
		return join(this.cacheDir, `${safeFileName}.json`);
	}

	private saveToCache(docPath: string, data: SymbolData): void {
		const filePath = this.getCacheFilePath(docPath);
		try {
			writeFileSync(filePath, JSON.stringify(data, null, 2));
		} catch (error) {
			console.error(`Failed to cache ${docPath}:`, error instanceof Error ? error.message : String(error));
		}
	}
}
