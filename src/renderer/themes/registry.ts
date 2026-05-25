import { UnderleafTheme } from './schema'
import underleafDark from './underleaf-dark.json'
import underleafLight from './underleaf-light.json'
import nord from './nord.json'
import solarizedLight from './solarized-light.json'
import overleafClassic from './overleaf-classic.json'

export const THEMES: UnderleafTheme[] = [
  underleafDark as UnderleafTheme,
  underleafLight as UnderleafTheme,
  nord as UnderleafTheme,
  solarizedLight as UnderleafTheme,
  overleafClassic as UnderleafTheme,
]

export const DEFAULT_THEME_ID = 'underleaf-dark'

export function getTheme(id: string): UnderleafTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}
