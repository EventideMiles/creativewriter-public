import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonFooter, IonTextarea, IonAvatar, IonChip, IonLabel, IonSpinner,
  IonModal, IonList, IonItem
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBack, send, personCircle, chatbubbles, copy, refresh,
  close, helpCircle, timeOutline
} from 'ionicons/icons';

import { StoryService } from '../../services/story.service';
import { CodexService } from '../../services/codex.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { PremiumModuleService, CharacterInfo, ChatMessage, KnowledgeCutoff, StoryContext } from '../../../core/services/premium-module.service';
import { ModelService } from '../../../core/services/model.service';
import { Story } from '../../models/story.interface';
import { CodexEntry, Codex } from '../../models/codex.interface';
import { ModelOption } from '../../../core/models/model.interface';
import { AppHeaderComponent, HeaderAction } from '../../../ui/components/app-header.component';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-character-chat',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonFooter, IonTextarea, IonAvatar, IonChip, IonLabel, IonSpinner,
    IonModal, IonList, IonItem,
    AppHeaderComponent
  ],
  templateUrl: './character-chat.component.html',
  styleUrls: ['./character-chat.component.scss']
})
export class CharacterChatComponent implements OnInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private storyService = inject(StoryService);
  private codexService = inject(CodexService);
  private subscriptionService = inject(SubscriptionService);
  private premiumModuleService = inject(PremiumModuleService);
  private modelService = inject(ModelService);

  // State
  story: Story | null = null;
  codex: Codex | null = null;
  characters: CodexEntry[] = [];
  selectedCharacter: CodexEntry | null = null;
  messages: ConversationMessage[] = [];
  currentMessage = '';
  isGenerating = false;
  isPremium = false;
  isModuleLoading = false;
  moduleError: string | null = null;

  // Knowledge cutoff
  knowledgeCutoff: KnowledgeCutoff | null = null;
  showKnowledgeModal = false;

  // Model selection
  availableModels: ModelOption[] = [];
  selectedModel = '';

  // Suggested starters
  suggestedStarters: string[] = [];

  // Header actions
  headerActions: HeaderAction[] = [
    { icon: 'time-outline', action: () => this.openKnowledgeSettings(), tooltip: 'Knowledge Cutoff' },
    { icon: 'help-circle', action: () => this.showHelp(), tooltip: 'Help' }
  ];

  private subscriptions = new Subscription();

  constructor() {
    addIcons({
      arrowBack, send, personCircle, chatbubbles, copy, refresh,
      close, helpCircle, timeOutline
    });
  }

  ngOnInit(): void {
    // Check premium status
    this.subscriptions.add(
      this.subscriptionService.isPremiumObservable.subscribe(isPremium => {
        this.isPremium = isPremium;
        if (isPremium) {
          this.loadPremiumModule();
        }
      })
    );

    // Load models
    this.subscriptions.add(
      this.modelService.getCombinedModels().subscribe(models => {
        this.availableModels = models;
        if (models.length > 0 && !this.selectedModel) {
          this.selectedModel = models[0].id;
        }
      })
    );

    // Load module status
    this.subscriptions.add(
      this.premiumModuleService.isLoading.subscribe(loading => {
        this.isModuleLoading = loading;
      })
    );

    this.subscriptions.add(
      this.premiumModuleService.loadError.subscribe(error => {
        this.moduleError = error;
      })
    );

    // Load story and codex
    this.loadStoryData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private async loadStoryData(): Promise<void> {
    const storyId = this.route.snapshot.paramMap.get('storyId');
    if (!storyId) {
      this.router.navigate(['/']);
      return;
    }

    try {
      this.story = await this.storyService.getStory(storyId);
      if (!this.story) {
        this.router.navigate(['/']);
        return;
      }

      // Load codex and extract characters
      this.codex = await this.codexService.getOrCreateCodex(storyId);
      if (this.codex) {
        const charactersCategory = this.codex.categories.find(
          c => c.title.toLowerCase() === 'characters'
        );
        if (charactersCategory) {
          this.characters = charactersCategory.entries;
        }
      }

      // Check for character ID in route
      const characterId = this.route.snapshot.paramMap.get('characterId');
      if (characterId) {
        this.selectedCharacter = this.characters.find(c => c.id === characterId) || null;
        if (this.selectedCharacter) {
          this.updateSuggestedStarters();
        }
      }
    } catch (error) {
      console.error('Failed to load story data:', error);
    }
  }

  async loadPremiumModule(): Promise<void> {
    if (!this.premiumModuleService.isCharacterChatLoaded) {
      await this.premiumModuleService.loadCharacterChatModule();
    }
  }

  selectCharacter(character: CodexEntry): void {
    this.selectedCharacter = character;
    this.messages = [];
    this.updateSuggestedStarters();
  }

  private updateSuggestedStarters(): void {
    if (!this.selectedCharacter) {
      this.suggestedStarters = [];
      return;
    }

    const name = this.selectedCharacter.title;
    this.suggestedStarters = [
      `Tell me about yourself, ${name}.`,
      `What's on your mind lately?`,
      `How do you feel about the current situation?`,
      `What are your hopes and fears?`
    ];
  }

  useStarter(starter: string): void {
    this.currentMessage = starter;
    this.sendMessage();
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || !this.selectedCharacter || this.isGenerating) {
      return;
    }

    if (!this.isPremium) {
      this.moduleError = 'Premium subscription required for Character Chat';
      return;
    }

    const userMessage = this.currentMessage.trim();
    this.currentMessage = '';

    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    this.scrollToBottom();
    this.isGenerating = true;

    try {
      // Build character info from codex entry
      const characterInfo = this.buildCharacterInfo(this.selectedCharacter);
      const storyContext = this.buildStoryContext();
      const conversationHistory = this.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Get response using the AI service directly with the character prompt
      const systemPrompt = this.buildSystemPrompt(characterInfo, storyContext);
      const response = await this.generateResponse(systemPrompt, userMessage, conversationHistory);

      // Add assistant response
      this.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      this.scrollToBottom();

    } catch (error) {
      console.error('Chat error:', error);
      this.messages.push({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      });
    } finally {
      this.isGenerating = false;
    }
  }

  private buildCharacterInfo(entry: CodexEntry): CharacterInfo {
    // Parse the content field which may contain structured info
    const content = entry.content || '';

    return {
      name: entry.title,
      description: content,
      notes: entry.tags?.join(', ')
    };
  }

  private buildStoryContext(): StoryContext {
    if (!this.story) return {};

    const chapters = this.story.chapters?.map(ch => ({
      title: ch.title,
      summary: ch.scenes?.map(s => s.summary || s.title).join(' ') || '', // Build chapter summary from scenes
      order: ch.order,
      scenes: ch.scenes?.map(s => ({
        title: s.title,
        summary: s.summary,
        order: s.order
      }))
    }));

    // Build overall story summary from chapter/scene content
    const storySummary = this.story.chapters
      ?.flatMap(ch => ch.scenes?.map(s => s.summary).filter(Boolean) || [])
      .slice(0, 5) // Limit to first 5 scene summaries
      .join(' ') || this.story.title;

    return {
      summary: storySummary,
      chapters
    };
  }

  private buildSystemPrompt(character: CharacterInfo, storyContext: StoryContext): string {
    let contextInfo = storyContext.summary || '';

    if (this.knowledgeCutoff && storyContext.chapters) {
      // Filter chapters up to cutoff
      const relevantChapters = storyContext.chapters
        .filter(ch => ch.order <= this.knowledgeCutoff!.chapterOrder)
        .map(ch => {
          if (this.knowledgeCutoff!.sceneOrder && ch.order === this.knowledgeCutoff!.chapterOrder) {
            const relevantScenes = ch.scenes
              ?.filter(s => s.order <= this.knowledgeCutoff!.sceneOrder!)
              .map(s => s.summary || s.title)
              .join('\n');
            return `${ch.title}:\n${relevantScenes}`;
          }
          return `${ch.title}: ${ch.summary || ''}`;
        })
        .join('\n\n');
      contextInfo = relevantChapters;
    }

    return `You are roleplaying as ${character.name} from a story. Stay completely in character.

CHARACTER PROFILE:
Name: ${character.name}
${character.description ? `Description: ${character.description}` : ''}
${character.personality ? `Personality: ${character.personality}` : ''}
${character.background ? `Background: ${character.background}` : ''}
${character.goals ? `Goals: ${character.goals}` : ''}
${character.notes ? `Notes: ${character.notes}` : ''}

STORY CONTEXT (what your character knows):
${contextInfo}

IMPORTANT RULES:
- Respond as ${character.name} would, based on their personality, background, and knowledge
- Only reference events and information your character would know about
- Stay consistent with the character's voice, mannerisms, and speech patterns
- If asked about something your character wouldn't know, respond as the character would to unknown information
- Never break character or acknowledge you are an AI
- Keep responses conversational and natural`;
  }

  private async generateResponse(
    systemPrompt: string,
    userMessage: string,
    history: ChatMessage[]
  ): Promise<string> {
    // Use the model service to generate response
    // This is a simplified implementation - you may want to use a dedicated chat service
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: userMessage }
    ];

    // Call the appropriate AI service based on selected model
    // const [provider] = this.selectedModel.split(':');

    // For now, use a simple fetch to OpenRouter or Gemini
    // This should be refactored to use a proper chat service
    const response = await this.callAIService(messages);
    return response;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async callAIService(_messages: { role: string; content: string }[]): Promise<string> {
    // Get settings and call appropriate service
    // This is a placeholder - implement based on your existing AI service architecture
    // TODO: Wire up to existing OpenRouter/Gemini services

    // For demo purposes, return a placeholder
    // In production, wire this up to your existing AI services
    throw new Error('AI service integration needed - connect to your existing OpenRouter/Gemini services');
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop =
          this.scrollContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  // Knowledge cutoff settings
  openKnowledgeSettings(): void {
    this.showKnowledgeModal = true;
  }

  setKnowledgeCutoff(chapterOrder: number, sceneOrder?: number): void {
    this.knowledgeCutoff = { chapterOrder, sceneOrder };
    this.showKnowledgeModal = false;
  }

  clearKnowledgeCutoff(): void {
    this.knowledgeCutoff = null;
    this.showKnowledgeModal = false;
  }

  // Utility methods
  goBack(): void {
    this.router.navigate(['/story', this.story?.id]);
  }

  showHelp(): void {
    // Show help modal or tooltip
    alert('Character Chat lets you have conversations with characters from your story. Select a character to begin chatting. You can set a knowledge cutoff to limit what the character knows about the story.');
  }

  copyMessage(content: string): void {
    navigator.clipboard.writeText(content);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getProviderIcon(provider: string): string {
    switch (provider) {
      case 'gemini': return 'logo-google';
      default: return 'cloud-outline';
    }
  }

  onEnterKey(event: KeyboardEvent): void {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
