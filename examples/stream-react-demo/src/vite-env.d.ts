/// <reference types="vite/client" />

// Augment ImportMeta for Vitest env variables
interface ImportMetaEnv {
  [key: string]: unknown
  VITEST?: boolean
  // Add other environment variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 