import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonTextarea, IonButton, IonIcon, IonList, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, search, analyticsOutline, sparklesOutline } from 'ionicons/icons';
import { AppHeaderComponent, BurgerMenuItem, HeaderAction } from '../../../ui/components/app-header.component';
import { HeaderNavigationService } from '../../../shared/services/header-navigation.service';

@Component({
  selector: 'app-klischee-analyser',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonTextarea, IonButton, IonIcon, IonList, IonBadge,
    AppHeaderComponent
  ],
  templateUrl: './klischee-analyser.component.html',
  styleUrls: ['./klischee-analyser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KlischeeAnalyserComponent {
  private headerNav = inject(HeaderNavigationService);

  text = '';
  findings: { type: 'cliche' | 'repetition', snippet: string, count?: number }[] = [];

  burgerMenuItems: BurgerMenuItem[] = [];
  rightActions: HeaderAction[] = [];

  constructor() {
    addIcons({ arrowBack, search, analyticsOutline, sparklesOutline });
    // Reuse common items so navigation stays consistent
    this.burgerMenuItems = this.headerNav.getCommonBurgerMenuItems();
    this.rightActions = [
      {
        icon: 'search',
        label: 'Analyse',
        action: () => this.analyse(),
        showOnMobile: true,
        showOnDesktop: true,
        tooltip: 'Text auf Klischees und Wiederholungen prüfen'
      }
    ];
  }

  goBack(): void {
    this.headerNav.goToStoryList();
  }

  analyse(): void {
    const text = (this.text || '').trim();
    const results: { type: 'cliche' | 'repetition', snippet: string, count?: number }[] = [];
    if (!text) {
      this.findings = [];
      return;
    }

    // Very lightweight heuristic placeholders; real logic can be AI-backed later.
    const cliches = [
      'am Ende des Tages', 'Liebe auf den ersten Blick', 'stärker als je zuvor',
      'plötzlich', 'unerwartet', 'wie aus heiterem Himmel', 'schlug ihr Herz bis zum Hals'
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
}

