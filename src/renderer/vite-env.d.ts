/// <reference types="vite/client" />

// Vite asset imports — `?url` returns the resolved public URL as a string.
// Used by PdfPane.tsx to ship pdfjs-dist's worker.
declare module '*?url' {
  const src: string
  export default src
}
