import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { defineCustomElements } from '@ionic/core/loader';
import { addIcons } from 'ionicons';
import { register as registerSwiper } from 'swiper/element/bundle';
import {
  openrouterCustom,
  claudeCustom,
  ollamaCustom,
  replicateCustom,
  falCustom
} from './app/core/custom-icons';

// Register Swiper custom elements
registerSwiper();

// Register custom icons globally for use with ion-icon
addIcons({
  'openrouter-custom': openrouterCustom,
  'claude-custom': claudeCustom,
  'ollama-custom': ollamaCustom,
  'replicate-custom': replicateCustom,
  'fal-custom': falCustom
});

// Initialize Ionic with error handling for better browser compatibility
try {
  defineCustomElements(window);
} catch (error) {
  console.error('Error initializing Ionic custom elements:', error);
  // Continue with bootstrap even if custom elements fail to register
  // Angular will still work, but Ionic components might have issues
}

bootstrapApplication(App, appConfig)
  .catch((err) => {
    console.error('Error bootstrapping application:', err);
    // Display user-friendly error message
    document.body.innerHTML = `
      <div style="font-family: system-ui; padding: 20px; max-width: 600px; margin: 50px auto;">
        <h1 style="color: #d32f2f;">Application Error</h1>
        <p>The application failed to start. This may be due to browser compatibility issues.</p>
        <p><strong>Suggestions:</strong></p>
        <ul>
          <li>Try clearing your browser cache and reload the page</li>
          <li>Disable browser extensions and try again</li>
          <li>Try using a different browser</li>
          <li>Check the browser console for more details</li>
        </ul>
        <details style="margin-top: 20px;">
          <summary style="cursor: pointer; color: #1976d2;">Technical details</summary>
          <pre style="background: #f5f5f5; padding: 10px; overflow: auto; margin-top: 10px;">${err}</pre>
        </details>
      </div>
    `;
  });
