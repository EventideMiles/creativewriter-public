import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node } from 'prosemirror-model';

const directSpeechHighlightingKey = new PluginKey<DecorationSet>('directSpeechHighlighting');

/**
 * Creates a ProseMirror plugin that highlights direct speech (text in double quotes).
 * Highlights appear immediately as text is typed or streamed - no debounce.
 * Processes quotes per-paragraph, correctly handling formatted text (bold/italic).
 * Handles incomplete quotes (open without close) by highlighting to end of paragraph.
 *
 * Supports multiple quote types for compatibility with existing content:
 * - ASCII double quotes: "
 * - Curly quotes: " "
 * - German quotes: „ "
 * - Guillemets: « »
 *
 * Note: New text is normalized to ASCII by the quote normalization plugin.
 */
export function createDirectSpeechHighlightingPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: directSpeechHighlightingKey,
    state: {
      init: (_config, editorState) => findDirectSpeechMatches(editorState.doc),
      apply: (tr, oldDecorations) => {
        // Check for metadata updates
        const newDecorations = tr.getMeta(directSpeechHighlightingKey);
        if (newDecorations) return newDecorations;

        // Recalculate immediately on document changes (no debounce)
        if (tr.docChanged) {
          return findDirectSpeechMatches(tr.doc);
        }

        return oldDecorations;
      }
    },
    props: {
      decorations: (state) => directSpeechHighlightingKey.getState(state)
    }
  });
}

// Opening quote characters (ASCII and international variants)
const OPENING_QUOTES = [
  '"',      // ASCII double quote
  '\u201C', // " left double quotation mark
  '\u201E', // „ double low-9 quotation mark (German opening)
  '\u00AB', // « left-pointing double angle quotation mark
];

// Closing quote characters (ASCII and international variants)
const CLOSING_QUOTES = [
  '"',      // ASCII double quote
  '\u201D', // " right double quotation mark
  '\u201C', // " also used as German closing quote
  '\u00BB', // » right-pointing double angle quotation mark
];

/**
 * Find the next opening quote in text starting from startIndex.
 * Returns the index or -1 if not found.
 */
function findNextOpeningQuote(text: string, startIndex: number): number {
  let minIndex = -1;
  for (const quote of OPENING_QUOTES) {
    const index = text.indexOf(quote, startIndex);
    if (index !== -1 && (minIndex === -1 || index < minIndex)) {
      minIndex = index;
    }
  }
  return minIndex;
}

/**
 * Find the next closing quote in text starting from startIndex.
 * Returns the index or -1 if not found.
 */
function findNextClosingQuote(text: string, startIndex: number): number {
  let minIndex = -1;
  for (const quote of CLOSING_QUOTES) {
    const index = text.indexOf(quote, startIndex);
    if (index !== -1 && (minIndex === -1 || index < minIndex)) {
      minIndex = index;
    }
  }
  return minIndex;
}

/**
 * Represents a text segment within a paragraph with its document position.
 */
interface TextSegment {
  text: string;
  pos: number;  // Document position where this text starts
}

/**
 * Convert a text offset within combined paragraph text to a document position.
 * Returns the absolute document position for the given offset.
 */
function textOffsetToDocPos(segments: TextSegment[], offset: number): number {
  let accumulated = 0;
  for (const segment of segments) {
    if (offset < accumulated + segment.text.length) {
      return segment.pos + (offset - accumulated);
    }
    accumulated += segment.text.length;
  }
  // If offset is at the very end, return end of last segment
  const lastSegment = segments[segments.length - 1];
  return lastSegment.pos + lastSegment.text.length;
}

/**
 * Find all quoted text spans, including incomplete quotes (open without close).
 * Pattern matches:
 *   - Complete quotes: "text here"
 *   - Incomplete quotes: "text without closing (highlighted to end of paragraph)
 *
 * Quotes are matched per-paragraph, handling formatted text (bold/italic) that
 * splits text into multiple nodes.
 */
function findDirectSpeechMatches(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];

  // Process each top-level block (paragraph) in the document
  doc.forEach((block: Node, blockOffset: number) => {
    // Skip non-text blocks (images, beat AI nodes, etc.)
    if (!block.isTextblock) return;

    // Collect all text segments in this paragraph with their positions
    const segments: TextSegment[] = [];
    let combinedText = '';

    // blockOffset is relative to doc start, +1 to get inside the paragraph
    const blockStartPos = blockOffset + 1;

    block.forEach((child: Node, childOffset: number) => {
      if (child.isText && child.text) {
        segments.push({
          text: child.text,
          pos: blockStartPos + childOffset
        });
        combinedText += child.text;
      }
    });

    // Skip empty paragraphs
    if (combinedText.length === 0) return;

    // Find quotes in the combined paragraph text (supports multiple quote types)
    let i = 0;
    while (i < combinedText.length) {
      const openQuote = findNextOpeningQuote(combinedText, i);
      if (openQuote === -1) break;

      const closeQuote = findNextClosingQuote(combinedText, openQuote + 1);

      if (closeQuote !== -1) {
        // Complete quote: highlight from open to close (inclusive)
        const fromPos = textOffsetToDocPos(segments, openQuote);
        const toPos = textOffsetToDocPos(segments, closeQuote + 1);
        decorations.push(
          Decoration.inline(fromPos, toPos, {
            class: 'direct-speech-highlight'
          })
        );
        i = closeQuote + 1;
      } else {
        // Incomplete quote: highlight from open to end of paragraph
        const fromPos = textOffsetToDocPos(segments, openQuote);
        const toPos = textOffsetToDocPos(segments, combinedText.length);
        decorations.push(
          Decoration.inline(fromPos, toPos, {
            class: 'direct-speech-highlight'
          })
        );
        break;
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}
