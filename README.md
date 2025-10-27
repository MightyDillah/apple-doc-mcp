# Apple Doc MCP

A Model Context Protocol (MCP) server that provides seamless access to Apple's Developer Documentation directly within your AI coding assistant.

**Note:** Hey guys, thanks for checking out this MCP! Since I've been working on it on a regular basis, and as such its getting really expensive to build it and improve it to work on different platforms, all while adding new features (tokens aint cheap ya'll). 

if you find this MCP helpful, I'd really apperciate it if you clicked on the [❤️ Sponsor](https://github.com/sponsors/MightyDillah) button up there, any contribution is apperciated! thanks.

## 📋 Changelog

Please enjoy the new update the new symbol search is more robust! Thank you to @christopherbattlefrontlegal and @Indading for sponsoring! you guys rock. Please contribute what you can, my aim is to get $100 a month so i can at least fund a claude code account which I will dedicate only to this project.

- 1.9.0
  - Moved cached docs into `.cache/` to keep the repo clean
  - Routed MCP logging to stderr so protocol stdout stays clean (this was breaking codex symbol search)
- 1.8.9
  - MAJOR FIX: Fixed critical cache inconsistency causing unreliable symbol search results
  - MAJOR FIX: Implemented stateful LocalSymbolIndex to eliminate index rebuilds on every search
  - MAJOR FIX: Fixed technology filtering in symbol search - now only searches within selected technology
  - MAJOR FIX: Fixed search returning irrelevant results from other Apple frameworks (e.g., EnergyKit when searching SwiftUI)
  - Added wildcard search support (* and ? patterns) for flexible symbol discovery
  - Added local symbol index for fast cached searches with persistent state management
  - Enhanced error messages with dynamic technology suggestions and step-by-step guidance
  - Improved tokenization with camelCase/PascalCase support (GridItem → grid, item, griditem)
  - Enhanced search with better tokenization and scoring
  - Search now shows total symbols indexed with consistent counts
  - Fixed technology selection persistence issues
  - Fixed hardcoded server version to dynamically read from package.json
  - Added get_version tool to expose version information
  - Added technology-aware symbol indexing to prevent cross-framework contamination
  - Enhanced search fallback logic with smart detection of specific symbol names
  - Improved error messages with direct suggestions to use get_documentation for known symbols
  - Added result validation to detect and warn about irrelevant search results
  - Updated tool descriptions to clarify when to use search vs direct documentation lookup
  - Enhanced search handler to use persistent symbol indexes
  - Added cache validation and cleanup logic for better reliability
- 1.6.2
  - Fixed hardcoded server version to dynamically read from package.json
  - Added get_version tool to expose version information
  - Dynamic path resolution - no hardcoded paths
  - Fixed cache location to use MCP directory instead of polluting home/working directories
  - Fixed tutorials and non-framework content retrieval (sample-apps, updates, etc)
  - Improved search tokenization for compound words like GridItem
  - Enhanced search scoring with fuzzy matching and case-insensitive support
  - Expanded search index coverage for better symbol discovery
  - Added path validation for different content types
- 1.5.1 (Major update!)
  - Now on npm! someone annoying already uploaded it under apple-doc-mcp and theres no way to reach them so I had to rename it to apple-doc-mcp-server thanks random guy!
  - Introduced per-technology caching, mandatory framework selection, and the guided discovery/search flow.
  - Now it doesnt spam the doc server, all tech is cached after first call making every search super efficient!
  - Uses several search fallbacks to make sure it finds what youre looking for, and if it fails it'll do a regex to the entire technology and still give you suggestions!
  - It now asks you which doc is more relevant! and has very rudemntary fuzzy search but it works really well!
  - Simplified MCP in so many ways that I am just kicking myself!
  - Handlers now live in 'src/server/handlers/', so each tool is easy to read and evolve without touching the entrypoint.
  - This should have been version 1.0.0, there are still some kinks so please report them.

- 1.0.2 - Completely removed due to AI slop, sorry I merged without thoroughly going through this.
- 1.0.1 – Initial release.

## Quick Start

```"Use apple mcp select swiftui search tabbar"```

Configure your MCP client (example):

Using npx (recommended):
```json
{
  "mcpServers": {
    "apple-docs": {
      "command": "npx",
      "args": [
        "apple-doc-mcp-server@latest"
      ]
    }
  }
}
```

Claude Code:
```bash
claude mcp add apple-docs -- npx apple-doc-mcp-server@latest
```

OpenAI Codex:
```bash
codex mcp add apple-doc-mcp -- npx @apple-doc-mcp-server@latest 
```

Or using node with the built file:
```json
{
  "mcpServers": {
    "apple-docs": {
      "command": "node",
      "args": ["/absolute/path/to/apple-doc-mcp/dist/index.js"]
    }
  }
}
```

For local development:
```bash
pnpm install
pnpm build
```

## 🔄 Typical Workflow

1. Explore the catalogue:
   - `discover_technologies { "query": "swift" }`
   - `discover_technologies { "page": 2, "pageSize": 10 }`
2. Lock in a framework:
   - `choose_technology { "name": "SwiftUI" }`
   - `current_technology`
3. Search within the active framework:
   - `search_symbols { "query": "tab view layout" }`
   - `search_symbols { "query": "Grid*" }` (wildcard search)
   - `search_symbols { "query": "*Item" }` (find all items)
4. Open documentation:
   - `get_documentation { "path": "TabView" }`
   - `get_documentation { "path": "documentation/SwiftUI/TabViewStyle" }`

### Search Tips
- Start broad (e.g. `"tab"`, `"animation"`, `"gesture"`).
- Try synonyms (`"sheet"` vs `"modal"`, `"toolbar"` vs `"tabbar"`).
- Use wildcards (`"Grid*"`, `"*Item"`, `"Lazy*"`) for flexible matching.
- Use multiple keywords (`"tab view layout"`) to narrow results.
- If nothing turns up, re-run `discover_technologies` with a different keyword or pick another framework.
- Cache now lives in `.cache/` to avoid clutter.

## 🧰 Available Tools
- `discover_technologies` – browse/filter frameworks before selecting one.
- `choose_technology` – set the active framework; required before searching docs.
- `current_technology` – show the current selection and quick next steps.
- `search_symbols` – fuzzy keyword search with wildcard support within the active framework.
- `get_documentation` – view symbol docs (relative names allowed).
- `get_version` – get current MCP server version information.

## 🚀 Advanced Features

### Reliable Symbol Search
- **Persistent Indexing**: Stateful symbol index that persists between searches for consistent results
- **Wildcard Support**: Use `*` for any characters, `?` for single character matching
- **Smart Tokenization**: Handles camelCase/PascalCase automatically (GridItem → grid, item, griditem)
- **Technology Filtering**: Searches only within the selected framework to avoid irrelevant results
- **Cached Performance**: Fast local searches with framework-specific caching
- **Fallback Search**: Uses framework references when local index is limited
- **Cache Validation**: Robust error handling for corrupted or invalid cache files

### Enhanced Error Messages
- **Clear Guidance**: Explicit step-by-step instructions when no technology is selected
- **Dynamic Suggestions**: Shows available technologies with exact commands
- **Quick Start Examples**: SwiftUI and UIKit specific workflows
- **Professional Formatting**: Clean, helpful error messages with emojis and structure

## ⚠️ Current Limitations

- **Limited Symbol Coverage**: Search relies on cached framework data and references, not comprehensive symbol downloading
- **No Background Downloads**: Comprehensive symbol downloader is currently disabled due to stability issues
- **Framework-Specific**: Each technology maintains its own cache and index
- **Cache Dependency**: Search quality depends on available cached framework data
