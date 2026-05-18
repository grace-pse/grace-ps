/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SANDBOX_MODE?: string;
  readonly VITE_RESET_INTERVAL_HOURS?: string;
  readonly VITE_API_TARGET?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_GIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
