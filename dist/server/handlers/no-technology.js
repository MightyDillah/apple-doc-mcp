import { header } from '../markdown.js';
export const buildNoTechnologyMessage = ({ state }) => () => {
    const lastDiscovery = state.getLastDiscovery();
    const lines = [
        header(1, '🚦 Technology Not Selected'),
        'Before you can search or view documentation, choose a framework/technology.',
        '',
        header(2, 'How to get started'),
        '• `discover_technologies { "query": "swift" }` — narrow the catalogue with a keyword',
        '• `choose_technology "SwiftUI"` — select the framework you want to explore',
        '• `search_symbols { "query": "tab view layout" }` — run focused keyword searches',
        '',
        '**Search tips:** start broad ("tab", "animation"), avoid punctuation, and try synonyms ("toolbar" vs "tabbar").',
    ];
    if (lastDiscovery?.results?.length) {
        lines.push('', '### Recently discovered frameworks');
        for (const result of lastDiscovery.results.slice(0, 5)) {
            lines.push(`• ${result.title} (\`choose_technology "${result.title}"\`)`);
        }
    }
    return {
        content: [{ text: lines.join('\n'), type: 'text' }],
    };
};
//# sourceMappingURL=no-technology.js.map