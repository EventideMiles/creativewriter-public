import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BeatAIModalService {
  isVisible = false;
  content = '';
  
  private closeSubject = new Subject<void>();

  close$ = this.closeSubject.asObservable();
  
  show(content: string) {
    this.content = content;
    this.isVisible = true;
  }
  
  close() {
    if (this.isVisible) {
      this.isVisible = false;
      this.closeSubject.next();
    }
  }
}