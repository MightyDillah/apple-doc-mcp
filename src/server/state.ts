import type {
	FrameworkData, ReferenceData, Technology, AppleDevDocsClient,
} from '../apple-client.js';
import {LocalSymbolIndex} from './services/local-symbol-index.js';

export type LastDiscovery = {
	query?: string;
	results: Technology[];
};

export type FrameworkIndexEntry = {
	id: string;
	ref: ReferenceData;
	tokens: string[];
};

export class ServerState {
	private activeTechnology?: Technology;
	private activeFrameworkData?: FrameworkData;
	private frameworkIndex?: Map<string, FrameworkIndexEntry>;
	private readonly expandedIdentifiers = new Set<string>();
	private lastDiscovery?: LastDiscovery;
	private localSymbolIndex?: LocalSymbolIndex;

	getActiveTechnology(): Technology | undefined {
		return this.activeTechnology;
	}

	setActiveTechnology(technology: Technology | undefined) {
		const previousTechnology = this.activeTechnology;
		this.activeTechnology = technology;

		if (!technology) {
			this.resetIndexForNewTechnology();
		} else if (previousTechnology?.identifier !== technology.identifier) {
			// Technology changed, reset index
			this.resetIndexForNewTechnology();
		}
	}

	getActiveFrameworkData(): FrameworkData | undefined {
		return this.activeFrameworkData;
	}

	setActiveFrameworkData(data: FrameworkData | undefined) {
		this.activeFrameworkData = data;
	}

	clearActiveFrameworkData() {
		this.activeFrameworkData = undefined;
	}

	getFrameworkIndex(): Map<string, FrameworkIndexEntry> | undefined {
		return this.frameworkIndex;
	}

	setFrameworkIndex(index: Map<string, FrameworkIndexEntry> | undefined) {
		this.frameworkIndex = index;
	}

	clearFrameworkIndex() {
		this.frameworkIndex = undefined;
		this.expandedIdentifiers.clear();
	}

	hasExpandedIdentifier(identifier: string): boolean {
		return this.expandedIdentifiers.has(identifier);
	}

	markIdentifierExpanded(identifier: string) {
		this.expandedIdentifiers.add(identifier);
	}

	getLastDiscovery(): LastDiscovery | undefined {
		return this.lastDiscovery;
	}

	setLastDiscovery(lastDiscovery: LastDiscovery | undefined) {
		this.lastDiscovery = lastDiscovery;
	}

	getLocalSymbolIndex(client: AppleDevDocsClient): LocalSymbolIndex {
		if (!this.localSymbolIndex) {
			const technologyIdentifier = this.activeTechnology?.identifier
				?.replace('doc://com.apple.documentation/', '')
				?.replace(/^documentation\//, '');
			this.localSymbolIndex = new LocalSymbolIndex(client, technologyIdentifier);
		}

		return this.localSymbolIndex;
	}

	clearLocalSymbolIndex() {
		this.localSymbolIndex = undefined;
	}

	// Reset index when technology changes
	private resetIndexForNewTechnology() {
		this.localSymbolIndex = undefined;
		this.activeFrameworkData = undefined;
		this.frameworkIndex = undefined;
		this.expandedIdentifiers.clear();
	}
}
