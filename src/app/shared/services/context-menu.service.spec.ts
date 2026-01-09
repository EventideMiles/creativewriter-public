import { TestBed } from '@angular/core/testing';
import { ContextMenuService } from './context-menu.service';
import { ModalController } from '@ionic/angular/standalone';
import { EditorView } from 'prosemirror-view';
import { EditorState, TextSelection } from 'prosemirror-state';
import { schema } from 'prosemirror-schema-basic';
import { DOMParser } from 'prosemirror-model';
import { PremiumRewriteService } from './premium-rewrite.service';

describe('ContextMenuService', () => {
  let service: ContextMenuService;
  let editorView: EditorView;
  let container: HTMLElement;
  let mockModalController: jasmine.SpyObj<ModalController>;
  let mockPremiumRewriteService: jasmine.SpyObj<PremiumRewriteService>;

  beforeEach(() => {
    mockModalController = jasmine.createSpyObj('ModalController', ['create']);
    mockPremiumRewriteService = jasmine.createSpyObj('PremiumRewriteService', ['checkAndGateAccess'], {
      isPremium: true
    });

    TestBed.configureTestingModule({
      providers: [
        ContextMenuService,
        { provide: ModalController, useValue: mockModalController },
        { provide: PremiumRewriteService, useValue: mockPremiumRewriteService }
      ]
    });
    service = TestBed.inject(ContextMenuService);

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    service.hideContextMenu();
    if (editorView) {
      editorView.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('surrounding context extraction', () => {
    function createEditorWithContent(html: string): EditorView {
      const div = document.createElement('div');
      div.innerHTML = html;
      const doc = DOMParser.fromSchema(schema).parse(div);

      const state = EditorState.create({
        doc,
        schema
      });

      return new EditorView(container, { state });
    }

    function selectText(view: EditorView, fromOffset: number, toOffset: number): void {
      const tr = view.state.tr.setSelection(
        TextSelection.create(view.state.doc, fromOffset, toOffset)
      );
      view.dispatch(tr);
    }

    it('should extract text before selection', () => {
      editorView = createEditorWithContent('<p>First paragraph.</p><p>Second paragraph with selection.</p>');

      // Select "selection" in the second paragraph
      const docText = editorView.state.doc.textContent;
      const selectionStart = docText.indexOf('selection') + 1; // +1 for doc offset
      const selectionEnd = selectionStart + 'selection'.length;

      selectText(editorView, selectionStart, selectionEnd);

      const { from } = editorView.state.selection;
      const beforeText = editorView.state.doc.textBetween(0, from, '\n\n', '');

      expect(beforeText).toContain('First paragraph');
      expect(beforeText).toContain('Second paragraph');
      expect(beforeText).not.toContain('selection');
    });

    it('should extract text after selection', () => {
      editorView = createEditorWithContent('<p>First paragraph with selection.</p><p>Second paragraph.</p>');

      // Select "selection" in the first paragraph
      const docText = editorView.state.doc.textContent;
      const selectionStart = docText.indexOf('selection') + 1;
      const selectionEnd = selectionStart + 'selection'.length;

      selectText(editorView, selectionStart, selectionEnd);

      const { to } = editorView.state.selection;
      const afterText = editorView.state.doc.textBetween(to, editorView.state.doc.content.size, '\n\n', '');

      expect(afterText).toContain('Second paragraph');
      expect(afterText).not.toContain('selection');
    });

    it('should handle selection at document start', () => {
      editorView = createEditorWithContent('<p>Start of document.</p><p>More text.</p>');

      // Select "Start" at the beginning
      selectText(editorView, 1, 6); // "Start"

      const { from } = editorView.state.selection;
      const beforeText = editorView.state.doc.textBetween(0, from, '\n\n', '');

      expect(beforeText).toBe('');
    });

    it('should handle selection at document end', () => {
      editorView = createEditorWithContent('<p>Some text.</p><p>End of document.</p>');

      const docSize = editorView.state.doc.content.size;
      // Select "document." at the end
      selectText(editorView, docSize - 10, docSize - 1);

      const { to } = editorView.state.selection;
      const afterText = editorView.state.doc.textBetween(to, editorView.state.doc.content.size, '\n\n', '');

      // Should be empty or just contain trailing content
      expect(afterText.length).toBeLessThan(5);
    });

    it('should extract full paragraph text with line breaks', () => {
      editorView = createEditorWithContent(
        '<p>First paragraph.</p><p>Second paragraph.</p><p>Third with selection.</p><p>Fourth paragraph.</p>'
      );

      // Select "selection" in the third paragraph
      const docText = editorView.state.doc.textContent;
      const selectionStart = docText.indexOf('selection') + 1;
      const selectionEnd = selectionStart + 'selection'.length;

      selectText(editorView, selectionStart, selectionEnd);

      const { from, to } = editorView.state.selection;
      const beforeText = editorView.state.doc.textBetween(0, from, '\n\n', '');
      const afterText = editorView.state.doc.textBetween(to, editorView.state.doc.content.size, '\n\n', '');

      // Before should contain first two paragraphs and start of third
      expect(beforeText).toContain('First paragraph');
      expect(beforeText).toContain('Second paragraph');
      expect(beforeText).toContain('Third');

      // After should contain rest of third paragraph and fourth
      expect(afterText).toContain('Fourth paragraph');
    });

    it('should handle empty document gracefully', () => {
      editorView = createEditorWithContent('<p></p>');

      const beforeText = editorView.state.doc.textBetween(0, 1, '\n\n', '');
      const afterText = editorView.state.doc.textBetween(1, editorView.state.doc.content.size, '\n\n', '');

      expect(beforeText).toBe('');
      expect(afterText).toBe('');
    });

    it('should preserve paragraph structure in extracted text', () => {
      editorView = createEditorWithContent(
        '<p>Alpha paragraph.</p><p>Beta paragraph.</p><p>Gamma paragraph.</p>'
      );

      // Select from position 1 (just after doc start) to position 2
      // This tests that we can extract text before a selection
      selectText(editorView, 25, 30); // Positions in second paragraph

      const { from } = editorView.state.selection;
      const beforeText = editorView.state.doc.textBetween(0, from, '\n\n', '');

      // Should contain content from first paragraph (which is complete before selection)
      expect(beforeText).toContain('Alpha paragraph.');
    });
  });

  describe('createContextMenuPlugin', () => {
    it('should create a valid plugin', () => {
      const plugin = service.createContextMenuPlugin(() => '<p>test</p>', () => null);
      expect(plugin).toBeDefined();
      expect(plugin.spec).toBeDefined();
    });
  });

  describe('hideContextMenu', () => {
    it('should remove context menu from DOM', () => {
      // Manually create a context menu element
      const menu = document.createElement('div');
      menu.className = 'prosemirror-context-menu';
      document.body.appendChild(menu);

      // Access private property for testing
      (service as unknown as { contextMenuElement: HTMLElement }).contextMenuElement = menu;

      service.hideContextMenu();

      expect(document.querySelector('.prosemirror-context-menu')).toBeNull();
    });

    it('should handle case when no menu exists', () => {
      expect(() => service.hideContextMenu()).not.toThrow();
    });
  });
});
