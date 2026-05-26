// Minimal implementation of pdfjs' IPDFLinkService for the in-app PDF viewer.
// Handles two cases: internal refs (\ref, \autoref, \cite-with-hyperref) scroll
// to the target page; external URLs (\url, \href) open in the OS browser via
// Electron's shell.openExternal.
//
// We don't implement search highlighting, named actions, or OCG state since
// LaTeX-output PDFs almost never use those.

interface PDFDocumentLike {
  numPages: number
  getDestination(id: string): Promise<unknown[] | null>
  getPageIndex(ref: unknown): Promise<number>
}

export class UnderleafLinkService {
  pdfDocument: PDFDocumentLike | null = null
  externalLinkEnabled = true
  externalLinkTarget = 0
  externalLinkRel = 'noopener'

  private getScrollEl: () => HTMLElement | null

  constructor(getScrollEl: () => HTMLElement | null) {
    this.getScrollEl = getScrollEl
  }

  setDocument(doc: PDFDocumentLike | null): void {
    this.pdfDocument = doc
  }

  get pagesCount(): number { return this.pdfDocument?.numPages ?? 0 }
  get page(): number { return 1 }
  set page(_: number) { /* viewer doesn't track current-page state through this */ }
  get rotation(): number { return 0 }
  set rotation(_: number) { /* no rotation in this viewer */ }
  get isInPresentationMode(): boolean { return false }

  async goToDestination(dest: string | unknown[]): Promise<void> {
    const doc = this.pdfDocument
    if (!doc) return
    let resolved: unknown[] | null
    if (typeof dest === 'string') {
      resolved = await doc.getDestination(dest)
    } else if (Array.isArray(dest)) {
      resolved = dest
    } else {
      return
    }
    if (!resolved || !Array.isArray(resolved) || resolved.length === 0) return

    const [pageRef] = resolved
    let pageIdx: number
    if (pageRef && typeof pageRef === 'object') {
      try {
        pageIdx = await doc.getPageIndex(pageRef)
      } catch {
        return
      }
    } else if (typeof pageRef === 'number') {
      pageIdx = pageRef
    } else {
      return
    }
    this.scrollToPage(pageIdx + 1)
  }

  goToPage(val: number | string): void {
    const page = typeof val === 'number' ? val : parseInt(val, 10)
    if (!Number.isFinite(page) || page < 1) return
    this.scrollToPage(page)
  }

  private scrollToPage(pageNum: number): void {
    const scrollEl = this.getScrollEl()
    if (!scrollEl) return
    const target = scrollEl.querySelector<HTMLElement>(`[data-page="${pageNum}"]`)
    if (!target) return
    scrollEl.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: 'smooth' })
  }

  addLinkAttributes(link: HTMLAnchorElement, url: string, _newWindow?: boolean): void {
    link.href = url
    link.title = url
    link.target = '_blank'
    link.rel = 'noopener'
    // Override default navigation — open in OS browser, not inside the webview.
    link.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()
      window.api.openExternal(url)
    })
  }

  getDestinationHash(_: unknown): string { return '#' }
  getAnchorUrl(hash: string): string { return '#' + (hash || '') }
  setHash(_: string): void { /* no history sync */ }
  executeNamedAction(_: string): void { /* no named actions */ }
  executeSetOCGState(_: unknown): void { /* no OCG state */ }
  cachePageRef(_pageNum: number, _pageRef: unknown): void { /* unused */ }
  isPageVisible(_: number): boolean { return true }
  isPageCached(_: number): boolean { return true }
}
