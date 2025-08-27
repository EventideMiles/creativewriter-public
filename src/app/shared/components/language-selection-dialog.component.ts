import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonItem, IonRadioGroup, IonRadio,
  ModalController
} from '@ionic/angular/standalone';

export type StoryLanguage = 'en' | 'de' | 'fr' | 'es' | 'custom';

@Component({
  selector: 'app-language-selection-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonItem, IonRadioGroup, IonRadio
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Story Language</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" (click)="dismiss()">
            Cancel
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <p class="description">
        Choose the language for your story. This will set the AI assistant's language for generating content.
      </p>
      
      <ion-radio-group [(ngModel)]="selectedLanguage">
        <div class="language-option" [class.selected]="selectedLanguage === 'en'">
          <ion-item button (click)="selectLanguage('en')">
            <div class="language-info">
              <h2>English</h2>
              <p>AI will assist in English</p>
            </div>
            <ion-radio slot="end" value="en"></ion-radio>
          </ion-item>
        </div>
        
        <div class="language-option" [class.selected]="selectedLanguage === 'de'">
          <ion-item button (click)="selectLanguage('de')">
            <div class="language-info">
              <h2>Deutsch</h2>
              <p>KI-Assistent auf Deutsch</p>
            </div>
            <ion-radio slot="end" value="de"></ion-radio>
          </ion-item>
        </div>
        
        <div class="language-option" [class.selected]="selectedLanguage === 'fr'">
          <ion-item button (click)="selectLanguage('fr')">
            <div class="language-info">
              <h2>Français</h2>
              <p>Assistant IA en français</p>
            </div>
            <ion-radio slot="end" value="fr"></ion-radio>
          </ion-item>
        </div>
        
        <div class="language-option" [class.selected]="selectedLanguage === 'es'">
          <ion-item button (click)="selectLanguage('es')">
            <div class="language-info">
              <h2>Español</h2>
              <p>Asistente de IA en español</p>
            </div>
            <ion-radio slot="end" value="es"></ion-radio>
          </ion-item>
        </div>
        
        <div class="language-option" [class.selected]="selectedLanguage === 'custom'">
          <ion-item button (click)="selectLanguage('custom')">
            <div class="language-info">
              <h2>Custom Language</h2>
              <p>Use default English, customize later in settings</p>
            </div>
            <ion-radio slot="end" value="custom"></ion-radio>
          </ion-item>
        </div>
      </ion-radio-group>
      
      <div class="button-container">
        <ion-button 
          expand="block" 
          (click)="confirm()" 
          [disabled]="!selectedLanguage"
          class="create-button">
          Create Story
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-header {
      --background: rgba(45, 45, 45, 0.95);
    }

    ion-toolbar {
      --background: transparent;
      --color: #f8f9fa;
    }

    ion-title {
      font-weight: 600;
      color: #f8f9fa;
    }

    ion-content {
      --background: rgba(25, 25, 25, 0.98);
      --color: #f8f9fa;
    }

    .description {
      padding: 1rem;
      color: #f8f9fa;
      font-size: 0.9rem;
    }

    .language-option {
      margin: 0.5rem 1rem;
      background: rgba(40, 40, 40, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .language-option.selected {
      background: rgba(71, 118, 230, 0.2);
      border-color: #4776e6;
    }

    .language-option ion-item {
      --background: transparent;
      --padding-start: 1rem;
      --padding-end: 1rem;
    }

    .language-info h2 {
      color: #f8f9fa;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }

    .language-info p {
      color: #adb5bd;
      font-size: 0.85rem;
    }

    .button-container {
      padding: 1rem;
      margin-top: 1rem;
    }

    .create-button {
      --background: #4776e6;
      --color: white;
      font-weight: 600;
    }
  `]
})
export class LanguageSelectionDialogComponent {
  private modalCtrl = inject(ModalController);
  
  selectedLanguage: StoryLanguage = 'en';

  selectLanguage(language: StoryLanguage) {
    this.selectedLanguage = language;
  }

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.modalCtrl.dismiss(this.selectedLanguage, 'confirm');
  }
}