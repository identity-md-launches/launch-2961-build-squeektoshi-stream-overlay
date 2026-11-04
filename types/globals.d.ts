// The browser scripts are classic scripts sharing two globals, and each also exports for Node tests.
interface Window {
  SqueekCore: any;
  SqueekArt: any;
  webkitAudioContext: any;
}
declare const module: { exports: any } | undefined;
