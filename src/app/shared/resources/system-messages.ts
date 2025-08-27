import { StoryLanguage } from '../components/language-selection-dialog.component';

export const SYSTEM_MESSAGES: Record<StoryLanguage, string> = {
  en: 'You are a creative writing assistant that helps with writing stories. Maintain the style and tone of the existing story.',
  
  de: 'Du bist ein kreativer Schreibassistent, der beim Verfassen von Geschichten hilft. Behalte den Stil und Ton der bestehenden Geschichte bei.',
  
  fr: 'Vous êtes un assistant d\'écriture créative qui aide à rédiger des histoires. Maintenez le style et le ton de l\'histoire existante.',
  
  es: 'Eres un asistente de escritura creativa que ayuda a escribir historias. Mantén el estilo y el tono de la historia existente.',
  
  custom: 'You are a creative writing assistant that helps with writing stories. Maintain the style and tone of the existing story.'
};

export function getSystemMessage(language: StoryLanguage = 'en'): string {
  return SYSTEM_MESSAGES[language] || SYSTEM_MESSAGES.en;
}

// Beat generation templates for different languages
export const BEAT_GENERATION_TEMPLATES: Record<StoryLanguage, string> = {
  en: `<messages>
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

<instructions>
{pointOfView}
Write approximately {wordCount} words that continue this story.
{writingStyle}

Task: {prompt}
</instructions>

Continue the story now with {wordCount} words:</message>
</messages>`,

  de: `<messages>
<message role="system">{systemMessage}</message>
<message role="user">Du setzt eine Geschichte fort. Hier ist der Kontext:

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

<instructions>
{pointOfView}
Schreibe etwa {wordCount} Wörter, die diese Geschichte fortsetzen.
{writingStyle}

Aufgabe: {prompt}
</instructions>

Setze die Geschichte jetzt mit {wordCount} Wörtern fort:</message>
</messages>`,

  fr: `<messages>
<message role="system">{systemMessage}</message>
<message role="user">Vous continuez une histoire. Voici le contexte:

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

<instructions>
{pointOfView}
Écrivez environ {wordCount} mots qui continuent cette histoire.
{writingStyle}

Tâche: {prompt}
</instructions>

Continuez l'histoire maintenant avec {wordCount} mots:</message>
</messages>`,

  es: `<messages>
<message role="system">{systemMessage}</message>
<message role="user">Estás continuando una historia. Aquí está el contexto:

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

<instructions>
{pointOfView}
Escribe aproximadamente {wordCount} palabras que continúen esta historia.
{writingStyle}

Tarea: {prompt}
</instructions>

Continúa la historia ahora con {wordCount} palabras:</message>
</messages>`,

  custom: `<messages>
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

<instructions>
{pointOfView}
Write approximately {wordCount} words that continue this story.
{writingStyle}

Task: {prompt}
</instructions>

Continue the story now with {wordCount} words:</message>
</messages>`
};

export function getBeatGenerationTemplate(language: StoryLanguage = 'en'): string {
  return BEAT_GENERATION_TEMPLATES[language] || BEAT_GENERATION_TEMPLATES.en;
}