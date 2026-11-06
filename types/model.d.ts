export type Part = 'hamster' | 'stats' | 'progress' | 'session' | 'supply' | 'alerts';
export type Kind = 'wake' | 'sleep' | 'block' | 'round' | 'record';
export interface Config {
  pos: string; scale: number; theme: string; lang: 'en' | 'tr'; parts: Part[];
  alert_wake: boolean; alert_sleep: boolean; alert_block: boolean; alert_round: boolean; alert_record: boolean;
  alertsec: number; sound: boolean; volume: number; poll: number; reset: string; persist: boolean; motion: boolean; demo: boolean;
}
export interface Box { x: number; y: number; w: number; scale: number }
export interface Presentation {
  format: string; layout: 'legacy' | 'horizontal' | 'vertical' | 'custom'; inset: number; font: number; opacity: number;
  fps: 15 | 30; metrics: string[]; distance: 'auto' | 'm' | 'km'; speed: 'm/s' | 'km/h';
  colors: {panel: string; text: string; accent: string};
  boxes: Record<Part, Box>;
  alert: {pos: string; width: number; scale: number};
  sounds: Record<Kind, {tone: 'bell' | 'soft' | 'arcade' | 'off'; level: number}>;
  templates: Record<'en' | 'tr', Record<Kind, {title: string; body: string}>>;
  locked: boolean; snap: boolean;
}
export interface Settings { version: 2; page: 'scene' | 'widget'; sessionId: string; config: Config; presentation: Presentation }
export interface Diagnostics {
  source: string; state: string; lastSuccess: number | null; observationAge: number | null; poll: number;
  events: {at: number; type: string}[]; queue: number; audio: string; storage: string; requestedScale: number;
  effectiveScale: number; draws: number; requests: number; nodes: number; destroyed: boolean;
}
export interface MountOptions { settings: Settings; preview?: boolean; onDiagnostics?: (d: Diagnostics) => void }
export interface Renderer {
  update: (s: Settings) => void; alert: (kind: Kind) => boolean; cut: (value?: boolean) => void;
  demo: (mode: string, rpm?: number) => void; clear: () => void; soundTest: (tone?: string) => Promise<boolean>;
  destroy: () => void; diagnostics: () => Diagnostics; canvas: () => HTMLCanvasElement | null;
}
