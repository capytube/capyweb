/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DYNAMIC_ENVIRONMENT_ID: string
    // more env variables...
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }