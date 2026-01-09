import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node } from 'prosemirror-model';
import { Trie } from '@tanishiking/aho-corasick';
import { CodexEntry } from '../../stories/models/codex.interface';

export interface CodexHighlightingOptions {
  codexEntries: CodexEntry[];
  storyId?: string;
}

const codexHighlightingKey = new PluginKey<DecorationSet>('codexHighlighting');

/**
 * Debounce delay in milliseconds for decoration recalculation
 * Reduces CPU load by waiting for typing pause before updating highlights
 */
const DEBOUNCE_DELAY_MS = 800;

/**
 * Information about a codex keyword for decoration styling
 */
interface CodexKeywordInfo {
  readonly keyword: string;
  readonly entryTitle: string;
  readonly isTag: boolean;
  readonly tagName?: string;
}

/**
 * Cached Aho-Corasick Trie for efficient multi-pattern matching
 * This avoids rebuilding the Trie on every document change
 */
let cachedTrie: Trie | null = null;
const cachedKeywordMap = new Map<string, CodexKeywordInfo>();
let cachedCodexHash: string | null = null;

/**
 * Generate a hash for codex entries to detect changes
 * Uses JSON.stringify for more robust collision resistance
 */
function generateCodexHash(codexEntries: CodexEntry[]): string {
  // Sort entries by title for order-independent comparison
  const sortedEntries = [...codexEntries]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(e => ({
      t: e.title,
      tags: (e.tags || []).slice().sort()
    }));
  return JSON.stringify(sortedEntries);
}

/**
 * Build Aho-Corasick Trie from codex entries
 * This is done once when codex changes, not on every keystroke
 */
function buildTrieFromCodex(codexEntries: CodexEntry[]): void {
  const keywords: string[] = [];
  cachedKeywordMap.clear();

  for (const entry of codexEntries) {
    // Add title
    const titleLower = entry.title.toLowerCase();
    if (titleLower.length > 0) {
      keywords.push(titleLower);
      cachedKeywordMap.set(titleLower, {
        keyword: titleLower,
        entryTitle: entry.title,
        isTag: false
      });
    }

    // Add tags
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (typeof tag === 'string' && tag.length > 0) {
          const tagLower = tag.toLowerCase();
          // Don't overwrite if already exists (title takes precedence)
          if (!cachedKeywordMap.has(tagLower)) {
            keywords.push(tagLower);
            cachedKeywordMap.set(tagLower, {
              keyword: tagLower,
              entryTitle: entry.title,
              isTag: true,
              tagName: tag
            });
          }
        }
      }
    }
  }

  // Build Trie with case-insensitive and whole-word matching
  // Wrapped in try-catch to handle potential Trie construction errors
  try {
    cachedTrie = keywords.length > 0
      ? new Trie(keywords, {
          caseInsensitive: true,
          onlyWholeWords: true
        })
      : null;
  } catch (error) {
    console.error('[CodexHighlighting] Failed to build Trie:', error);
    cachedTrie = null;
  }
}

/**
 * Ensure Trie is built and up-to-date for given codex entries
 */
function ensureTrieBuilt(codexEntries: CodexEntry[]): void {
  const hash = generateCodexHash(codexEntries);
  if (cachedCodexHash !== hash || !cachedTrie) {
    buildTrieFromCodex(codexEntries);
    cachedCodexHash = hash;
  }
}

