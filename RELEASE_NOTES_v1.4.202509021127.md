Added
- Language selection UI: Action Sheet replaces modal for better mobile UX.
- Login dialog: Clear “local-only mode” explanation.
- Multilingual AI support: Externalized templates and better system prompts.
- German category support with auto-migration to English.
- Codex auto-fields: Auto-create character fields from category.
- Mobile performance: Image compression + lazy loading.
- Docker/CouchDB: Hardened CouchDB container and integrated into public workflows; published full image set.

Fixed
- Local-only mode: Persists across reloads.
- Language selector: Multiple fixes to layout, height, and visibility on mobile.
- Codex tags: Prevent tag mutation and duplication; standardized custom field storage.
- Templates: Removed automatic updates in story settings to avoid data loss.

Changed
- Language selection: Split into separate component files; modern glass-morphism styling.
- System messages: Enriched fiction-writing guidance for better AI output.
- Database ops: More efficient saves; safer tag handling.
- Docs: README updates for public repo, Docker guidance, and CouchDB notes.

Performance
- Migrated CommonJS → ESM where possible for better optimization.
- Adopted OnPush change detection across major components.
- Reduced CSS in several components.

Infrastructure
- Public Docker images: app, nginx, replicate proxy, gemini proxy all published.
- CouchDB in compose: Streamlined init, improved defaults, and removed separate init service.

Upgrade Notes
- Persistent storage is critical: Ensure `./data` volume exists and is mounted.
- Ollama CORS: Set `OLLAMA_ORIGINS` when using local LLMs.
- Reverse proxy: App expects CouchDB via `/_db/{db}` when behind nginx; direct `:5984` used in localhost dev.

Compare
- https://github.com/MarcoDroll/creativewriter-public/compare/v1.3.0...v1.4.202509021127
