// Overleaf-identical LaTeX language support.
//
// We use the RAW parser from `codemirror-lang-latex/src/latex.mjs` (no styleTags
// attached) and apply Overleaf's exact styleTags ourselves. Going through the raw
// parser is necessary because Lezer's ruleNodeProp uses a combine() function that
// would merge any new styleTags with the community package's existing ones — and
// the chain-walk semantics make community's bare rules shadow our path-specific
// overrides.
//
// Verbatim source:
//   services/web/frontend/js/features/source-editor/languages/latex/latex-language.ts
//   services/web/frontend/js/features/source-editor/utils/tree-operations/tokens.ts
//   services/web/frontend/js/features/source-editor/extensions/class-highlighter.ts

import { tags as t, styleTags, tagHighlighter } from '@lezer/highlight'
import {
  LRLanguage,
  indentNodeProp,
  foldNodeProp,
  foldInside,
} from '@codemirror/language'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — community package ships a .mjs without .d.ts; the runtime export
// is the un-configured LRParser we need (before any styleTags get attached).
import { parser as rawParser } from 'codemirror-lang-latex/src/latex.mjs'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — same package, raw terms map for dynamic token filtering.
import * as termsModule from 'codemirror-lang-latex/src/latex.terms.mjs'

// ─── Token name lists — generated EXACTLY like Overleaf's tree-operations/tokens.ts ─

const tokenNames: string[] = Object.keys(termsModule)

const Tokens = {
  ctrlSeq: tokenNames.filter(n => /^(Begin|End|.*CtrlSeq)$/.test(n)),
  ctrlSym: tokenNames.filter(n => /^.*CtrlSym$/.test(n)),
  envName: tokenNames.filter(n => /^.*EnvName$/.test(n)),
}

// Style overrides for cite-like ctrl seqs — exactly the 7 Overleaf specifies.
const styleOverrides: Record<string, ReturnType<typeof tagId>> = {
  DocumentClassCtrlSeq: t.keyword,
  UsePackageCtrlSeq: t.keyword,
  CiteCtrlSeq: t.keyword,
  CiteStarrableCtrlSeq: t.keyword,
  RefCtrlSeq: t.keyword,
  RefStarrableCtrlSeq: t.keyword,
  LabelCtrlSeq: t.keyword,
}
// (typeof tagId is just a way to refer to the Tag type without depending on it)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function tagId() { return t.keyword }

// Helper: build a styleTags spec block from a token list, with per-token overrides.
function tokenStyles(
  tokens: string[],
  defaultStyle: typeof t.keyword,
): Record<string, typeof t.keyword> {
  const out: Record<string, typeof t.keyword> = {}
  for (const token of tokens) {
    out[token] = styleOverrides[token] ?? defaultStyle
  }
  return out
}

const overleafStyleTags = styleTags({
  // === The three default token-class styles (verbatim port) ===
  ...tokenStyles(Tokens.ctrlSeq, t.tagName),
  ...tokenStyles(Tokens.ctrlSym, t.literal),
  ...tokenStyles(Tokens.envName, t.attributeValue),

  // === Everything else from Overleaf's styleTags call, in source order ===
  'HrefCommand/ShortTextArgument/ShortArg/...': t.link,
  'HrefCommand/UrlArgument/...': t.monospace,
  'CtrlSeq Csname': t.tagName,
  'DocumentClass/OptionalArgument/ShortOptionalArg/...': t.attributeValue,
  'DocumentClass/ShortTextArgument/ShortArg/Normal': t.typeName,
  'ListEnvironment/BeginEnv/OptionalArgument/...': t.monospace,
  Number: t.number,
  OpenBrace: t.brace,
  CloseBrace: t.brace,
  OpenBracket: t.squareBracket,
  CloseBracket: t.squareBracket,
  Dollar: t.string,
  Math: t.string,
  'Math/MathChar': t.string,
  'Math/MathSpecialChar': t.string,
  'Math/Number': t.string,
  'MathGroup/OpenBrace MathGroup/CloseBrace': t.string,
  'MathTextCommand/TextArgument/OpenBrace MathTextCommand/TextArgument/CloseBrace': t.string,
  'MathOpening/LeftCtrlSeq MathClosing/RightCtrlSeq MathUnknownCommand/CtrlSeq MathTextCommand/CtrlSeq': t.literal,
  MathDelimiter: t.literal,
  DoubleDollar: t.keyword,
  Tilde: t.keyword,
  Ampersand: t.keyword,
  LineBreakCtrlSym: t.keyword,
  Comment: t.comment,
  'UsePackage/OptionalArgument/ShortOptionalArg/Normal': t.attributeValue,
  'UsePackage/ShortTextArgument/ShortArg/Normal': t.tagName,
  'Affiliation/OptionalArgument/ShortOptionalArg/Normal': t.attributeValue,
  'Affil/OptionalArgument/ShortOptionalArg/Normal': t.attributeValue,
  'LiteralArgContent VerbContent VerbatimContent LstInlineContent': t.string,
  'NewCommand/LiteralArgContent': t.typeName,
  'LabelArgument/ShortTextArgument/ShortArg/...': t.attributeValue,
  'RefArgument/ShortTextArgument/ShortArg/...': t.attributeValue,
  'BibKeyArgument/ShortTextArgument/ShortArg/...': t.attributeValue,
  'ShortTextArgument/ShortArg/Normal': t.monospace,
  'UrlArgument/LiteralArgContent': [t.attributeValue, t.url],
  'FilePathArgument/LiteralArgContent': t.attributeValue,
  'BareFilePathArgument/SpaceDelimitedLiteralArgContent': t.attributeValue,
  TrailingContent: t.comment,
  'Item/OptionalArgument/ShortOptionalArg/...': t.strong,
})

