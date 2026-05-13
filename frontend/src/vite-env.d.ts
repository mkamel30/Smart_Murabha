/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    electronAPI?: {
      getNetworkURL?: () => Promise<string>;
      openExternal?: (url: string) => Promise<void>;
      checkForUpdates?: () => Promise<void>;
    };
  }
  const __APP_VERSION__: string;
}

declare module "*.png";
declare module "*.jpg";
declare module "*.svg";

export {};
