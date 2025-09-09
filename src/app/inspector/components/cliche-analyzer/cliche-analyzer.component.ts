import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonTextarea, IonButton, IonIcon, IonList, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, search } from 'ionicons/icons';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../../app/ui/components/app-header.component';
import { HeaderNavigationService } from '../../../../app/shared/services/header-navigation.service';
import { StoryService } from '../../../stories/services/story.service';
import { Story } from '../../../stories/models/story.interface';

@Component({
  selector: 'app-cliche-analyzer',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonTextarea, IonButton, IonIcon, IonList, IonBadge,
    AppHeaderComponent
  ],
  templateUrl: './cliche-analyzer.component.html',
  styleUrls: ['./cliche-analyzer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClicheAnalyzerComponent implements OnInit {
  private headerNav = inject(HeaderNavigationService);
  private route = inject(ActivatedRoute);
  private storyService = inject(StoryService);
  private router = inject(Router);

  storyId = '';
  story: Story | null = null;
  text = '';
  findings: { type: 'cliche' | 'repetition', snippet: string, count?: number }[] = [];

  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];

  constructor() {
    addIcons({ arrowBack, search });
    // Reuse common items so navigation stays consistent
    this.burgerMenuItems = this.headerNav.getCommonBurgerMenuItems();
    this.rightActions = [
      {
        icon: 'search',
        label: 'Analyze',
        action: () => this.analyze(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Analyze text for clichés and repetitions'
      }
    ];
  }

  async ngOnInit(): Promise<void> {
    this.storyId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.storyId) return;
    this.story = await this.storyService.getStory(this.storyId);
    this.text = this.extractPlainText(this.story);
    this.analyze();
  }

  goBack(): void {
    // Navigate back to the story editor if we have a story, else to list
    if (this.storyId) {
      this.router.navigate(['/stories/editor', this.storyId]);
    } else {
      this.headerNav.goToStoryList();
    }
  }

  analyze(): void {
    const text = (this.text || '').trim();
    const results: { type: 'cliche' | 'repetition', snippet: string, count?: number }[] = [];
    if (!text) {
      this.findings = [];
      return;
    }

    // Lightweight heuristic placeholders; can be replaced with AI later
    const cliches = [
      'at the end of the day', 'love at first sight', 'stronger than ever',
      'suddenly', 'unexpectedly', 'out of the blue', 'heart pounding'
    ];
    const lower = text.toLowerCase();
    cliches.forEach(c => {
      const idx = lower.indexOf(c.toLowerCase());
      if (idx !== -1) {
        results.push({ type: 'cliche', snippet: c });
      }
    });

    // Simple repetition finder: count repeated 2–4 word phrases
    const tokens = lower.replace(/\n+/g, ' ').split(/[^\p{L}\p{N}']+/u).filter(Boolean);
    for (let n = 2; n <= 4; n++) {
      const counts = new Map<string, number>();
      for (let i = 0; i + n <= tokens.length; i++) {
        const phrase = tokens.slice(i, i + n).join(' ');
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }
      counts.forEach((count, phrase) => {
        if (count >= 3 && phrase.length >= 8) {
          results.push({ type: 'repetition', snippet: phrase, count });
        }
      });
    }

    this.findings = results.slice(0, 50);
  }

  private extractPlainText(story: Story | null): string {
    if (!story) return '';
    let text = '';
    // Legacy content
    const anyStory = story as unknown as { content?: string };
    if (anyStory.content) {
      text += this.stripHtmlTags(anyStory.content) + '\n';
    }
    // Chapters/scenes
    if (Array.isArray(story.chapters)) {
      story.chapters.forEach(ch => {
        ch.scenes?.forEach(sc => {
          if (sc.content) text += this.stripHtmlTags(sc.content) + '\n';
        });
      });
    }
    return text.trim();
  }

  private stripHtmlTags(html: string): string {
    if (!html) return '';
    const cleanHtml = html.replace(/<div[^>]*class="beat-ai-node"[^>]*>.*?<\/div>/gs, '');
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanHtml, 'text/html');
    const textContent = doc.body.textContent || '';
    return textContent
      .replace(/🎭\s*Beat\s*AI/gi, '')
      .replace(/Prompt:\s*/gi, '')
      .replace(/BeatAIPrompt/gi, '')
      .trim()
      .replace(/\s+/g, ' ');
  }
}
