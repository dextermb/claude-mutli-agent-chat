import type { HighlighterCore, LanguageInput, ThemedToken } from "shiki/core"

type Language = {
  name: string
  load: () => Promise<{ default: LanguageInput }>
}

const typescript: Language = {
  name: "typescript",
  load: () => import("shiki/langs/typescript.mjs"),
}
const javascript: Language = {
  name: "javascript",
  load: () => import("shiki/langs/javascript.mjs"),
}
const shell: Language = {
  name: "shellscript",
  load: () => import("shiki/langs/shellscript.mjs"),
}
const markdown: Language = {
  name: "markdown",
  load: () => import("shiki/langs/markdown.mjs"),
}
const python: Language = {
  name: "python",
  load: () => import("shiki/langs/python.mjs"),
}
const yaml: Language = {
  name: "yaml",
  load: () => import("shiki/langs/yaml.mjs"),
}

const LANGUAGES: Record<string, Language> = {
  ts: typescript,
  typescript,
  tsx: { name: "tsx", load: () => import("shiki/langs/tsx.mjs") },
  js: javascript,
  javascript,
  json: { name: "json", load: () => import("shiki/langs/json.mjs") },
  sh: shell,
  bash: shell,
  shell,
  zsh: shell,
  css: { name: "css", load: () => import("shiki/langs/css.mjs") },
  html: { name: "html", load: () => import("shiki/langs/html.mjs") },
  md: markdown,
  markdown,
  py: python,
  python,
  go: { name: "go", load: () => import("shiki/langs/go.mjs") },
  sql: { name: "sql", load: () => import("shiki/langs/sql.mjs") },
  diff: { name: "diff", load: () => import("shiki/langs/diff.mjs") },
  yaml,
  yml: yaml,
}

let highlighter: Promise<HighlighterCore> | null = null

function loadHighlighter() {
  highlighter ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
  ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
    createHighlighterCore({
      themes: [import("shiki/themes/gruvbox-dark-medium.mjs")],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    })
  )
  return highlighter
}

export async function highlight(
  code: string,
  language: string
): Promise<ThemedToken[][] | null> {
  const known = LANGUAGES[language.toLowerCase()]
  if (!known) return null
  const shiki = await loadHighlighter()
  if (!shiki.getLoadedLanguages().includes(known.name)) {
    await shiki.loadLanguage((await known.load()).default)
  }
  return shiki.codeToTokens(code, {
    lang: known.name,
    theme: "gruvbox-dark-medium",
  }).tokens
}
