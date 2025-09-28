import type {FrameworkData, ReferenceData, Technology} from '../apple-client.js';

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
	private expandedIdentifiers = new Set<string>();
	private lastDiscovery?: LastDiscovery;

	getActiveTechnology(): Technology | undefined {
		return this.activeTechnology;
	}

	setActiveTechnology(technology: Technology | undefined) {
		this.activeTechnology = technology;
		if (!technology) {
			this.activeFrameworkData = undefined;
			this.frameworkIndex = undefined;
			this.expandedIdentifiers.clear();
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
}

