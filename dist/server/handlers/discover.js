import { bold, header, trimWithEllipsis } from '../markdown.js';
import { isSupportedTechnology, getTechnologyCategory } from '../../apple-client/types/technology-categories.js';
const formatPagination = (query, currentPage, totalPages) => {
    if (totalPages <= 1) {
        return [];
    }
    const safeQuery = query ?? '';
    const items = [];
    if (currentPage > 1) {
        items.push(`• Previous: \`discover_technologies { "query": "${safeQuery}", "page": ${currentPage - 1} }\``);
    }
    if (currentPage < totalPages) {
        items.push(`• Next: \`discover_technologies { "query": "${safeQuery}", "page": ${currentPage + 1} }\``);
    }
    return ['*Pagination*', ...items];
};
export const buildDiscoverHandler = ({ client, state }) => async (args) => {
    const { query, page = 1, pageSize = 25 } = args;
    const technologies = await client.getTechnologies();
    // Filter to include frameworks, resources (BundleResources), and articles
    const frameworks = Object.values(technologies).filter(tech => isSupportedTechnology(tech));
    let filtered = frameworks;
    if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = frameworks.filter(tech => tech.title.toLowerCase().includes(lowerQuery)
            || client.extractText(tech.abstract).toLowerCase().includes(lowerQuery));
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    state.setLastDiscovery({ query, results: pageItems });
    const lines = [
        header(1, `Discover Apple Technologies${query ? ` (filtered by "${query}")` : ''}`),
        '\n',
        bold('Total frameworks', frameworks.length.toString()),
        bold('Matches', filtered.length.toString()),
        bold('Page', `${currentPage} / ${totalPages}`),
        '\n',
        header(2, 'Available Frameworks'),
    ];
    for (const framework of pageItems) {
        const description = client.extractText(framework.abstract);
        const category = getTechnologyCategory(framework);
        const categoryLabels = {
            framework: '📦 Framework',
            resources: '📄 Resources',
            unknown: '❓ Unknown',
        };
        const categoryLabel = categoryLabels[category] ?? '❓ Unknown';
        lines.push(`### ${framework.title}`, `   • **Type:** ${categoryLabel}`);
        if (description) {
            lines.push(`   ${trimWithEllipsis(description, 180)}`);
        }
        lines.push(`   • **Identifier:** ${framework.identifier}`, `   • **Select:** \`choose_technology "${framework.title}"\``, '');
    }
    lines.push(...formatPagination(query, currentPage, totalPages), '\n## Next Step', 'Call `choose_technology` with the framework title or identifier to make it active.');
    return {
        content: [
            {
                text: lines.join('\n'),
                type: 'text',
            },
        ],
    };
};
//# sourceMappingURL=discover.js.map