export function calculateDesiredSummaryWordCount(sceneText: string): number {
  const wordCount = countWords(sceneText);
  const baseWordCount = 120;
  const baseWordThreshold = 5000;

  const extraSegments = wordCount > baseWordThreshold
    ? Math.floor((wordCount - baseWordThreshold) / 1000)
    : 0;

  const target = baseWordCount + extraSegments * 20;

  return Math.max(20, Math.min(1000, target));
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
