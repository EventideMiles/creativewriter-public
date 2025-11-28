import { StoryLanguage } from '../../ui/components/language-selection-dialog/language-selection-dialog.component';

// Cache for loaded system messages
const systemMessageCache = new Map<StoryLanguage, string>();

export async function getSystemMessage(language: StoryLanguage = 'en'): Promise<string> {
  // Check cache first
  if (systemMessageCache.has(language)) {
    return systemMessageCache.get(language)!;
  }

  try {
    const response = await fetch(`assets/templates/system-message-${language}.txt`);
    if (response.ok) {
      const message = await response.text();
      systemMessageCache.set(language, message.trim());
      return message.trim();
    }
  } catch (error) {
    console.warn(`Failed to load system message for language ${language}:`, error);
  }

  // Fallback to English
  if (language !== 'en') {
    return getSystemMessage('en');
  }
  
  // Hard fallback
  return 'You are a creative writing assistant that helps with writing stories. Maintain the style and tone of the existing story.';
}

// Cache for loaded beat generation templates
const beatTemplateCache = new Map<StoryLanguage, string>();

export async function getBeatGenerationTemplate(language: StoryLanguage = 'en'): Promise<string> {
  // Check cache first
  if (beatTemplateCache.has(language)) {
    return beatTemplateCache.get(language)!;
  }

  try {
    const response = await fetch(`assets/templates/beat-generation-${language}.template`);
    if (response.ok) {
      const template = await response.text();
      beatTemplateCache.set(language, template.trim());
      return template.trim();
    }
  } catch (error) {
    console.warn(`Failed to load beat generation template for language ${language}:`, error);
  }

  // Fallback to English
  if (language !== 'en') {
    return getBeatGenerationTemplate('en');
  }
  
  // Hard fallback
  return `<messages>
<message role="system">{systemMessage}</message>
<message role="user">You are continuing a story. Here is the context:

<story_title>{storyTitle}</story_title>

<glossary>
{codexEntries}
</glossary>

<story_context>
{storySoFar}
</story_context>

<current_scene>
{sceneFullText}
</current_scene>

<beat_generation_task>
  <objective>
    Generate the next story beat that advances the narrative from the current scene's ending point.
  </objective>

  <narrative_parameters>
    {pointOfView}
    <word_count>{wordCount} words (±50 words acceptable)</word_count>
    <tense>Match the established tense (typically past tense)</tense>
  </narrative_parameters>

  <beat_requirements>
    {prompt}
  </beat_requirements>

  <style_guidance>
    - Match the exact tone and narrative voice of the current scene
    - Maintain the established balance of dialogue, action, and introspection
    - {writingStyle}
    - End on a moment of significance, decision point, or natural transition
  </style_guidance>

  <constraints>
    - Do NOT resolve major plot threads or conflicts
    - Do NOT have characters act inconsistently with their established personalities
    - Do NOT introduce unrelated subplots or major new story elements
    - Do NOT write beyond what is specifically requested in the beat requirements
  </constraints>

  <output_format>
    Pure narrative prose. No meta-commentary, scene markers, chapter headings, or author notes.
  </output_format>
</beat_generation_task>

Generate the beat now:</message>
</messages>`;
}
