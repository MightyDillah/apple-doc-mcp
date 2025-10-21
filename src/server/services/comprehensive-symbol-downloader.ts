import {
	readFileSync, writeFileSync, existsSync, mkdirSync,
} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext} from '../context.js';
import {
	type SymbolData, type ReferenceData, type FrameworkData, type AppleDevDocsClient,
} from '../../apple-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type SymbolIndexEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
};

export class ComprehensiveSymbolDownloader {
	private readonly downloadedSymbols = new Set<string>();

	constructor(private readonly client: AppleDevDocsClient) {}

	private get rateLimitDelay(): number {
		return 100; // 100ms between requests
	}

	private get maxRetries(): number {
		return 3;
	}

	getDownloadedCount(): number {
		return this.downloadedSymbols.size;
	}

	getDownloadedSymbols(): string[] {
		return [...this.downloadedSymbols];
	}

	async downloadAllSymbols(context: ServerContext): Promise<void> {
		const {state} = context;
		const activeTechnology = state.getActiveTechnology();

		if (!activeTechnology) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				'No technology selected. Use `discover_technologies` then `choose_technology` first.',
			);
		}

		console.log(`🚀 Starting comprehensive symbol download for ${activeTechnology.title}`);
		console.log('⏳ This will download additional symbols to improve search results...');

		// Load main framework data
		const frameworkData = await this.client.getFramework(activeTechnology.title);

		// Extract all identifiers from main framework
		const initialIdentifiers = this.extractAllIdentifiers(frameworkData);
		console.log(`📋 Found ${initialIdentifiers.length} initial identifiers to process`);

		// Start recursive download
		await this.downloadSymbolsRecursively(initialIdentifiers);

		console.log(`✅ Download completed! Total symbols downloaded: ${this.downloadedSymbols.size}`);
	}

	private async delay(ms: number): Promise<void> {
		return new Promise<void>(resolve => {
			setTimeout(resolve, ms);
		});
	}

	private extractAllIdentifiers(data: SymbolData | FrameworkData): string[] {
		const identifiers = new Set<string>();

		// Extract from topicSections
		if (data.topicSections) {
			for (const section of data.topicSections) {
				if (section.identifiers) {
					for (const id of section.identifiers) {
						identifiers.add(id);
					}
				}
			}
		}

		// Extract from references
		if (data.references) {
			for (const [refId, ref] of Object.entries(data.references)) {
				identifiers.add(refId);
			}
		}

		return [...identifiers];
	}

	private async downloadSymbolWithRetry(identifier: string, attempt = 1): Promise<SymbolData | undefined> {
		try {
			const symbolPath = identifier
				.replace('doc://com.apple.documentation/', '')
				.replace(/^documentation\//, 'documentation/');

			const data = await this.client.getSymbol(symbolPath);
			return data;
		} catch (error) {
			console.warn(`Attempt ${attempt} failed for ${identifier}:`, error instanceof Error ? error.message : String(error));

			if (attempt < this.maxRetries) {
				// Exponential backoff
				await this.delay(this.rateLimitDelay * (2 ** (attempt - 1)));

				return this.downloadSymbolWithRetry(identifier, attempt + 1);
			}

			return undefined;
		}
	}

	private async downloadSymbolsRecursively(identifiers: string[], depth = 0): Promise<void> {
		const newIdentifiers: string[] = [];
		const totalToProcess = identifiers.length;
		let processed = 0;

		console.log(`📥 Processing ${totalToProcess} symbols (depth ${depth})...`);

		const promises = identifiers.map(async identifier => {
			if (this.downloadedSymbols.has(identifier)) {
				return; // Already downloaded
			}

			processed++;
			if (processed % 10 === 0 || processed === totalToProcess) {
				console.log(`📥 Progress: ${processed}/${totalToProcess} symbols processed (${this.downloadedSymbols.size} total downloaded)`);
			}

			// Rate limiting
			await this.delay(this.rateLimitDelay);

			const data = await this.downloadSymbolWithRetry(identifier);
			if (data) {
				this.downloadedSymbols.add(identifier);

				// Extract new identifiers from this symbol
				const newIds = this.extractAllIdentifiers(data);
				for (const newId of newIds) {
					if (!this.downloadedSymbols.has(newId)) {
						newIdentifiers.push(newId);
					}
				}
			}
		});

		await Promise.all(promises);

		// Recursively download new identifiers (with depth limit to prevent infinite recursion)
		if (newIdentifiers.length > 0 && depth < 3) {
			console.log(`🔍 Found ${newIdentifiers.length} new identifiers to download (depth ${depth + 1})`);
			await this.downloadSymbolsRecursively(newIdentifiers, depth + 1);
		} else if (newIdentifiers.length > 0) {
			console.log(`⚠️ Stopping recursion at depth ${depth} to prevent infinite loops`);
		}
	}
}
