import {
  Component, Input, Output, EventEmitter,
  OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, copyOutline, checkmarkOutline } from 'ionicons/icons';

// Import Ace Editor
import * as ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-xml';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-language_tools';

@Component({
  selector: 'app-beat-ai-preview-modal',
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon],
  templateUrl: './beat-ai-preview-modal.component.html',
  styleUrls: ['./beat-ai-preview-modal.component.scss']
})
export class BeatAIPreviewModalComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() isVisible = false;
  @Input() content = '';
  @Output() closeModal = new EventEmitter<void>();

  @ViewChild('editorContainer') editorContainer!: ElementRef<HTMLDivElement>;

  copyButtonText = 'Copy';
  copyIcon = 'copy-outline';

  private editor: ace.Ace.Editor | null = null;

  ngOnInit(): void {
    addIcons({ close, copyOutline, checkmarkOutline });
  }

  ngAfterViewInit(): void {
    if (this.isVisible) {
      this.initEditor();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => this.initEditor(), 0);
      } else {
        this.destroyEditor();
      }
    }
    if (changes['content'] && this.editor) {
      this.updateContent();
    }
  }

  ngOnDestroy(): void {
    this.destroyEditor();
  }

  private initEditor(): void {
    if (this.editor || !this.editorContainer?.nativeElement) {
      return;
    }

    // Clean content before displaying
    const cleanedContent = this.cleanContent();

    // Initialize Ace Editor
    this.editor = ace.edit(this.editorContainer.nativeElement);
    this.editor.setTheme('ace/theme/monokai');
    this.editor.session.setMode('ace/mode/xml');
    this.editor.setValue(cleanedContent, -1); // -1 moves cursor to start
    this.editor.setReadOnly(true);
    this.editor.setShowPrintMargin(false);

    // Configure folding
    this.editor.setOptions({
      enableBasicAutocompletion: false,
      enableSnippets: false,
      enableLiveAutocompletion: false,
      showLineNumbers: true,
      showGutter: true,
      highlightActiveLine: false,
      fontSize: '13px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      wrap: true,
      foldStyle: 'markbegin'
    });

    // Enable code folding
    this.editor.session.setFoldStyle('markbegin');
  }

  private updateContent(): void {
    if (!this.editor) return;
    const cleanedContent = this.cleanContent();
    this.editor.setValue(cleanedContent, -1);
  }

  private cleanContent(): string {
    return this.content
      .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
      .trim();
  }

  private destroyEditor(): void {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  async onCopy(): Promise<void> {
    if (!this.content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.content);
      this.showCopySuccess();
    } catch {
      this.fallbackCopy();
    }
  }

  private showCopySuccess(): void {
    this.copyButtonText = 'Copied!';
    this.copyIcon = 'checkmark-outline';
    setTimeout(() => {
      this.copyButtonText = 'Copy';
      this.copyIcon = 'copy-outline';
    }, 1500);
  }

  private fallbackCopy(): void {
    const textArea = document.createElement('textarea');
    textArea.value = this.content;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      this.showCopySuccess();
    } catch {
      console.error('Failed to copy to clipboard');
    }

    document.body.removeChild(textArea);
  }
}
