# Changelog

All notable changes to this project are documented in this file.

## 1.9.5

- MAJOR FIX: Simplified `search_symbols` to be more predictable for AI agents
- Added exact symbol resolution inside `search_symbols` for queries like `GridItem`, `View`, and `ButtonStyle`
- Changed `search_symbols` to return symbol-first results with articles and guides separated into their own section
- Fixed wildcard behavior so fallback search respects `*` and `?` patterns instead of degrading to plain substring matches
- Removed misleading search messaging about background downloads and "comprehensive" indexing
- Removed dead or unused search code paths that were adding confusion without improving results
- Fixed first-search index initialization so cache-backed symbol search finishes building before results are used

## 1.9.1

- Moved cached docs into `.cache/` to keep the repo clean
- Routed MCP logging to stderr so protocol stdout stays clean (this was breaking codex symbol search)

## 1.8.9

- MAJOR FIX: Fixed critical cache inconsistency causing unreliable symbol search results
- MAJOR FIX: Implemented stateful LocalSymbolIndex to eliminate index rebuilds on every search
- MAJOR FIX: Fixed technology filtering in symbol search - now only searches within selected technology
- MAJOR FIX: Fixed search returning irrelevant results from other Apple frameworks (e.g., EnergyKit when searching SwiftUI)
- Added wildcard search support (`*` and `?` patterns) for flexible symbol discovery
- Added local symbol index for fast cached searches with persistent state management
- Enhanced error messages with dynamic technology suggestions and step-by-step guidance
- Improved tokenization with camelCase/PascalCase support (GridItem -> grid, item, griditem)
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

## 1.6.2

- Fixed hardcoded server version to dynamically read from package.json
- Added get_version tool to expose version information
- Dynamic path resolution - no hardcoded paths
- Fixed cache location to use MCP directory instead of polluting home/working directories
- Fixed tutorials and non-framework content retrieval (sample-apps, updates, etc)
- Improved search tokenization for compound words like GridItem
- Enhanced search scoring with fuzzy matching and case-insensitive support
- Expanded search index coverage for better symbol discovery
- Added path validation for different content types

## 1.5.1

- Now on npm! someone annoying already uploaded it under apple-doc-mcp and theres no way to reach them so I had to rename it to apple-doc-mcp-server thanks random guy!
- Introduced per-technology caching, mandatory framework selection, and the guided discovery/search flow.
- Now it doesnt spam the doc server, all tech is cached after first call making every search super efficient!
- Uses several search fallbacks to make sure it finds what youre looking for, and if it fails it'll do a regex to the entire technology and still give you suggestions!
- It now asks you which doc is more relevant! and has very rudemntary fuzzy search but it works really well!
- Simplified MCP in so many ways that I am just kicking myself!
- Handlers now live in `src/server/handlers/`, so each tool is easy to read and evolve without touching the entrypoint.
- This should have been version 1.0.0, there are still some kinks so please report them.

## 1.0.2

- Completely removed due to AI slop, sorry I merged without thoroughly going through this.

## 1.0.1

- Initial release.