// ─── Fold + indent rules (copied from codemirror-lang-latex/latex-language.ts) ─

const overleafIndentProps = indentNodeProp.add({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Environment: (context: any) => context.baseIndent + context.unit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  KnownEnvironment: (context: any) => context.baseIndent + context.unit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Group: (context: any) => context.baseIndent + context.unit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BeginEnv: (context: any) => context.baseIndent + context.unit,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'Content TextArgument LongArg': (context: any) => context.baseIndent + context.unit,
})

const overleafFoldProps = foldNodeProp.add({
  Environment: foldInside,
  KnownEnvironment: foldInside,
  Group: foldInside,
  DocumentEnvironment: foldInside,
  TabularEnvironment: foldInside,
  EquationEnvironment: foldInside,
  EquationArrayEnvironment: foldInside,
  VerbatimEnvironment: foldInside,
  TikzPictureEnvironment: foldInside,
  FigureEnvironment: foldInside,
  ListEnvironment: foldInside,
  TableEnvironment: foldInside,
  Book: foldInside,
  Part: foldInside,
  Chapter: foldInside,
  Section: foldInside,
  SubSection: foldInside,
  SubSubSection: foldInside,
  Paragraph: foldInside,
  SubParagraph: foldInside,
})

// ─── Public LRLanguage with Overleaf-only props ────────────────────────────

export const overleafLatexLanguage = LRLanguage.define({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parser: (rawParser as any).configure({
    props: [overleafIndentProps, overleafFoldProps, overleafStyleTags],
  }),
  languageData: {
    commentTokens: { line: '%' },
    closeBrackets: { brackets: ['(', '[', '{', "'", '"'] },
    wordChars: '$\\-_',
  },
})

// ─── Tag → CSS class — VERBATIM port of Overleaf's class-highlighter.ts ───
// Critical note: `t.tagName` is INTENTIONALLY omitted. Lezer's tagHighlighter walks
// each tag's inheritance chain (tagName → typeName → name) and joins all matches.
// Since t.tagName inherits from t.typeName, omitting tagName here makes tagged
// nodes (like `\input`, `\section`, `\begin`) fall through to .tok-typeName —
// which in katzenmilch is a purple very close to .tok-keyword's purple, making
// `\input` and `\label` look (almost) identical. Adding a tok-tagName mapping
// short-circuits this inheritance and breaks the colour match.
// Similarly `t.monospace` and `t.attributeName` are NOT mapped: Overleaf tags
// things with monospace in styleTags but never assigns a class for it.
export const overleafClassHighlighter = tagHighlighter([
  { tag: t.link,                                              class: 'tok-link' },
  { tag: t.heading,                                           class: 'tok-heading' },
  { tag: t.emphasis,                                          class: 'tok-emphasis' },
  { tag: t.strong,                                            class: 'tok-strong' },
  { tag: t.keyword,                                           class: 'tok-keyword' },
  { tag: t.atom,                                              class: 'tok-atom' },
  { tag: t.bool,                                              class: 'tok-bool' },
  { tag: t.url,                                               class: 'tok-url' },
  { tag: t.labelName,                                         class: 'tok-labelName' },
  { tag: t.inserted,                                          class: 'tok-inserted' },
  { tag: t.deleted,                                           class: 'tok-deleted' },
  { tag: t.literal,                                           class: 'tok-literal' },
  { tag: t.string,                                            class: 'tok-string' },
  { tag: t.number,                                            class: 'tok-number' },
  { tag: [t.regexp, t.escape, t.special(t.string)],           class: 'tok-string2' },
  { tag: t.variableName,                                      class: 'tok-variableName' },
  { tag: t.local(t.variableName),                             class: 'tok-variableName tok-local' },
  { tag: t.definition(t.variableName),                        class: 'tok-variableName tok-definition' },
  { tag: t.special(t.variableName),                           class: 'tok-variableName2' },
  { tag: t.definition(t.propertyName),                        class: 'tok-propertyName tok-definition' },
  { tag: t.typeName,                                          class: 'tok-typeName' },
  { tag: t.namespace,                                         class: 'tok-namespace' },
  { tag: t.className,                                         class: 'tok-className' },
  { tag: t.macroName,                                         class: 'tok-macroName' },
  { tag: t.propertyName,                                      class: 'tok-propertyName' },
  { tag: t.operator,                                          class: 'tok-operator' },
  { tag: t.comment,                                           class: 'tok-comment' },
  { tag: t.meta,                                              class: 'tok-meta' },
  { tag: t.invalid,                                           class: 'tok-invalid' },
  { tag: t.punctuation,                                       class: 'tok-punctuation' },
  { tag: t.attributeValue,                                    class: 'tok-attributeValue' },
])
