# Release Notes

> **Major release with multi-provider image generation, enhanced Beat AI workflow, glassmorphism UI redesign, and significant performance & stability improvements**

## Release Information
- **Commits**: 251 commits since last release
- **Key Areas**: Image Generation, Beat AI System, UI/UX Design System, Sync & Performance, Editor Features, Settings & Configuration

## New Features

### Multi-Provider Image Generation
- **fal.ai Integration** - Complete multi-provider image generation system supporting fal.ai alongside existing providers
- **Dynamic Model Discovery** - Text-to-image models now load dynamically from provider APIs with pagination support
- **Safety Settings UI** - Add configurable safety checker settings for fal.ai image generation
- **Enhanced Image History** - View model names, regenerate images, append to history, and browse in gallery modal
- **fal.ai API Settings** - New settings UI for fal.ai configuration and API key management

### Beat AI Enhancements
- **Staging Notes** - AI-generated physical/positional context notes from scene content for more consistent writing
- **Section-Based Templates** - New template editor with customizable sections and context indicators
- **Rewrite-Specific Templates** - Dedicated templates for beat rewrites with smarter default merging
- **Prompt Preview Improvements** - Copy button, staging notes included, and cleaner modal UI
- **Custom Beat Rules** - Add markdown-based custom rules section for beat generation
- **Stop Generation Button** - Cancel ongoing generation with properly styled glass button
- **Quick Pick Model Scroll** - Scroll arrows for model overflow in quick picks

### Editor Features
- **Direct Speech Highlighting** - Real-time highlighting of dialogue with per-paragraph processing
- **Quote Normalization** - Automatic normalization of international quote characters
- **Customizable Dialogue Color** - Set your preferred dialogue highlight color in appearance settings
- **FAB Beat Input Button** - Floating action button for quick beat input insertion
- **Ace Editor Preview** - Syntax highlighting preview modal with FAB controls

### Scene & Outline Tools
- **Inline Action Buttons** - Glass icon buttons replace traditional action buttons in outline
- **Quick Picks Toolbar** - Anchor tools bar at bottom of outline for quick actions
- **Scene Generation Templates** - Section-based template for generating scenes from outline
- **Single-Shot Scene Generation** - Simplified scene generation workflow

### Chat & Streaming
- **Character Chat Streaming** - Real-time streaming responses with stop button
- **Scene Chat Streaming** - Live text display during generation with stop capability
- **Consolidated Streaming** - Unified streaming code across chat features

### Codex & Characters
- **Portrait Generation** - Generate character portraits with DeepSeek-powered prompts
- **Portrait Gallery** - Browse and manage multiple portraits per codex entry
- **Seedream 4.5 Model** - New portrait generation model option

### Storage & Backup
- **Remote Database Export** - Full database export and restore from remote
- **Single Story Export/Import** - Export and import individual stories
- **Deep Clean for Mobile** - Mobile-safe database cleanup for large databases
- **Auto-Compaction** - Automatic database compaction with actual bytes freed display

### Story Creation
- **Tense Selection** - Choose story tense during wizard setup
- **Writing Style Rules** - Default beat rules moved to writing style for better organization

## Improvements

### Glassmorphism UI System
- **Design Token System** - Unified dialog service with comprehensive design tokens
- **Glass Buttons** - New glassmorphism button variants with proper mobile visibility
- **Accordion Settings** - All settings pages converted to consistent accordion pattern
- **Glass-Morphism Transparency** - Subtle transparency effects across settings components

### Settings Redesign
- **Global Settings Overhaul** - Redesigned to match story settings UI/UX
- **Consolidated AI Settings** - Single tab for all AI prompt settings
- **Accordion Layouts** - API, UI, premium, scene-gen, and database settings all use accordions
- **Badge Improvements** - Show selected model instead of temperature in settings badges

### Performance Optimizations
- **Aho-Corasick Codex Highlighting** - Dramatic performance improvement for codex matching
- **Codex Debounce** - 200ms debounce reduces CPU load from style recalculations
- **Incremental Word Count** - Calculate word count only for active scene
- **Throttled Word Count** - Recalculation limited to every 3 seconds
- **ProseMirror History Limit** - Reduced history depth for memory efficiency

### Mobile & Memory
- **Memory Optimizations** - Multiple phases of Android Chrome crash fixes
- **Sync Serialization** - Prevent concurrent memory pressure from sync operations
- **MutationObserver Debouncing** - Reduce memory churn from DOM observations
- **Event Listener Cleanup** - Comprehensive cleanup to prevent memory leaks
- **Subscription Management** - Proper cleanup of RxJS subscriptions

### Sync & Database
- **Targeted Background Pull** - Pull specific document types on tab entry
- **Graceful Error Handling** - Better handling of viewCleanup, conflicts, and circular JSON
- **Throttling & Idle Detection** - Smart sync pausing during user inactivity
- **Live Sync Improvements** - Better filtering and push reliability

## Bug Fixes

### Beat AI & Editor
- **Staging Notes Persistence** - Notes now properly saved to ProseMirror document
- **Beat History Restoration** - Correctly restore prompts when restoring versions
- **Scene Switch Sync** - Proper prompt and beat-id updates on scene switch
- **Rewrite Animation** - Show loading animation during rewrite generation
- **Template Merging** - Smart merge prefers non-empty values over defaults
- **Generation Timeout** - Increased from 30s to 90s for complex generations

### UI & Layout
- **Textarea Heights** - Consistent scrollbars and proper constraint handling
- **Scene Card Layout** - Fixed summary edit layout and button positioning
- **Model Name Truncation** - Proper ellipsis for long model names
- **Button Group Backgrounds** - Explicit colored backgrounds for visibility
- **Icon Colors** - Consistent burger menu icon colors in popover context

### Sync & Storage
- **Sync Cascade Prevention** - Fix story settings causing Android crashes
- **Invalid PouchDB Calls** - Remove non-existent .off() method calls
- **Autosave Trigger** - Properly trigger save after content changes
- **Sync Push Reliability** - Direct doc_ids push for reliable story sync

### Security
- **Stripe Email Verification** - Prevent premium access with just email knowledge
- **Portal Session Binding** - Email-bound verification codes for secure access

### Other Fixes
- **Reasoning Model Filtering** - Filter thinking content from streaming responses
- **AI Rewrite Context** - Use full scene text instead of 500 char limit
- **Codex Token Budget** - Increased to 8000 with toast when entries dropped
- **International Quotes** - Support for various quote characters in existing content

## Technical Improvements

### Architecture
- **Provider Icons System** - Centralized icon management for AI providers
- **Story Outline Refactor** - Extracted AI service and split into smaller components
- **Database Maintenance Modularization** - Separate card components for each function
- **WebP Utility** - Shared convertToWebP function for image optimization

### Testing
- **Beat History Tests** - Comprehensive test coverage for version history
- **Context Menu Tests** - Tests for surrounding context extraction
- **Story Export Tests** - Unit tests for export/import functionality
- **Scene Card Tests** - Tests for inline action button behavior

### CI/CD
- **Squash Merge Sync** - Changed public repo sync to squash merge approach for cleaner history

### Documentation
- **MCP Server Guidelines** - Added transparency guidelines for external documentation usage
- **Context7 Integration** - Added MCP server configuration and documentation retrieval guidelines

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
