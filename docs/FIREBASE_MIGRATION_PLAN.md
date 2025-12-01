# Firebase Migration Plan - Creative Writer 2

> **Status:** Planung (Enhanced v2)
> **Erstellt:** 2025-12-01
> **Aktualisiert:** 2025-12-01 (Research & Codebase Analysis)
> **Zielgruppe:** ~500 aktive Accounts
> **Geschätzter Aufwand:** 6-8 Wochen (realistisch)

---

## Inhaltsverzeichnis

1. [Executive Summary](#executive-summary)
2. [Aktuelle Architektur](#aktuelle-architektur)
3. [Codebase-Analyse](#codebase-analyse)
4. [Firebase-Zielarchitektur](#firebase-zielarchitektur)
5. [Kostenanalyse](#kostenanalyse)
6. [Kostenoptimierung](#kostenoptimierung)
7. [Datenmodell](#datenmodell)
8. [Migrationsplan](#migrationsplan)
9. [Security Rules](#security-rules)
10. [Service-Änderungen](#service-änderungen)
11. [Testing-Strategie](#testing-strategie)
12. [Risiken & Mitigationen](#risiken--mitigationen)

---

## Executive Summary

### Wichtige Erkenntnisse aus der Codebase-Analyse

| Metrik | Wert | Impact |
|--------|------|--------|
| **PouchDB/CouchDB Referenzen** | 878+ | Hoher Migrationsaufwand |
| **Betroffene Dateien** | 22+ | Mehr als ursprünglich geschätzt |
| **localStorage-Nutzung** | 14 Services | Zusätzlicher Migrationsaufwand |
| **Separate PouchDB-Datenbanken** | 3 | Stories, Beat-History, Backgrounds |
| **Base64-Bilder in Dokumenten** | Ja | Müssen zu Firebase Storage migriert werden |

### Firebase 2025 Status

| Komponente | Status | Wichtige Änderung |
|------------|--------|-------------------|
| **AngularFire** | v20.0.1 | Voll kompatibel mit Angular 19 |
| **Cloud Storage** | Blaze erforderlich | Alle neuen Buckets benötigen Blaze Plan (seit Okt 2024) |
| **Offline Persistence** | Verbessert | `persistentMultipleTabManager()` für Multi-Tab |
| **Kostenoptimierung** | 30-40% möglich | Durch `lastUpdated` incremental sync |

### Realistische Zeitplanung

| Original-Schätzung | Realistische Schätzung | Grund |
|-------------------|------------------------|-------|
| 14 Tage | **6-8 Wochen** | Tiefe PouchDB-Integration, umfangreiche Tests nötig |

---

## Aktuelle Architektur

| Komponente | Aktuelle Technologie | Firebase-Ziel |
|------------|---------------------|---------------|
| **Lokale DB** | PouchDB (IndexedDB) | Firestore mit Offline-Persistence |
| **Remote DB** | CouchDB (Docker) | Firestore (Cloud) |
| **Auth** | Custom (localStorage) | Firebase Authentication |
| **Dateispeicher** | Base64 in Dokumenten | Firebase Storage |
| **Hosting** | nginx/Docker | Firebase Hosting |
| **Sync** | PouchDB bidirektional | Firestore Realtime Listeners |

### Aktuelle Services

- `database.service.ts` - PouchDB/CouchDB Management
- `auth.service.ts` - Custom localStorage Auth
- `story.service.ts` - Story CRUD
- `codex.service.ts` - Codex Management
- `settings.service.ts` - App Settings (localStorage)
- `story-metadata-index.service.ts` - Story-Index für Performance

### Aktuelle Datenmodelle

- **Stories**: Verschachtelte Struktur (Story → Chapters → Scenes)
- **Codex**: Pro Story, Kategorien mit Entries
- **Settings**: localStorage JSON
- **Custom Backgrounds**: Base64 in PouchDB

### Aktuelle Datenbank-Architektur

```
Browser (IndexedDB)
    ↓ PouchDB
    ↓ Sync (bidirektional)
    ↓ Reverse Proxy /_db/
    ↓ CouchDB Container
    ↓ Data Volume (/opt/couchdb/data)
```

**Separate Datenbanken:**

| Datenbank | Scope | Synchronisiert | Zweck |
|-----------|-------|----------------|-------|
| creative-writer-stories-anonymous | Anonyme User | Nein | Lokale Stories |
| creative-writer-stories-{username} | Pro User | Ja zu CouchDB | User-Stories |
| beat-histories | Lokal | Nein | Beat-Versionierung |
| custom-backgrounds (attachments) | Pro User | Ja zu CouchDB | Hintergrundbilder |

---

## Codebase-Analyse

### Detaillierte Datei-Analyse

#### Core Services (Kritisch - MUSS geändert werden)

| Datei | Zeilen | Impact | Änderungsaufwand |
|-------|--------|--------|------------------|
| `core/services/database.service.ts` | 350+ | Kritisch | Ersetzen durch firestore.service.ts |
| `core/services/auth.service.ts` | ~100 | Kritisch | Komplettes Refactoring für Firebase |
| `core/services/settings.service.ts` | ~90 | Hoch | localStorage → Firestore |
| `core/services/codex.service.ts` | ~50 | Hoch | localStorage → Firestore |
| `stories/services/story.service.ts` | ~140 | Kritisch | Firestore Queries |
| `stories/services/story-metadata-index.service.ts` | ~85 | Mittel | Evtl. entfernen |

#### Shared Services (Wichtige Änderungen)

| Datei | Aktuelle Funktion | Firebase-Migration |
|-------|-------------------|-------------------|
| `shared/services/beat-history.service.ts` | Separate PouchDB für Versionen | Entscheidung: Cloud-Sync oder lokal? |
| `shared/services/synced-custom-background.service.ts` | PouchDB Attachments (Base64) | Firebase Storage + URLs |
| `shared/services/database-backup.service.ts` | Export mit Attachments | Anpassen für Firestore |
| `shared/services/db-maintenance.service.ts` | Komprimierung/Cleanup | Entfernen oder ersetzen |

#### Komponenten (UI-Updates erforderlich)

| Komponente | Änderungsgrund |
|------------|----------------|
| `ui/components/login.component.ts` | Komplett neu: Email/Password + Google Sign-In |
| `ui/components/sync-status.component.ts` | Firestore pending writes statt PouchDB sync |
| `stories/components/story-list/story-list.component.ts` | Neue Firestore-Abfragen |
| `stories/components/story-editor/story-editor.component.ts` | Neuer Auto-Save-Mechanismus |
| `stories/components/story-settings/story-settings.component.ts` | Cover-Image zu Storage |
| `stories/components/codex/codex.component.ts` | Firestore-Datenquelle |
| `ui/components/background-selector.component.ts` | Firebase Storage URLs |

### localStorage-Schlüssel (14 Dateien betroffen)

```typescript
// Alle zu migrierenden localStorage-Schlüssel:
'creative-writer-local-only'     // auth.service.ts
'creative-writer-user'           // auth.service.ts
'creative-writer-settings'       // settings.service.ts
'creative-writer-codex'          // codex.service.ts
// + Device-spezifische Caches
// + Debug-Logs
// + Analyse-Caches (character-consistency, cliche-analysis)
```

### Kritische Code-Patterns die geändert werden müssen

**1. PouchDB Direktzugriff:**
```typescript
// AKTUELL:
const db = await this.databaseService.getDatabase();
const result = await db.allDocs({ include_docs: true });

// NEU (Firestore):
const q = query(collection(firestore, 'users', userId, 'stories'), limit(50));
const snapshot = await getDocs(q);
```

**2. Selective Sync Filter (database.service.ts, Zeile 343-360):**
```typescript
// AKTUELL (nicht direkt übertragbar auf Firestore):
filter: (doc) => {
  if (this.activeStoryId && doc.storyId !== this.activeStoryId) return false;
  return !doc._id.startsWith('snapshot-');
}

// NEU (Firestore): Query-basierte Filterung
const q = query(
  collection(firestore, 'stories'),
  where('userId', '==', currentUser.uid),
  where('id', '==', activeStoryId)
);
```

**3. Base64 Image Handling:**
```typescript
// AKTUELL (synced-custom-background.service.ts):
const base64Data = await this.fileToBase64(file);
_attachments: { [name]: { data: base64Data } }

// NEU (Firebase Storage):
const storageRef = ref(storage, `users/${uid}/backgrounds/${file.name}`);
await uploadBytes(storageRef, file);
const url = await getDownloadURL(storageRef);
```

---

## Firebase-Zielarchitektur

### Services (Firebase)

- Firebase Authentication (Email/Password + Google)
- Cloud Firestore (Offline Persistence)
- Firebase Storage (Bilder, Backgrounds)
- Firebase Hosting (Angular SPA)

### Angular Integration

```typescript
// app.config.ts
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() =>
      initializeFirestore(getApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: 100 * 1024 * 1024 // 100 MB
        })
      })
    ),
    provideStorage(() => getStorage()),
    // ... andere Provider
  ]
};
```

---

## Kostenanalyse

### Firebase Free Tier (Spark Plan)

| Service | Free Tier | Reicht für 500 User? |
|---------|-----------|---------------------|
| **Authentication** | 50.000 MAU | ✅ Ja (100x Reserve) |
| **Firestore Reads** | 50.000/Tag | ⚠️ Knapp |
| **Firestore Writes** | 20.000/Tag | ⚠️ Knapp |
| **Firestore Storage** | 1 GB | ❌ Wahrscheinlich nicht |
| **Cloud Storage** | 5 GB | ⚠️ Abhängig von Bildern |
| **Hosting** | 10 GB/Monat | ✅ Ja |

### Geschätzter Verbrauch pro User/Tag

**Annahmen für einen aktiven Schreiber:**
- Öffnet App: ~50 Reads (Story-Liste, Settings, aktive Story laden)
- Arbeitet 1h an Story: ~100 Writes (Auto-Save alle 30s, Scene-Updates)
- Navigiert zwischen Scenes: ~30 Reads
- Codex-Nutzung: ~20 Reads

| Metrik | Pro User/Tag | 500 User/Tag | Pro Monat |
|--------|-------------|--------------|-----------|
| **Reads** | ~100 | 50.000 | 1.5 Mio |
| **Writes** | ~100 | 50.000 | 1.5 Mio |
| **Storage** | ~5 MB | 2.5 GB | +2.5 GB/Monat |

### Monatliche Kosten (Blaze Plan)

| Service | Verbrauch | Kosten/Monat |
|---------|-----------|--------------|
| **Authentication** | 500 MAU | **$0** (Free Tier) |
| **Firestore Reads** | 1.5 Mio | **$0.90** |
| **Firestore Writes** | 1.5 Mio | **$2.70** |
| **Firestore Storage** | ~10 GB | **$1.80** |
| **Cloud Storage** | ~5 GB | **$0.13** |
| **Hosting** | ~20 GB | **$0** (Free Tier) |
| **Network Egress** | ~50 GB | **~$5.00** |
| **GESAMT** | | **~$10-15/Monat** |

**Worst Case (alle 500 User sehr aktiv):** ~$25-30/Monat

### Kosten pro User

- **Normal:** ~$0.02-0.03/User/Monat
- **Worst Case:** ~$0.05-0.06/User/Monat

---

## Kostenoptimierung

### Strategie 1: Incremental Sync mit `lastUpdated`

**Potenzielle Einsparung: 30-40% bei Reads**

```typescript
// Implementierung: Nur geänderte Dokumente laden
interface CachedData {
  lastSyncTimestamp: number;
  data: any[];
}

// Query nur für Änderungen seit letztem Sync
const q = query(
  collection(firestore, 'stories'),
  where('updatedAt', '>', lastSyncTimestamp),
  where('userId', '==', currentUser.uid)
);
```

### Strategie 2: Firestore Built-in Caching

- Offline Persistence aktivieren (bereits im Plan)
- Cache-Reads sind **KOSTENLOS**
- Nur neue Daten/Änderungen lösen kostenpflichtige Reads aus
- Cache-Größe: 100 MB (konfigurierbar)

### Strategie 3: Query-Optimierung

```typescript
// SCHLECHT: Lädt alle Dokumente
const allStories = await getDocs(collection(firestore, 'stories'));

// GUT: Limitierte Abfrage mit Pagination
const q = query(
  collection(firestore, 'stories'),
  where('userId', '==', uid),
  orderBy('updatedAt', 'desc'),
  limit(20),
  startAfter(lastDoc)
);
```

**Wichtig:** Jedes zurückgegebene Dokument = 1 Read (nicht pro Query!)

### Strategie 4: Batched Operations

```typescript
// Effizienter als einzelne Schreibvorgänge
const batch = writeBatch(firestore);
batch.update(ref1, data1);
batch.update(ref2, data2);
batch.update(ref3, data3);
await batch.commit(); // Zählt als einzelne Writes, aber effizienter
```

### Strategie 5: Denormalisierung

**Trade-off:** Mehr Storage/Writes vs. weniger Reads

```typescript
// STATT (2 Reads):
const story = await getDoc(storyRef);
const user = await getDoc(userRef);

// BESSER (1 Read):
interface StoryWithAuthor {
  ...storyData,
  authorName: string,  // Denormalisiert
  authorId: string
}
```

### Strategie 6: Budget-Alerts einrichten

```
Google Cloud Console → Billing → Budgets & Alerts
- Alert bei $15/Monat (50%)
- Alert bei $25/Monat (75%)
- Alert bei $35/Monat (100%)
```

### Monitoring-Dashboard

```typescript
// Implementiere Kosten-Tracking im Service
class FirebaseCostMonitor {
  async getDailyReadCount(): Promise<number>
  async getDailyWriteCount(): Promise<number>
  async estimateMonthlyCost(): Promise<number>
  async alertIfOverBudget(threshold: number): Promise<void>
}
```

---

## Datenmodell

### Optimierte Firestore-Struktur (Chapter-weise Splitting)

Die Struktur ist auf **Skalierbarkeit** optimiert - Chapters werden immer als Subcollection gespeichert.

```
users/{userId}
  ├── profile              // 1 Dokument
  │   └── { displayName, email, settings, createdAt, lastLogin }
  │
  └── storyIndex           // 1 Dokument
      └── { stories: StoryMetadata[], updatedAt }

stories/{storyId}
  ├── metadata             // 1 Dokument (Story-Metadaten)
  │   └── { userId, title, coverImage, settings, chapterOrder[], createdAt, updatedAt }
  │
  ├── chapters/            // Subcollection (IMMER chapter-weise)
  │   └── {chapterId}
  │       └── { title, scenes[], order, createdAt, updatedAt }
  │
  ├── codex                // 1 Dokument
  │   └── { userId, categories[], updatedAt }
  │
  └── beatHistory/         // Subcollection (Cloud-Sync ✅)
      └── {sceneId}
          └── { versions[], updatedAt }

userMedia/{userId}
  └── backgrounds          // 1 Dokument
      └── { items: Background[], updatedAt }
```

**Vorteile des Chapter-wise Splitting:**
- ✅ Keine 1MB-Limitierung mehr (jedes Chapter einzeln)
- ✅ Bessere Performance (nur aktives Chapter laden)
- ✅ Paralleles Laden möglich
- ✅ Granularere Sync (nur geändertes Chapter)
- ⚠️ Mehr Reads (1 pro Chapter) - durch Caching mitigiert

### TypeScript Interfaces (Chapter-weise Struktur)

```typescript
// users/{userId}/profile
interface UserProfile {
  displayName: string;
  email: string;
  settings: Settings;
  createdAt: Timestamp;
  lastLogin: Timestamp;
}

// users/{userId}/storyIndex
interface StoryIndex {
  stories: StoryMetadata[];
  updatedAt: Timestamp;
}

interface StoryMetadata {
  id: string;
  title: string;
  coverImage?: string;      // Firebase Storage URL
  chapterCount: number;
  sceneCount: number;
  wordCount: number;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

// stories/{storyId}/metadata (NEU: Nur Metadaten, keine Chapters)
interface StoryMetadataDoc {
  userId: string;
  title: string;
  coverImage?: string;      // Firebase Storage URL
  settings?: StorySettings;
  chapterOrder: string[];   // Array von Chapter-IDs für Reihenfolge
  schemaVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// stories/{storyId}/chapters/{chapterId} (NEU: Subcollection)
interface ChapterDoc {
  id: string;
  title: string;
  scenes: Scene[];          // Scenes bleiben im Chapter
  order: number;            // Position in der Story
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Scene bleibt Teil des Chapters (typisch < 50KB pro Scene)
interface Scene {
  id: string;
  title: string;
  beat: string;             // Scene-Inhalt
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// stories/{storyId}/codex
interface StoryCodex {
  userId: string;
  categories: CodexCategory[];
  updatedAt: Timestamp;
}

// stories/{storyId}/beatHistory/{sceneId} (Cloud-Sync ✅)
interface SceneBeatHistory {
  sceneId: string;
  storyId: string;          // Für Collection Group Queries
  chapterId: string;        // Für Referenz
  versions: BeatVersion[];
  updatedAt: Timestamp;
}

interface BeatVersion {
  id: string;
  content: string;
  createdAt: Timestamp;
  source: 'user' | 'ai';    // Wer hat diese Version erstellt
}

// userMedia/{userId}/backgrounds
interface UserBackgrounds {
  items: CustomBackground[];
  updatedAt: Timestamp;
}

interface CustomBackground {
  id: string;
  name: string;
  storageUrl: string;       // Firebase Storage Download-URL
  storagePath: string;      // Firebase Storage Pfad für Löschung
  createdAt: Timestamp;
}
```

### Ladestrategien für Chapter-weise Struktur

```typescript
// 1. Story öffnen: Nur Metadaten laden (1 Read)
async loadStoryMetadata(storyId: string): Promise<StoryMetadataDoc> {
  const ref = doc(this.firestore, `stories/${storyId}/metadata`);
  return (await getDoc(ref)).data();
}

// 2. Alle Chapters laden (N Reads, N = Anzahl Chapters)
async loadAllChapters(storyId: string): Promise<ChapterDoc[]> {
  const ref = collection(this.firestore, `stories/${storyId}/chapters`);
  const q = query(ref, orderBy('order'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as ChapterDoc);
}

// 3. Einzelnes Chapter laden (1 Read) - für Lazy Loading
async loadChapter(storyId: string, chapterId: string): Promise<ChapterDoc> {
  const ref = doc(this.firestore, `stories/${storyId}/chapters/${chapterId}`);
  return (await getDoc(ref)).data();
}

// 4. Realtime Listener für aktives Chapter
listenToChapter(storyId: string, chapterId: string): Observable<ChapterDoc> {
  const ref = doc(this.firestore, `stories/${storyId}/chapters/${chapterId}`);
  return docData(ref) as Observable<ChapterDoc>;
}
```

### Dokumentgrößen-Limits

Firestore: Max **1 MB** pro Dokument

| Story-Größe | Chapters | Scenes à 3000 Wörter | Status |
|-------------|----------|---------------------|--------|
| Klein | 5 | 25 (~75.000 Wörter) | ✅ OK |
| Mittel | 15 | 75 (~225.000 Wörter) | ✅ OK |
| Groß | 30 | 150 (~450.000 Wörter) | ⚠️ Grenzwertig |
| Roman | 50+ | 250+ | ❌ Splitting nötig |

**Lösung für große Stories:**
```
stories/{storyId}/content       // Scenes 1-100
stories/{storyId}/content_ext   // Scenes 101+
```

---

## Migrationsplan

### Phase 0: Pre-Migration (Woche 1)

**KRITISCH: Diese Phase VOR allen anderen durchführen!**

**0.1 Daten-Audit**
- [ ] Alle localStorage-Keys dokumentieren (14 identifiziert)
- [ ] Aktuelle Datengrößen pro User analysieren
- [ ] Große Stories identifizieren (>400K Wörter → 1MB Limit!)
- [ ] Base64-Bilder in Dokumenten identifizieren

**0.2 Firebase-Vorbereitung**
- [ ] Firebase-Projekt erstellen mit **Blaze Plan** (Cloud Storage erfordert Blaze seit Okt 2024!)
- [ ] Budget-Alerts einrichten ($15, $25, $35)
- [ ] Staging-Environment für Tests erstellen
- [ ] Service Account für Daten-Migration anlegen

**0.3 Feature-Flag Setup**
```typescript
// Für schrittweisen Rollout
interface AppConfig {
  useFirebase: boolean;
  usePouchDB: boolean;
  dualWrite: boolean; // Schreibt in beide Systeme
}

// Phase 1: Dual-Write (Sicherheit)
config = { useFirebase: true, usePouchDB: true, dualWrite: true };

// Phase 2: Firebase primary
config = { useFirebase: true, usePouchDB: true, dualWrite: false };

// Phase 3: Firebase only
config = { useFirebase: true, usePouchDB: false, dualWrite: false };
```

**0.4 Entscheidungen ✅ GETROFFEN**

| Entscheidung | Gewählt | Auswirkung |
|--------------|---------|------------|
| **Beat History** | ✅ Cloud-Sync | Firestore Subcollection `beatHistory/{sceneId}` |
| **Story-Splitting** | ✅ Immer Chapter-weise | Neues Datenmodell mit Subcollections |
| **Auth-Migration** | ✅ Cutover | Kein Parallel-Betrieb, schneller Umstieg |
| **CouchDB-Entfernung** | ✅ Sofort | Kein 30-Tage-Puffer, direkter Wechsel |

**Wichtige Konsequenzen:**
- Datenmodell muss angepasst werden (Chapters als Subcollection)
- Migration ist "all-or-nothing" - gutes Testing kritisch
- Beat History wird synchronisiert (mehr Writes, aber bessere UX)

---

### Phase 1: Firebase-Projekt Setup (Woche 1-2)

**1.1 Firebase Console**
- [ ] Neues Firebase-Projekt erstellen
- [ ] **Blaze Plan aktivieren** (erforderlich für Cloud Storage!)
- [ ] Firestore aktivieren (Native Mode, europe-west1)
- [ ] Authentication aktivieren (Email/Password + Google)
- [ ] Storage aktivieren
- [ ] Hosting aktivieren
- [ ] Budget-Alerts konfigurieren

**1.2 Angular Integration**
```bash
npm install firebase @angular/fire
```

**1.3 Firebase Emulator Suite installieren**
```bash
npm install -g firebase-tools
firebase login
firebase init emulators
# Emulators: Firestore, Auth, Storage, Hosting
```

**Dateien:**
- [ ] `src/environments/environment.ts` - Firebase Config
- [ ] `src/environments/environment.prod.ts` - Firebase Config (Prod)
- [ ] `src/app/app.config.ts` - Firebase Provider

**1.4 Firebase CLI & Emulator**
```bash
firebase init
firebase emulators:start
```

**1.5 Lokales Testing-Setup**
```json
// package.json scripts
{
  "emulators": "firebase emulators:start",
  "test:rules": "firebase emulators:exec 'npm run test:security'"
}
```

### Phase 2: Authentication Service (Tag 2-3)

**Neuer Service:** `src/app/core/services/firebase-auth.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  private auth = inject(Auth);

  user$ = authState(this.auth);

  async login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle(): Promise<UserCredential> {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async logout(): Promise<void> {
    return signOut(this.auth);
  }

  async resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }
}
```

**Dateien:**
- [ ] `src/app/core/services/firebase-auth.service.ts` (neu)
- [ ] `src/app/core/services/auth.service.ts` (Wrapper/Adapter)
- [ ] Login-Komponente anpassen

### Phase 3: Firestore Service (Tag 4-6)

**Neuer Service:** `src/app/core/services/firestore.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // User Profile
  getUserProfile(): Observable<UserProfile | null> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of(null);
        const ref = doc(this.firestore, `users/${user.uid}/profile`);
        return docData(ref) as Observable<UserProfile>;
      })
    );
  }

  // Story Index
  getStoryIndex(): Observable<StoryIndex | null> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of(null);
        const ref = doc(this.firestore, `users/${user.uid}/storyIndex`);
        return docData(ref) as Observable<StoryIndex>;
      })
    );
  }

  // Story Content
  getStoryContent(storyId: string): Observable<StoryContent | null> {
    const ref = doc(this.firestore, `stories/${storyId}/content`);
    return docData(ref) as Observable<StoryContent>;
  }

  // Batched Write für Story-Updates
  async updateStory(storyId: string, content: Partial<StoryContent>, metadata: Partial<StoryMetadata>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Update Story Content
    const contentRef = doc(this.firestore, `stories/${storyId}/content`);
    batch.update(contentRef, { ...content, updatedAt: serverTimestamp() });

    // Update Story Index
    const indexRef = doc(this.firestore, `users/${user.uid}/storyIndex`);
    // ... Index-Update Logic

    await batch.commit();
  }
}
```

**Dateien:**
- [ ] `src/app/core/services/firestore.service.ts` (neu)
- [ ] `src/app/stories/services/story.service.ts` (anpassen)
- [ ] `src/app/core/services/codex.service.ts` (anpassen)
- [ ] `src/app/core/services/settings.service.ts` (anpassen)

### Phase 4: Storage Service (Tag 7)

**Neuer Service:** `src/app/core/services/firebase-storage.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class FirebaseStorageService {
  private storage = inject(Storage);
  private auth = inject(Auth);

  async uploadImage(file: File, path: string): Promise<string> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const fullPath = `users/${user.uid}/${path}`;
    const storageRef = ref(this.storage, fullPath);

    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async deleteImage(path: string): Promise<void> {
    const storageRef = ref(this.storage, path);
    await deleteObject(storageRef);
  }
}
```

**Dateien:**
- [ ] `src/app/core/services/firebase-storage.service.ts` (neu)
- [ ] Image-Upload Komponenten anpassen

### Phase 5: Datenmigration (Woche 4-5)

**Migrations-Service:** `src/app/core/services/migration.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class MigrationService {

  // Progress-Tracking
  migrationProgress$ = new BehaviorSubject<MigrationProgress>({
    status: 'pending',
    totalStories: 0,
    migratedStories: 0,
    errors: []
  });

  // Export aus PouchDB
  async exportFromPouchDB(): Promise<ExportData> {
    const stories = await this.exportStories();
    const backgrounds = await this.exportBackgrounds();
    const settings = await this.exportSettings();
    const beatHistories = await this.exportBeatHistories();
    return { stories, backgrounds, settings, beatHistories };
  }

  // Import nach Firestore mit Transformation
  async importToFirestore(data: ExportData, userId: string): Promise<ImportResult> {
    const result: ImportResult = { success: true, imported: 0, failed: 0, errors: [] };

    for (const story of data.stories) {
      try {
        // Transform PouchDB → Firestore Format
        const firestoreStory = await this.transformStory(story, userId);

        // Bilder zu Firebase Storage migrieren
        if (story.coverImage?.startsWith('data:image')) {
          firestoreStory.coverImage = await this.uploadImage(story.coverImage, `covers/${story._id}`);
        }

        // Batch-Write
        await this.writeStoryToFirestore(firestoreStory);
        result.imported++;

        this.migrationProgress$.next({
          ...this.migrationProgress$.value,
          migratedStories: result.imported
        });
      } catch (error) {
        result.failed++;
        result.errors.push({ storyId: story._id, error: error.message });
      }
    }

    return result;
  }

  // Transformiere PouchDB-Dokument zu Firestore-Format
  private async transformStory(pouchStory: any, userId: string): Promise<StoryContent> {
    return {
      ...pouchStory,
      _id: undefined,      // Entferne PouchDB-Felder
      _rev: undefined,
      userId,              // Füge userId hinzu
      createdAt: Timestamp.fromDate(new Date(pouchStory.createdAt)),
      updatedAt: Timestamp.fromDate(new Date(pouchStory.updatedAt)),
    };
  }

  // Validierung nach Migration
  async validateMigration(userId: string): Promise<ValidationResult> {
    const pouchCount = await this.getPouchDBStoryCount();
    const firestoreCount = await this.getFirestoreStoryCount(userId);

    return {
      success: pouchCount === firestoreCount,
      pouchDBStories: pouchCount,
      firestoreStories: firestoreCount,
      missingStories: await this.findMissingStories(userId),
      corruptedStories: await this.findCorruptedStories(userId)
    };
  }
}

interface MigrationProgress {
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalStories: number;
  migratedStories: number;
  currentStory?: string;
  errors: MigrationError[];
}
```

**Migrations-UI in Settings:**
- [ ] Export-Button (PouchDB → JSON)
- [ ] Import-Button (JSON → Firestore)
- [ ] **Progress-Anzeige mit Fortschrittsbalken**
- [ ] **Validierungs-Report nach Migration**
- [ ] Fehlerbehandlung mit Retry-Option
- [ ] Rollback-Button

**Base64 → Firebase Storage Migration:**
```typescript
async migrateImages(story: Story): Promise<Story> {
  const migratedStory = { ...story };

  // Cover Image
  if (story.coverImage?.startsWith('data:image')) {
    const blob = this.base64ToBlob(story.coverImage);
    const url = await this.storage.uploadImage(
      new File([blob], 'cover.jpg'),
      `stories/${story.id}/cover.jpg`
    );
    migratedStory.coverImage = url;
  }

  return migratedStory;
}
```

**Dokumentgrößen-Monitoring:**
```typescript
async checkDocumentSize(docRef: DocumentReference): Promise<number> {
  const snap = await getDoc(docRef);
  if (!snap.exists()) return 0;

  const sizeEstimate = new Blob([JSON.stringify(snap.data())]).size;

  if (sizeEstimate > 800_000) { // 800 KB Warning
    console.warn(`Document ${docRef.path} nähert sich Size-Limit: ${sizeEstimate} bytes`);
    // Splitting-Strategie aktivieren
  }

  return sizeEstimate;
}
```

### Phase 6: UI-Anpassungen (Tag 11-12)

**Login/Register:**
- [ ] Neue Login-Page mit Firebase Auth
- [ ] Google Sign-In Button
- [ ] Password Reset Flow
- [ ] Account-Deletion

**Sync-Status:**
- [ ] Firestore Pending Writes Indicator
- [ ] Online/Offline Status Badge

**Settings:**
- [ ] Account-Bereich
- [ ] Migration-Tool
- [ ] Data Export

### Phase 7: Security & Deployment (Tag 13-14)

**Security Rules deployen:**
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

**Hosting Setup:**
```bash
firebase init hosting
# Build-Verzeichnis: dist/creative-writer-2/browser
# SPA: Yes
```

**CI/CD:**
- [ ] GitHub Actions für Firebase Deploy
- [ ] Staging Environment

### Phase 8: Testing & QA (Woche 6)

**Unit Tests:**
- [ ] firestore.service.ts - Alle CRUD-Operationen
- [ ] firebase-auth.service.ts - Login, Register, Logout
- [ ] firebase-storage.service.ts - Upload, Delete, URLs
- [ ] migration.service.ts - Transform, Validate

**Integration Tests (mit Emulator):**
- [ ] Story CRUD End-to-End
- [ ] Offline → Online Sync
- [ ] Multi-Tab Persistence
- [ ] Security Rules Validation

**Migration Tests:**
- [ ] 10 Sample-User migrieren
- [ ] Große Stories (>300K Wörter) testen
- [ ] Bilder-Migration validieren
- [ ] Rollback testen

### Phase 9: Staged Rollout (Woche 7-8)

| Rollout | Prozent | Dauer | Kriterien |
|---------|---------|-------|-----------|
| Alpha | 5% | 3 Tage | Keine kritischen Fehler |
| Beta | 25% | 5 Tage | Performance OK, Sync stabil |
| Rollout 1 | 50% | 5 Tage | Kosten im Budget |
| Full | 100% | - | Alle Tests bestanden |

**Rollback-Trigger:**
- Error-Rate > 1%
- Kosten > $50/Tag
- Sync-Probleme bei >10% der User

### Phase 10: Cleanup (Nach 30 Tagen)

- [ ] PouchDB-Code entfernen
- [ ] CouchDB-Container deaktivieren
- [ ] Docker-Compose-Files bereinigen
- [ ] nginx-Dateien entfernen
- [ ] Dokumentation aktualisieren

---

## Security Rules

### Firestore Rules (`firestore.rules`) - Chapter-weise Struktur

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Hilfsfunktionen
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Hilfsfunktion: Hole userId aus Story-Metadata
    function getStoryOwner(storyId) {
      return get(/databases/$(database)/documents/stories/$(storyId)/metadata).data.userId;
    }

    function isStoryOwner(storyId) {
      return isAuthenticated() && getStoryOwner(storyId) == request.auth.uid;
    }

    function isNewStoryOwner() {
      return isAuthenticated() && request.resource.data.userId == request.auth.uid;
    }

    // User-Dokumente
    match /users/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }

    // Stories
    match /stories/{storyId} {

      // Metadata-Dokument (Story-Einstellungen, keine Chapters)
      match /metadata {
        allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
        allow create: if isNewStoryOwner();
        allow update, delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
      }

      // Chapters Subcollection (NEU)
      match /chapters/{chapterId} {
        allow read: if isStoryOwner(storyId);
        allow create: if isStoryOwner(storyId);
        allow update, delete: if isStoryOwner(storyId);
      }

      // Codex-Dokument
      match /codex {
        allow read: if isStoryOwner(storyId);
        allow create: if isNewStoryOwner();
        allow update, delete: if isStoryOwner(storyId);
      }

      // Beat History (Cloud-Sync ✅)
      match /beatHistory/{sceneId} {
        allow read: if isStoryOwner(storyId);
        allow create: if isStoryOwner(storyId);
        allow update, delete: if isStoryOwner(storyId);
      }
    }

    // User Media
    match /userMedia/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }
  }
}
```

**Hinweis:** Die `getStoryOwner()` Funktion verursacht einen zusätzlichen Read pro Zugriff auf Chapters/Codex/BeatHistory. Dies ist ein Trade-off für die Chapter-weise Struktur. Alternative: `userId` in jedem Chapter-Dokument duplizieren.

### Storage Rules (`storage.rules`)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // User-Dateien
    match /users/{userId}/{allPaths=**} {
      // Nur eigene Dateien lesen/schreiben
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;

      // Max 10 MB pro Datei
      allow write: if request.resource.size < 10 * 1024 * 1024;

      // Nur Bilder erlauben
      allow write: if request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## Service-Änderungen

### Übersicht

| Alter Service | Aktion | Neuer Service |
|---------------|--------|---------------|
| `database.service.ts` | Ersetzen | `firestore.service.ts` |
| `auth.service.ts` | Refactoring | `firebase-auth.service.ts` |
| `story.service.ts` | Anpassen | - |
| `codex.service.ts` | Anpassen | - |
| `settings.service.ts` | Anpassen | - |
| `sync-logger.service.ts` | Entfernen | - |
| - | Neu | `firebase-storage.service.ts` |
| - | Neu | `migration.service.ts` |

### Zu löschende Dateien

Nach erfolgreicher Migration:
- `src/app/core/services/database.service.ts`
- `src/app/core/services/sync-logger.service.ts`
- `docker-compose.yml` (CouchDB nicht mehr nötig)
- `nginx*` Dateien (Firebase Hosting)

### Zu ändernde Dateien

```
src/
├── app/
│   ├── app.config.ts                    [ÄNDERN] Firebase Provider
│   ├── core/
│   │   ├── services/
│   │   │   ├── auth.service.ts          [ÄNDERN] Firebase Auth Wrapper
│   │   │   ├── settings.service.ts      [ÄNDERN] Firestore statt localStorage
│   │   │   ├── codex.service.ts         [ÄNDERN] Firestore Queries
│   │   │   ├── firestore.service.ts     [NEU]
│   │   │   ├── firebase-auth.service.ts [NEU]
│   │   │   ├── firebase-storage.service.ts [NEU]
│   │   │   └── migration.service.ts     [NEU]
│   │   └── models/
│   │       └── firestore.interfaces.ts  [NEU]
│   ├── stories/
│   │   └── services/
│   │       └── story.service.ts         [ÄNDERN] Firestore Queries
│   └── settings/
│       └── components/
│           └── migration/               [NEU] Migration UI
├── environments/
│   ├── environment.ts                   [ÄNDERN] Firebase Config
│   └── environment.prod.ts              [ÄNDERN] Firebase Config
└── ...

Root:
├── firebase.json                        [NEU]
├── .firebaserc                          [NEU]
├── firestore.rules                      [NEU]
├── storage.rules                        [NEU]
└── firestore.indexes.json               [NEU]
```

---

## Testing-Strategie

### Kritische Test-Pfade

**1. Authentication Critical Path:**
```
1. User Registration (Email/Password)
2. User Login (Firebase Auth)
3. Email Verification
4. Password Reset Flow
5. Google Sign-In
6. Multi-Device Login
7. Session Persistence
8. Logout mit Cleanup
9. Account Deletion (GDPR)
```

**2. Story Sync Critical Path:**
```
1. Create Story → Firestore
2. Open Story aus Liste → Firestore Read
3. Edit Scene → Auto-Save zu Firestore
4. Add Chapter → Metadata Update
5. Delete Scene → Cascade Delete
6. Rename Story → Update Index
7. Upload Cover Image → Firebase Storage
8. Offline Changes → Local + Sync bei Reconnect
9. Conflict Resolution (Multi-Device Edits)
```

**3. Data Migration Critical Path:**
```
1. Export aus PouchDB (alle Docs + Attachments)
2. Transform zu Firestore Schema
3. Upload Images zu Firebase Storage
4. Import Dokumente in Batches
5. Verify Counts Match
6. Test Story Opening
7. Rollback Mechanismus
```

**4. Offline Support Critical Path:**
```
1. Arbeiten an Story offline
2. Änderungen persistieren zu IndexedDB
3. Online gehen → Firestore Sync startet
4. Verify kein Datenverlust
5. Handle Conflicts (Last-Write-Wins)
```

### Test mit Firebase Emulator

```typescript
// Test: User kann nur eigene Stories lesen
it('should allow user to read own stories', async () => {
  const db = getFirestore(/* auth context with uid */);
  await assertSucceeds(
    getDoc(doc(db, `stories/${storyId}/content`))
  );
});

// Test: User kann fremde Stories nicht lesen
it('should deny reading other user stories', async () => {
  const db = getFirestore(/* different uid */);
  await assertFails(
    getDoc(doc(db, `stories/${otherUserStoryId}/content`))
  );
});
```

---

## Risiken & Mitigationen

### Erweiterte Risiko-Analyse

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| **Datenverlust bei Migration** | Mittel | Hoch | Export-Tool, JSON-Backup vor Migration, Validierung |
| **Offline-Funktionalität bricht** | Mittel | Hoch | Extensive Offline-Tests mit Emulator |
| **Kosten explodieren** | Niedrig | Mittel | Budget Alerts ($15/$25/$35), incremental sync |
| **Performance-Regression** | Mittel | Mittel | Caching, Chapter-Lazy-Loading, Pagination |
| **Auth-Cutover verliert User** | Mittel | Hoch | ⚠️ Gutes Testing, klare Kommunikation, Backup-Plan |
| **1MB Dokumentlimit** | ✅ Gelöst | - | Chapter-weise Splitting eliminiert dieses Risiko |
| **Base64-Bilder Migration** | Hoch | Mittel | Batch-Test, Fallback zu Default |
| **Selective Sync Komplexität** | Hoch | Mittel | Query-basierte Filterung statt Sync-Filter |
| **localStorage-Daten verloren** | Mittel | Niedrig | Dokumentieren, vor Migration exportieren |
| **Beat History verloren** | ✅ Gelöst | - | Cloud-Sync gewählt - wird migriert |
| **Multi-Device Konflikte** | Niedrig | Hoch | Last-Write-Wins dokumentieren, User informieren |
| **Kein Rollback zu CouchDB** | Mittel | Hoch | ⚠️ Sofortige Entfernung - JSON-Backup kritisch! |

### Neue Risiken aus Codebase-Analyse

| Risiko | Details | Mitigation |
|--------|---------|------------|
| **Story Size > 1MB** | ✅ Gelöst durch Chapter-Splitting | Kein Risiko mehr |
| **878+ Sync-Referenzen** | Mehr Refactoring als erwartet | Phase 0 Daten-Audit, gründliche Code-Analyse |
| **14 localStorage-Keys** | Zusätzliche Migration nötig | Dokumentieren, in Firestore UserProfile migrieren |
| **3 separate PouchDB** | Stories, Beat-History, Backgrounds | Klare Migrationsstrategie pro DB |

### Rollback-Plan (Angepasst für sofortige CouchDB-Entfernung)

⚠️ **WICHTIG:** Da CouchDB sofort entfernt wird, gibt es keinen Rollback zur alten Architektur. Stattdessen:

**Backup-Strategie:**
1. **Vor Migration:** Vollständiges JSON-Backup aller User-Daten
2. **Während Migration:** Validierung jedes migrierten Users
3. **Nach Migration:** JSON-Backup in Firebase Storage archivieren

**Disaster Recovery:**
```typescript
// Falls Firestore-Daten korrupt/verloren:
class DisasterRecoveryService {
  async restoreFromBackup(userId: string, backupJson: string): Promise<void> {
    const data = JSON.parse(backupJson);

    // Stories wiederherstellen
    for (const story of data.stories) {
      await this.firestoreService.createStory(story);
      for (const chapter of story.chapters) {
        await this.firestoreService.createChapter(story.id, chapter);
      }
    }

    // Beat History wiederherstellen
    for (const history of data.beatHistories) {
      await this.firestoreService.saveBeatHistory(history);
    }

    // Backgrounds wiederherstellen
    for (const bg of data.backgrounds) {
      await this.storageService.uploadBackground(bg);
    }
  }
}
```

**Rollback-Szenarien:**

| Szenario | Lösung |
|----------|--------|
| Firestore-Ausfall | Offline-Cache funktioniert weiter |
| Daten-Korruption | JSON-Backup wiederherstellen |
| Auth-Probleme | Firebase Support kontaktieren |
| Kosten zu hoch | Aggressive Caching, ggf. Downgrade |

**Kein Rollback zu PouchDB/CouchDB möglich!** Daher:
- Gründliches Testing vor Go-Live
- Staged Rollout (5% → 25% → 50% → 100%)
- Monitoring der ersten 48h intensiv

---

## Zeitplan (Realistisch)

| Phase | Beschreibung | Dauer | Kumuliert |
|-------|-------------|-------|-----------|
| 0 | Pre-Migration & Audit | 3-5 Tage | Woche 1 |
| 1 | Firebase Setup & Emulator | 3-4 Tage | Woche 1-2 |
| 2 | Auth Service | 4-5 Tage | Woche 2 |
| 3 | Firestore Service | 5-6 Tage | Woche 3 |
| 4 | Storage Service | 2-3 Tage | Woche 3-4 |
| 5 | Datenmigration | 5-7 Tage | Woche 4-5 |
| 6 | UI-Anpassungen | 3-4 Tage | Woche 5 |
| 7 | Security & Deploy | 2-3 Tage | Woche 5-6 |
| 8 | Testing & QA | 5-7 Tage | Woche 6 |
| 9 | Staged Rollout | 7-14 Tage | Woche 7-8 |
| 10 | Cleanup | 2-3 Tage | Nach Woche 8 |
| **Gesamt** | | **~6-8 Wochen** |

---

## Nächste Schritte

### Sofort (Phase 0)
1. [ ] **Entscheidungen treffen:**
   - Beat History: Cloud-Sync oder lokal?
   - Story-Splitting: Automatisch oder manuell?
   - Auth-Migration: Parallel oder Cutover?
2. [ ] Daten-Audit durchführen (Story-Größen analysieren)
3. [ ] localStorage-Keys dokumentieren
4. [ ] Firebase-Projekt mit **Blaze Plan** erstellen

### Woche 1-2 (Phase 1)
5. [ ] `npm install firebase @angular/fire`
6. [ ] Firebase Emulator Suite einrichten
7. [ ] Environment-Dateien mit Firebase Config
8. [ ] Feature-Flag System implementieren

### Woche 2-3 (Phase 2-3)
9. [ ] Firebase Auth Service implementieren
10. [ ] Firestore Service implementieren
11. [ ] Security Rules deployen & testen

### Woche 4-5 (Phase 4-5)
12. [ ] Firebase Storage Service implementieren
13. [ ] Migration-Tool mit Validierung bauen
14. [ ] Base64 → Storage Migration testen

### Woche 6 (Phase 6-8)
15. [ ] UI-Komponenten aktualisieren
16. [ ] Umfassende Tests durchführen
17. [ ] Staging-Deployment

### Woche 7-8 (Phase 9)
18. [ ] Staged Rollout (5% → 25% → 50% → 100%)
19. [ ] Monitoring & Kosten-Tracking
20. [ ] User-Kommunikation

---

## Zusammenfassung der Research-Erkenntnisse (2025)

### Firebase 2025 Status

| Bereich | Wichtige Erkenntnis |
|---------|---------------------|
| **AngularFire** | v20.0.1 voll kompatibel mit Angular 19, neue Provider-Pattern |
| **Cloud Storage** | Blaze Plan erforderlich seit Oktober 2024 |
| **Offline Persistence** | `persistentMultipleTabManager()` für Multi-Tab Support |
| **Kostenoptimierung** | `lastUpdated` incremental sync spart 30-40% Reads |
| **Security Rules** | Version 2 für Collection Group Queries erforderlich |

### Codebase-Analyse Zusammenfassung

| Bereich | Erkenntnis | Impact |
|---------|------------|--------|
| **PouchDB Integration** | 878+ Referenzen | 6-8 Wochen statt 2 |
| **Dateien zu ändern** | 22+ | Umfangreicher als geplant |
| **localStorage** | 14 Keys in 14 Services | Zusätzliche Migration |
| **Separate DBs** | 3 (Stories, Beat-History, Backgrounds) | Alle werden migriert |
| **Base64 Bilder** | In Dokumenten gespeichert | Firebase Storage Migration |

### Getroffene Entscheidungen ✅

| Entscheidung | Gewählt | Konsequenz |
|--------------|---------|------------|
| **Beat History** | Cloud-Sync | Wird als Subcollection migriert |
| **Story-Splitting** | Immer Chapter-weise | Neues Datenmodell mit Subcollections |
| **Auth-Migration** | Cutover | Kein Parallel-Betrieb |
| **CouchDB-Entfernung** | Sofort | JSON-Backup kritisch! |

### Empfehlungen (Aktualisiert)

1. **Start mit Blaze Plan** - Cloud Storage erfordert es
2. **Implementiere incremental sync** - 30-40% Kosteneinsparung
3. **Firebase Emulator nutzen** - Lokales Testing vor Deployment
4. **JSON-Backup vor Migration** - Kein CouchDB-Fallback!
5. **Intensive 48h Monitoring** - Nach Go-Live

---

## Quellen

### Offizielle Dokumentation
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firebase Hosting Documentation](https://firebase.google.com/docs/hosting)
- [Firestore Offline Persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore Data Structure](https://firebase.google.com/docs/firestore/manage-data/structure-data)
- [Firestore Usage and Limits](https://firebase.google.com/docs/firestore/quotas)
- [Firebase Auth Angular 19](https://dev.to/this-is-angular/firebase-authentication-with-angular-19-ief)
- [AngularFire Documentation](https://github.com/angular/angularfire)
- [AngularFire Releases](https://github.com/angular/angularfire/releases)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

### Kostenoptimierung
- [Firestore Cost Reduction Guide](https://medium.com/better-programming/firebase-firestore-cut-costs-by-reducing-reads-edfccb538285)
- [Caching Strategies](https://medium.com/@icutvaric/how-to-reduce-firestore-costs-via-local-cache-02c3f4ee8654)
- [Read/Write Optimization](https://www.javacodegeeks.com/2025/03/firestore-read-write-optimization-strategies.html)

### Migration Patterns
- [CouchDB vs Firestore Comparison](https://marmelab.com/blog/2019/09/25/couchdb_pouchdb_serious_firebase_alternative.html)
- [Client-Side Databases Comparison](https://github.com/pubkey/client-side-databases)

### Firebase 2025 Updates
- [Firebase Release Notes](https://firebase.google.com/support/releases)
- [What's New at I/O 2025](https://firebase.blog/posts/2025/05/whats-new-at-google-io)
- [Firebase App Hosting Announcement](https://firebase.blog/posts/2025/06/app-hosting-frameworks/)

---

## Changelog

| Datum | Version | Änderungen |
|-------|---------|------------|
| 2025-12-01 | v1.0 | Initiale Planung |
| 2025-12-01 | v2.0 | Web Research & Codebase-Analyse hinzugefügt |
| 2025-12-01 | v2.1 | **Entscheidungen getroffen:** Beat History Cloud-Sync, Chapter-wise Splitting, Auth Cutover, sofortige CouchDB-Entfernung. Datenmodell und Security Rules entsprechend angepasst. |
