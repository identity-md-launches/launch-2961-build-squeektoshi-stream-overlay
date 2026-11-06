// Classic scripts expose the same typed pure modules used by Node tests.
declare var SqueekCore: typeof import('../src/assets/core');
declare var SqueekArt: typeof import('../src/assets/art');
declare var SqueekSettings: typeof import('../src/assets/settings');
declare var SqueekRenderer: { mount(host: HTMLElement, options: import('./model').MountOptions): import('./model').Renderer };
type StreamSession = ReturnType<typeof SqueekCore.newSession>;
interface SavedSession { version: 2; id: string; token: string; updatedAt: number; session: StreamSession }
interface Profile { id: string; name: string; settings: import('./model').Settings }
interface SessionCoordinator { session: StreamSession; state: string; save(): boolean; release(): void }
declare var SqueekStorage: {
  read(key: string): any; write(key: string, value: unknown): boolean;
  loadProfiles(): Profile[]; saveProfiles(items: Profile[]): boolean;
  loadDraft(): {version: 2; settings: import('./model').Settings; ui: string} | null;
  saveDraft(settings: import('./model').Settings, ui: string): boolean;
  sessions(): SavedSession[]; report(format: string): string;
  openSession(settings: import('./model').Settings, disabled: boolean): Promise<SessionCoordinator>;
  status(): string;
};
interface Window { webkitAudioContext?: typeof AudioContext }
declare const module: { exports: any } | undefined;
