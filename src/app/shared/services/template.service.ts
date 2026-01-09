import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private readonly http = inject(HttpClient);
  private templateCache = new Map<string, string>();

  /**
   * Load a template from assets
   */
  loadTemplate(templateName: string): Observable<string> {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return of(this.templateCache.get(templateName)!);
    }

    const templatePath = `/assets/templates/${templateName}`;
    
    return this.http.get(templatePath, { responseType: 'text' }).pipe(
      map(template => {
        // Cache the template
        this.templateCache.set(templateName, template);
        return template;
      }),
      catchError(error => {
        console.error(`Failed to load template: ${templateName}`, error);
        throw new Error(`Template konnte nicht geladen werden: ${templateName}`);
      })
    );
  }

  /**
   * Process template with placeholders
   */
  processTemplate(template: string, placeholders: Record<string, string>): string {
    let processedTemplate = template;

    // Replace all placeholders
    Object.entries(placeholders).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value || '');
    });

    return processedTemplate;
  }

  /**
   * Process beat generation template from story settings
   */
  processBeatTemplateFromSettings(
    beatGenerationTemplate: string,
    placeholders: {
      SystemMessage: string;
      codexEntries: string;
      summariesOfScenesBefore: string;
      sceneFullText: string;
      wordCount: string;
      prompt: string;
    }
  ): string {
    return this.processTemplate(beatGenerationTemplate, placeholders);
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }
}