export function createCodexHighlightingPlugin(options: CodexHighlightingOptions): Plugin<DecorationSet> {
  // Instance-scoped debounce state (not shared between editor instances)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pluginView: EditorView | null = null;

  /**
   * Schedule a debounced decoration recalculation
   * Instance-scoped to avoid conflicts with multiple editors
   */
  const scheduleDebouncedUpdate = (codexEntries: CodexEntry[]): void => {
    // Clear existing timer
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }

    // Schedule new recalculation
    debounceTimer = setTimeout(() => {
      debounceTimer = null;

      // Check if view is still valid (editor might have been destroyed)
      if (!pluginView || !pluginView.state) {
        return;
      }

      // Recalculate decorations
      const newDecorations = findCodexMatches(pluginView.state.doc, codexEntries);
      const tr = pluginView.state.tr.setMeta(codexHighlightingKey, newDecorations);
      pluginView.dispatch(tr);
    }, DEBOUNCE_DELAY_MS);
  };

  return new Plugin<DecorationSet>({
    key: codexHighlightingKey,
    view: (view) => {
      pluginView = view;
      return {
        destroy: () => {
          pluginView = null;
          // Clear any pending debounce timer when editor is destroyed
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
        }
      };
    },
    state: {
      init: (_config, editorState) => {
        return findCodexMatches(editorState.doc, options.codexEntries);
      },
      apply: (tr, oldDecorations) => {
        // Check if codex entries were updated via metadata (from debounced update or external update)
        const newDecorations = tr.getMeta(codexHighlightingKey);
        if (newDecorations) {
          return newDecorations;
        }

        // Only schedule recalculation if document content changed (not selection)
        if (tr.docChanged) {
          // Map existing decorations to new positions (cheap, keeps highlights roughly correct)
          const mappedDecorations = oldDecorations.map(tr.mapping, tr.doc);

          // Schedule debounced full recalculation
          scheduleDebouncedUpdate(options.codexEntries);

          return mappedDecorations;
        }

        // For selection-only changes, no mapping needed (positions unchanged)
        return oldDecorations;
      }
    },
    props: {
      decorations: (state) => {
        return codexHighlightingKey.getState(state);
      }
    }
  });
}

/**
 * Find codex matches using Aho-Corasick algorithm
 * This is O(n + z) where n = text length, z = number of matches
 * Much faster than O(n * m) with m = number of patterns
 */
function findCodexMatches(doc: Node, codexEntries: CodexEntry[]): DecorationSet {
  if (!codexEntries || codexEntries.length === 0) {
    return DecorationSet.empty;
  }

  // Ensure Trie is built (cached if codex hasn't changed)
  ensureTrieBuilt(codexEntries);

  // Get reference to trie to avoid repeated null checks
  const trie = cachedTrie;
  if (!trie) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

  // Walk through the document to find text nodes
  doc.descendants((node: Node, pos: number) => {
    if (node.isText && node.text) {
      // Use Aho-Corasick for efficient multi-pattern matching
      // Single pass through text finds all matches
      const matches = trie.parseText(node.text);

      for (const match of matches) {
        // Use toLowerCase for safety, even though Trie should return lowercase
        const info = cachedKeywordMap.get(match.keyword.toLowerCase());
        if (!info) continue;

        const from = pos + match.start;
        const to = pos + match.end;

        // Use CSS classes for styling (defined in styles.scss)
        // Avoids inline styles for better maintainability
        decorations.push(
          Decoration.inline(from, to, {
            class: info.isTag ? 'codex-highlight codex-tag' : 'codex-highlight codex-title',
            title: info.isTag
              ? `${info.entryTitle} - ${info.tagName} (Tag)`
              : `${info.entryTitle} (Title)`
          })
        );
      }
    }
    return true; // Continue traversing
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Update plugin with new codex entries
 * @param view - The EditorView to update (may be null if editor is destroyed)
 * @param newCodexEntries - The new codex entries to use for highlighting
 */
export function updateCodexHighlightingPlugin(view: EditorView | null, newCodexEntries: CodexEntry[]): void {
  // Guard: Check if view and view.state are valid (editor may be destroyed or not yet created)
  if (!view || !view.state) {
    return;
  }

  // Invalidate cache to force rebuild with new entries
  cachedCodexHash = null;

  const plugin = codexHighlightingKey.get(view.state);
  if (plugin) {
    const newDecorations = findCodexMatches(view.state.doc, newCodexEntries);
    const tr = view.state.tr.setMeta(codexHighlightingKey, newDecorations);
    view.dispatch(tr);
  }
}
