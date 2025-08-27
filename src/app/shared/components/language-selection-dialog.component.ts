import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonItem, IonLabel, IonRadioGroup, IonRadio, IonList,
  ModalController
} from '@ionic/angular/standalone';

export type StoryLanguage = 'en' | 'de' | 'fr' | 'es' | 'custom';

@Component({
  selector: 'app-language-selection-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonItem, IonLabel, IonRadioGroup, IonRadio, IonList
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Story Language</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p class="description">
        Choose the language for your story. This will set the AI assistant's language for generating content.
      </p>
      <ion-list>
        <ion-radio-group [(ngModel)]="selectedLanguage">
          <ion-item>
            <ion-label>
              <h2>English</h2>
              <p>AI will assist in English</p>
            </ion-label>
            <ion-radio slot="start" value="en"></ion-radio>
          </ion-item>
          <ion-item>
            <ion-label>
              <h2>Deutsch</h2>
              <p>KI-Assistent auf Deutsch</p>
            </ion-label>
            <ion-radio slot="start" value="de"></ion-radio>
          </ion-item>
          <ion-item>
            <ion-label>
              <h2>Français</h2>
              <p>Assistant IA en français</p>
            </ion-label>
            <ion-radio slot="start" value="fr"></ion-radio>
          </ion-item>
          <ion-item>
            <ion-label>
              <h2>Español</h2>
              <p>Asistente de IA en español</p>
            </ion-label>
            <ion-radio slot="start" value="es"></ion-radio>
          </ion-item>
          <ion-item>
            <ion-label>
              <h2>Custom Language</h2>
              <p>Use default English, customize later in settings</p>
            </ion-label>
            <ion-radio slot="start" value="custom"></ion-radio>
          </ion-item>
        </ion-radio-group>
      </ion-list>
      <div class="button-container">
        <ion-button expand="block" (click)="confirm()" [disabled]="!selectedLanguage">
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
    
    ion-content {
      --background: rgba(25, 25, 25, 0.95);
    }
    
    .description {
      margin: 16px 0;
      color: #f8f9fa;
    }
    
    .button-container {
      margin-top: 24px;
    }
    
    ion-list {
      background: transparent;
    }
    
    ion-item {
      --background: rgba(40, 40, 40, 0.5);
      --color: #f8f9fa;
      --padding-start: 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    ion-item:hover {
      --background: rgba(50, 50, 50, 0.6);
    }
    
    ion-label h2 {
      font-weight: 600;
      margin-bottom: 4px;
      color: #f8f9fa;
    }
    
    ion-label p {
      font-size: 0.875rem;
      color: #adb5bd;
    }
    
    ion-radio {
      --color: #4776e6;
      --color-checked: #8bb4f8;
    }
    
    ion-button {
      --background: #4776e6;
      --color: white;
      font-weight: 600;
    }
  `]
})
export class LanguageSelectionDialogComponent {
  private modalCtrl = inject(ModalController);
  
  selectedLanguage: StoryLanguage = 'en';

  dismiss() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    this.modalCtrl.dismiss(this.selectedLanguage, 'confirm');
  }
}