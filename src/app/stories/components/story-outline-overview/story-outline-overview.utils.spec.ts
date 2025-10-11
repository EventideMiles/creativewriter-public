import { calculateDesiredSummaryWordCount } from './story-outline-overview.utils';

describe('calculateDesiredSummaryWordCount', () => {
  const makeSceneText = (words: number): string => Array.from({ length: words }, () => 'word').join(' ');

  it('keeps the base 120-word target for scenes up to 5000 words', () => {
    const sceneText = makeSceneText(5000);
    expect(calculateDesiredSummaryWordCount(sceneText)).toBe(120);
    expect(calculateDesiredSummaryWordCount(5000)).toBe(120);
  });

  it('adds 20 words per additional 1000 scene words beyond 5000', () => {
    const sceneText = makeSceneText(10000);
    expect(calculateDesiredSummaryWordCount(sceneText)).toBe(220);
    expect(calculateDesiredSummaryWordCount(10000)).toBe(220);
  });

  it('continues scaling for very long scenes', () => {
    const sceneText = makeSceneText(14000);
    expect(calculateDesiredSummaryWordCount(sceneText)).toBe(300);
    expect(calculateDesiredSummaryWordCount(14000)).toBe(300);
  });

});
