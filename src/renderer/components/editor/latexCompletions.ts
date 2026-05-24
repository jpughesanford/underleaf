import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'

const LATEX_COMMANDS = [
  // Document structure
  '\\documentclass', '\\usepackage', '\\begin', '\\end',
  '\\title', '\\author', '\\date', '\\maketitle',
  '\\section', '\\subsection', '\\subsubsection',
  '\\paragraph', '\\subparagraph',
  '\\chapter', '\\part', '\\appendix',
  '\\tableofcontents', '\\listoffigures', '\\listoftables',
  '\\abstract',

  // Text formatting
  '\\textbf', '\\textit', '\\texttt', '\\textrm', '\\textsf',
  '\\emph', '\\underline', '\\textsc', '\\textsl',
  '\\footnote', '\\footnotesize', '\\small', '\\large', '\\Large', '\\LARGE',
  '\\huge', '\\Huge', '\\tiny', '\\normalsize',

  // Math
  '\\frac', '\\sqrt', '\\sum', '\\int', '\\prod',
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon',
  '\\theta', '\\lambda', '\\mu', '\\pi', '\\sigma',
  '\\omega', '\\Omega', '\\phi', '\\psi', '\\xi',
  '\\infty', '\\partial', '\\nabla', '\\cdot', '\\times',
  '\\leq', '\\geq', '\\neq', '\\approx', '\\equiv',
  '\\in', '\\notin', '\\subset', '\\supset', '\\cup', '\\cap',
  '\\forall', '\\exists', '\\rightarrow', '\\leftarrow', '\\Rightarrow',
  '\\mathbb', '\\mathcal', '\\mathbf', '\\mathrm',

  // References
  '\\label', '\\ref', '\\eqref', '\\pageref',
  '\\cite', '\\nocite', '\\bibliography', '\\bibliographystyle',

  // Lists
  '\\item',

  // Figures & tables
  '\\includegraphics', '\\caption', '\\centering',
  '\\hline', '\\toprule', '\\midrule', '\\bottomrule',
  '\\multicolumn', '\\multirow',

  // Spacing
  '\\newline', '\\\\', '\\vspace', '\\hspace', '\\vfill', '\\hfill',
  '\\noindent', '\\indent', '\\newpage', '\\clearpage',
  '\\medskip', '\\bigskip', '\\smallskip',

  // Special
  '\\input', '\\include', '\\includeonly',
  '\\newcommand', '\\renewcommand', '\\newenvironment',
  '\\verb', '\\verbatim',
]

const ENVIRONMENTS = [
  'document', 'abstract', 'equation', 'equation*',
  'align', 'align*', 'gather', 'gather*',
  'itemize', 'enumerate', 'description',
  'figure', 'table', 'tabular', 'array',
  'center', 'flushleft', 'flushright',
  'verbatim', 'lstlisting',
  'theorem', 'lemma', 'proof', 'definition', 'corollary',
  'minipage', 'frame', 'block', 'exampleblock', 'alertblock',
]

export function latexCompletions(context: CompletionContext): CompletionResult | null {
  // Command completion after backslash
  const cmdMatch = context.matchBefore(/\\[a-zA-Z]*/)
  if (cmdMatch) {
    return {
      from: cmdMatch.from,
      options: LATEX_COMMANDS.map(cmd => ({
        label: cmd,
        type: 'keyword',
      })),
      validFor: /^\\[a-zA-Z]*$/,
    }
  }

  // Environment name after \begin{ or \end{
  const envMatch = context.matchBefore(/\\(begin|end)\{[a-zA-Z]*/)
  if (envMatch) {
    const braceIdx = envMatch.text.lastIndexOf('{')
    const from = envMatch.from + braceIdx + 1
    return {
      from,
      options: ENVIRONMENTS.map(env => ({
        label: env,
        type: 'class',
      })),
      validFor: /^[a-zA-Z*]*$/,
    }
  }

  return null
}
