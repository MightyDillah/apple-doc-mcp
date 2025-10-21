import type {ServerContext} from '../context.js';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {SymbolData, ReferenceData, FrameworkData} from '../../apple-client.js';
import {AppleDevDocsClient} from '../../apple-client.js';
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SymbolIndexEntry {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
}

export class ComprehensiveSymbolDownloader {
	private client: AppleDevDocsClient;
	private downloadedSymbols: Set<string> = new Set();
	private rateLimitDelay: number = 100; // 100ms between requests
	private maxRetries: number = 3;

	constructor(client: AppleDevDocsClient) {
		this.client = client;
	}

	private async delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
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

	private async downloadSymbolWithRetry(identifier: string): Promise<SymbolData | null> {
		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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
					await this.delay(this.rateLimitDelay * Math.pow(2, attempt - 1));
				}
			}
		}
		
		return null;
	}

	private async downloadSymbolsRecursively(identifiers: string[]): Promise<void> {
		const newIdentifiers: string[] = [];

		for (const identifier of identifiers) {
			if (this.downloadedSymbols.has(identifier)) {
				continue; // Already downloaded
			}

			console.log(`Downloading symbol: ${identifier}`);
			
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
		}

		// Recursively download new identifiers
		if (newIdentifiers.length > 0) {
			console.log(`Found ${newIdentifiers.length} new identifiers to download`);
			await this.downloadSymbolsRecursively(newIdentifiers);
		}
	}

	async downloadAllSymbols(context: ServerContext): Promise<void> {
		const {state} = context;
		const activeTechnology = state.getActiveTechnology();
		
		if (!activeTechnology) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				'No technology selected. Use `discover_technologies` then `choose_technology` first.'
			);
		}

		console.log(`Starting comprehensive symbol download for ${activeTechnology.title}`);

		// Load main framework data
		const frameworkData = await this.client.getFramework(activeTechnology.title);
		
		// Extract all identifiers from main framework
		const initialIdentifiers = this.extractAllIdentifiers(frameworkData);
		console.log(`Found ${initialIdentifiers.length} initial identifiers`);

		// Start recursive download
		await this.downloadSymbolsRecursively(initialIdentifiers);

		console.log(`Download completed. Total symbols downloaded: ${this.downloadedSymbols.size}`);
	}

	getDownloadedCount(): number {
		return this.downloadedSymbols.size;
	}

	getDownloadedSymbols(): string[] {
		return [...this.downloadedSymbols];
	}
}
