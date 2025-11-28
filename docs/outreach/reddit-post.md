# Reddit Post Draft for CreativeWriter v2.0

## Title Options:
1. "I built a free, open-source AI writing tool for creative writers - CreativeWriter v2.0 just released!"
2. "CreativeWriter v2.0 - Self-hosted AI writing assistant with multi-model support [Open Source]"
3. "Announcing CreativeWriter v2.0 - AI-powered story writing with image generation, version history, and more"

---

## Post Body (for r/selfhosted, r/writing, r/artificial):

Hey everyone!

I've been working on **CreativeWriter**, a free, open-source AI writing assistant designed specifically for creative writers. After months of development, I'm excited to share v2.0 with some major new features!

### What is CreativeWriter?

CreativeWriter is a self-hosted web application that helps you write stories using AI assistance. It's not about replacing your creativity - it's about augmenting it. You write your story, and the AI helps you continue scenes, overcome writer's block, or explore different directions.

### What's New in v2.0?

**AI Image Generation**
- Generate images directly in the app using Replicate's models
- Searchable model selector with thousands of text-to-image models
- Perfect for visualizing characters, scenes, and locations

**Beat Version History**
- Automatic tracking of all AI-generated content changes
- Restore any previous version with one click
- Know exactly what was generated vs. manually edited

**Enhanced Sync**
- CouchDB-based synchronization across devices
- Selective sync for faster performance
- Works offline, syncs when connected

**Beat AI System**
- Multiple AI model support (OpenRouter, Anthropic, OpenAI, Google, local models via Ollama)
- Context-aware generation using your story's codex (characters, locations, items)
- Configurable output length and style

**Mobile-Friendly**
- Works on phones and tablets
- Swipe gestures for navigation
- PWA support for app-like experience

### Screenshots

[Screenshots would be attached]

1. **Story List** - Clean home page showing all your stories
2. **AI Image Generation** - Generate images with any Replicate model
3. **Story Editor** - Rich text editor with Beat AI panel
4. **Beat AI Panel** - Configure prompts, select models, generate content
5. **Navigation Menu** - Access all features quickly
6. **Version History** - Track and restore AI generations

### Tech Stack

- Frontend: Angular 18 + Ionic 8
- Database: CouchDB (for sync) + PouchDB (local)
- AI: Works with any OpenAI-compatible API
- Deployment: Docker (multi-arch images available)

### Getting Started

```bash
# Create directory
mkdir creativewriter && cd creativewriter
mkdir -p data && chmod 755 data

# Download config
curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml

# Start
docker compose up -d

# Access at http://localhost:3080
```

### Links

- **GitHub**: https://github.com/MarcoDroll/creativewriter-public
- **Docker Images**: ghcr.io/marcodroll/creativewriter-public

### What's Next?

I'm actively developing new features and would love your feedback! Some things on the roadmap:
- Improved outline planning tools
- Character relationship mapping
- Export to various formats

This is a passion project, and I'm building it to be the writing tool I always wanted. If you're a writer who uses AI as a creative partner, I'd love to hear your thoughts!

---

## Suggested Subreddits:

1. **r/selfhosted** - Focus on Docker deployment, self-hosting aspects
2. **r/writing** - Focus on writing features, how it helps with creative process
3. **r/artificial** - Focus on AI integration, multi-model support
4. **r/LocalLLaMA** - Focus on Ollama integration, local model support
5. **r/IndieWriters** - Focus on indie author workflow
6. **r/scrivener** - Alternative writing tool discussion

## Image Captions:

1. **01-home-story-list.png**: "Story list with word counts and quick access to all your projects"
2. **02-image-generation-with-result.png**: "AI image generation - visualize your characters and scenes"
3. **03-story-editor-beat-ai.png**: "Story editor with Beat AI - context-aware writing assistance"
4. **04-beat-ai-expanded.png**: "Beat AI panel with model selection and generation options"
5. **05-navigation-menu.png**: "Quick access to all features - codex, image generation, version history"
6. **06-version-history-modal.png**: "Version history for tracking all AI generations"

---

## Tags/Flair suggestions:

- r/selfhosted: [New Release] or [Docker]
- r/writing: [Software] or [Tool]
- r/artificial: [Project] or [Open Source]
