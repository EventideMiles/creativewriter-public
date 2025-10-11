export function calculateDesiredSummaryWordCount(input: string | number): number {
  const wordCount = typeof input === 'number' ? input : countWords(input);
  const baseWordCount = 120;
  const baseWordThreshold = 5000;

  const extraSegments = wordCount > baseWordThreshold
    ? Math.floor((wordCount - baseWordThreshold) / 1000)
    : 0;

  const target = baseWordCount + extraSegments * 20;

  console.debug('[SceneSummary] wordCount:', wordCount, 'targetWordCount:', target);

  return Math.max(20, Math.min(1000, target));
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
