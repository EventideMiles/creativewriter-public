**CRITICAL**
- BEFORE DOING ANYTHING: Switch to main branch and pull from git remote!!!!!!!!
- RESPECT THE WORKFLOW BELOW!!!
- NEVER: leave uncommitted or unpushed changes - always maintain a consistent and backed-up repository state
- Keep the App modular!!!
- ALWAYS: Consider if a web research for best practices in 2025 could be useful.
- ALWAYS: Consider if a web research for existing framework components (angular, ionic) that cover the requirements
- !!!ALWAYS work on the main branch in the private repository!!!!
- NEVER MERGE TO release branch on your own!
- WHEN CREATING NEW COMPONENTS: They shall follow a common design pattern to put each component into a seperate foldern, split them into template, typescript and css files!
---

**WORKFLOW**
- After completing a task do two subsequent reviews:
  - First: review your changes with a subagent that focusses on the big picture, how the new implementation is used and which implications arise
  - Second: review your changes with a subagent the default way
  - Adress findings and ask back if anything unclear.

- Before declaring a task as complete:
  - test if the app builds using `npm run build` AND run the tests `npm test -- --no-watch`!
  - test if the app has linting errors using `npm run lint`!

- ALWAYS: After changing backend code (`backend/src/index.ts`), deploy to both dev AND production:
  - `cd backend && npx wrangler deploy --env dev` (dev environment)
  - `cd backend && npx wrangler deploy` (production environment)

- After finising a task propose a next step to perform.

# Repository Guidelines

## Project Structure & Module Organization
- `src/app/core`: Services, models, and singletons.
- `src/app/shared`: Reusable components, pipes, and utilities.
- `src/app/stories` and `src/app/settings`: Feature modules.
- `src/assets`: Static assets (images, templates, backgrounds).
- `public` and `nginx*`: Deployment-related files; not used at runtime by Angular dev server.
- Tests live next to code as `*.spec.ts` files.

## Build, Test, and Development Commands
- `npm start`: Run Angular dev server on `http://localhost:4200`.
- `npm run build`: Production build to `dist/`.
- `npm run watch`: Development build with watch.
- `npm test -- --no-watch`: Run unit tests with Karma/Jasmine (use `--no-watch` to auto-close browser).
- `npm run lint`: Lint TypeScript and templates via ESLint + angular-eslint.
- Docker (optional local stack): `docker compose up -d` (ensure data volumes exist per README).

## Coding Style & Naming Conventions
- TypeScript; 2-space indentation; UTF-8; trim trailing whitespace (`.editorconfig`).
- Quotes: single quotes in `.ts` files.
- Angular selectors: components use `app-` kebab-case; directives use `app` camelCase (enforced by ESLint).
- File naming: `feature-name.component.ts`, `feature-name.service.ts`, `feature-name.component.spec.ts`.
- Organize by feature module; keep shared logic in `shared/` and singletons in `core/`.
- Run `npm run lint` before committing; fix issues or add justifications.

## Testing Guidelines
- Framework: Jasmine + Karma; coverage via `karma-coverage`.
- Location: colocate tests; name as `*.spec.ts`.
- Scope: write unit tests for services, pipes, and component logic; prefer small, isolated specs.
- Run: `npm test` locally and ensure coverage does not regress for touched code.

## Commit & Pull Request Guidelines
- Conventional Commits style to support semantic-release (e.g., `feat: add beat export`, `fix: correct pouchdb sync retry`).
- Commit messages: imperative mood; scope optional (e.g., `feat(stories): ...`).
- PRs must include: concise description, linked issues (`Closes #123`), testing steps, and screenshots/GIFs for UI changes.
- Keep PRs focused; update docs when behavior or commands change.

## Security & Configuration Tips
- Do not commit secrets; use `.env` (see `.env.example`) and app Settings for API keys.
- For Docker, ensure persistent volumes for CouchDB data; never run without persistence.
- Validate CORS and proxy settings only in config files—avoid hardcoded URLs/keys in source.
- remember how we curently handle bottom padding calculation

## Dual Repository Release Workflow:
  - Private repo (creativewriter2): Development on main branch. Merging to release branch triggers sync.
  - Sync process (.github/workflows/sync-public.yml): Filters out private files (.claude/, .vscode/, docs/), replaces docker-compose with public version, force-pushes to public repo main branch, creates GitHub Release with
  timestamp-based version (format: v1.4.YYYYMMDDHHMM).
  - Public repo (creativewriter-public): Release triggers .github/workflows/docker-public-images.yml which builds multi-platform Docker images and publishes to GHCR with tags: version, stable, latest.
## Context7 Documentation Retrieval
- ALWAYS use Context7 MCP server to retrieve code samples and documentation before implementing features
- Use `resolve-library-id` to find the correct library, then `query-docs` to get relevant documentation
- Key library IDs for this project:
  - `/prosemirror/website` - ProseMirror guide, examples, API (220+ snippets)
  - `/prosemirror/prosemirror-view` - EditorView, NodeViews, decorations
  - `/prosemirror/prosemirror-model` - Schema, nodes, marks, fragments
  - `/prosemirror/prosemirror-state` - EditorState, transactions, plugins
  - `/angular/angular` - Angular framework documentation
  - `/ionic-team/ionic-framework` - Ionic components and APIs
- Automatically use Context7 for code generation, setup steps, or library/API documentation without being explicitly asked

## MCP Server Usage Transparency
- ALWAYS inform the user when consulting external documentation via MCP servers (Context7, WebSearch, etc.)
- When using Context7, explicitly state:
  - "Consulting Context7 for [library] documentation..."
  - Which library ID was queried
  - A brief summary of what documentation was retrieved
- When using WebSearch for best practices or framework research, state:
  - "Researching [topic] via web search..."
  - Key sources consulted
- Format MCP consultations visibly, e.g.:
  ```
  📚 Context7: Querying /prosemirror/prosemirror-view for NodeView implementation patterns...
  ```
- After retrieving documentation, summarize the relevant findings before applying them
- If Context7 or other MCP servers are unavailable, inform the user and proceed with existing knowledge