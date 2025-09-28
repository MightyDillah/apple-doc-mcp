export class ServerState {
    activeTechnology;
    activeFrameworkData;
    frameworkIndex;
    expandedIdentifiers = new Set();
    lastDiscovery;
    getActiveTechnology() {
        return this.activeTechnology;
    }
    setActiveTechnology(technology) {
        this.activeTechnology = technology;
        if (!technology) {
            this.activeFrameworkData = undefined;
            this.frameworkIndex = undefined;
            this.expandedIdentifiers.clear();
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
}
//# sourceMappingURL=state.js.map