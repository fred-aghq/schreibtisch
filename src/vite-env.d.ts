/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set by PR preview builds to keep their localStorage separate from production. */
  readonly VITE_STORAGE_NAMESPACE?: string;
}
