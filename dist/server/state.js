import { LocalSymbolIndex } from './services/local-symbol-index.js';
import { ProgressiveSymbolIndexer } from './services/progressive-symbol-indexer.js';
export class ServerState {
    activeTechnology;
    activeFrameworkData;
    frameworkIndex;
    expandedIdentifiers = new Set();
    lastDiscovery;
    localSymbolIndex;
    progressiveIndexer;
    getActiveTechnology() {
        return this.activeTechnology;
    }
    setActiveTechnology(technology) {
        const previousTechnology = this.activeTechnology;
        this.activeTechnology = technology;
        if (!technology) {
            this.resetIndexForNewTechnology();
        }
        else if (previousTechnology?.identifier !== technology.identifier) {
            // Technology changed, reset index
            this.resetIndexForNewTechnology();
        }
    }
    getActiveFrameworkData() {
        return this.activeFrameworkData;
    }
    setActiveFrameworkData(data) {
        this.activeFrameworkData = data;
    }
    clearActiveFrameworkData() {
        this.activeFrameworkData = undefined;
    }
    getFrameworkIndex() {
        return this.frameworkIndex;
    }
    setFrameworkIndex(index) {
        this.frameworkIndex = index;
    }
    clearFrameworkIndex() {
        this.frameworkIndex = undefined;
        this.expandedIdentifiers.clear();
    }
    hasExpandedIdentifier(identifier) {
        return this.expandedIdentifiers.has(identifier);
    }
    markIdentifierExpanded(identifier) {
        this.expandedIdentifiers.add(identifier);
    }
    getLastDiscovery() {
        return this.lastDiscovery;
    }
    setLastDiscovery(lastDiscovery) {
        this.lastDiscovery = lastDiscovery;
    }
    getLocalSymbolIndex(client) {
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
    getProgressiveIndexer() {
        this.progressiveIndexer ??= new ProgressiveSymbolIndexer();
        return this.progressiveIndexer;
    }
    getIndexerStatus() {
        return this.progressiveIndexer?.getStatus();
    }
    cancelProgressiveIndexer() {
        this.progressiveIndexer?.cancel();
    }
    // Reset index when technology changes
    resetIndexForNewTechnology() {
        // Cancel any running indexer
        this.progressiveIndexer?.cancel();
        this.progressiveIndexer = undefined;
        this.localSymbolIndex = undefined;
        this.activeFrameworkData = undefined;
        this.frameworkIndex = undefined;
        this.expandedIdentifiers.clear();
    }
}
//# sourceMappingURL=state.js.map