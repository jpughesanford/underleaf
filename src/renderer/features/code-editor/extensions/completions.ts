import { CompletionContext, CompletionResult, Completion, snippetCompletion } from '@codemirror/autocomplete'

// Plain command completions — no `type` so CodeMirror won't render an icon glyph.
const PLAIN_COMMANDS: string[] = [
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

// Snippet completions: pressing Enter/Tab inserts the template with cursor at #{}.
// Boosted above plain commands so cross-reference snippets win when names overlap.
const SNIPPETS: Completion[] = [
  snippetCompletion('\\label{#{key}}',          { label: '\\label',          boost: 5 }),
  snippetCompletion('\\ref{#{key}}',            { label: '\\ref',            boost: 5 }),
  snippetCompletion('\\eqref{#{key}}',          { label: '\\eqref',          boost: 5 }),
  snippetCompletion('\\pageref{#{key}}',        { label: '\\pageref',        boost: 5 }),
  snippetCompletion('\\autoref{#{key}}',        { label: '\\autoref',        boost: 5 }),
  snippetCompletion('\\cref{#{key}}',           { label: '\\cref',           boost: 5 }),
  snippetCompletion('\\Cref{#{key}}',           { label: '\\Cref',           boost: 5 }),
  snippetCompletion('\\cite{#{key}}',           { label: '\\cite',           boost: 5 }),
  snippetCompletion('\\nocite{#{key}}',         { label: '\\nocite',         boost: 5 }),
  snippetCompletion('\\hyperref[#{key}]{#{text}}', { label: '\\hyperref',    boost: 5 }),
  snippetCompletion('\\url{#{url}}',            { label: '\\url',            boost: 5 }),
  snippetCompletion('\\href{#{url}}{#{text}}',  { label: '\\href',           boost: 5 }),
  snippetCompletion('\\bibliography{#{file}}',  { label: '\\bibliography',   boost: 4 }),
  snippetCompletion('\\bibliographystyle{#{style}}', { label: '\\bibliographystyle', boost: 4 }),
  snippetCompletion('\\begin{#{env}}\n\t#{}\n\\end{#{env}}', { label: '\\begin…\\end', boost: 4 }),
]

const COMMAND_COMPLETIONS: Completion[] = [
  ...SNIPPETS,
  ...PLAIN_COMMANDS.map(cmd => ({ label: cmd })),
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
      options: COMMAND_COMPLETIONS,
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
      options: ENVIRONMENTS.map(env => ({ label: env })),
      validFor: /^[a-zA-Z*]*$/,
    }
  }

  return null
}
