import { Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { Node } from 'prosemirror-model';

const quoteNormalizationKey = new PluginKey('quoteNormalization');

/**
 * Map of quote characters to normalize to ASCII double quote.
 * Includes:
 * - Left double quotation mark: " (U+201C)
 * - Right double quotation mark: " (U+201D)
 * - Double low-9 quotation mark: „ (U+201E) - German opening quote
 * - Double high-reversed-9 quotation mark: ‟ (U+201F)
 * - Left-pointing double angle quotation mark: « (U+00AB) - French/guillemet
 * - Right-pointing double angle quotation mark: » (U+00BB) - French/guillemet
 */
const QUOTE_REPLACEMENTS: Record<string, string> = {
  '\u201C': '"',  // " left double quotation mark
  '\u201D': '"',  // " right double quotation mark
  '\u201E': '"',  // „ double low-9 quotation mark (German opening)
  '\u201F': '"',  // ‟ double high-reversed-9 quotation mark
  '\u00AB': '"',  // « left-pointing double angle quotation mark
  '\u00BB': '"',  // » right-pointing double angle quotation mark
};

// Build regex pattern from all quote characters
const QUOTE_PATTERN = new RegExp(`[${Object.keys(QUOTE_REPLACEMENTS).join('')}]`, 'g');

/**
 * Check if text contains any non-ASCII quotes that need normalization.
 */
function containsNonAsciiQuotes(text: string): boolean {
  return QUOTE_PATTERN.test(text);
}

/**
 * Normalize all non-ASCII quotes in text to ASCII double quotes.
 */
function normalizeQuotes(text: string): string {
  return text.replace(QUOTE_PATTERN, (match) => QUOTE_REPLACEMENTS[match] || '"');
}

/**
 * Creates a ProseMirror plugin that normalizes quote characters to ASCII.
 * Converts curly quotes, German quotes, and guillemets to standard " as text
 * is typed or streamed (e.g., from AI generation).
 *
 * This ensures consistent quote handling throughout the editor and simplifies
 * direct speech highlighting.
 */
export function createQuoteNormalizationPlugin(): Plugin {
  return new Plugin({
    key: quoteNormalizationKey,

    // Filter transactions to normalize quotes in inserted text
    filterTransaction(tr: Transaction): boolean {
      // Only process transactions that change the document
      if (!tr.docChanged) return true;

      // Check each step for text insertions containing non-ASCII quotes
      let needsNormalization = false;

      tr.steps.forEach((step) => {
        // Get the step as JSON to inspect it
        const stepJson = step.toJSON();

        // Check for ReplaceStep with text content
        if (stepJson.stepType === 'replace' && stepJson.slice?.content) {
          const content = stepJson.slice.content;
          for (const node of content) {
            if (node.type === 'text' && node.text && containsNonAsciiQuotes(node.text)) {
              needsNormalization = true;
            }
          }
        }
      });

      // If no normalization needed, allow transaction as-is
      if (!needsNormalization) return true;

      // We'll handle normalization in appendTransaction instead
      return true;
    },

    // Append a normalizing transaction if needed
    appendTransaction(transactions: readonly Transaction[], _oldState, newState) {
      // Check if any transaction introduced non-ASCII quotes
      const hasDocChange = transactions.some(tr => tr.docChanged);
      if (!hasDocChange) return null;

      // Scan the document for non-ASCII quotes
      const replacements: { from: number; to: number; text: string }[] = [];

      newState.doc.descendants((node: Node, pos: number) => {
        if (node.isText && node.text && containsNonAsciiQuotes(node.text)) {
          const normalizedText = normalizeQuotes(node.text);
          if (normalizedText !== node.text) {
            replacements.push({
              from: pos,
              to: pos + node.text.length,
              text: normalizedText
            });
          }
        }
        return true;
      });

      // If no replacements needed, return null
      if (replacements.length === 0) return null;

      // Create a transaction to replace non-ASCII quotes
      let tr = newState.tr;

      // Apply replacements in reverse order to maintain positions
      for (let i = replacements.length - 1; i >= 0; i--) {
        const { from, to, text } = replacements[i];
        tr = tr.replaceWith(from, to, newState.schema.text(text));
      }

      // Mark this transaction to avoid infinite loops
      tr.setMeta(quoteNormalizationKey, true);
      tr.setMeta('addToHistory', false); // Don't add normalization to undo history

      return tr;
    }
  });
}
