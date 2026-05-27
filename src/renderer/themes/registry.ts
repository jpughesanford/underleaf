import { UnderleafTheme } from './schema'
import underleafDark from './underleaf-dark.json'
import underleafLight from './underleaf-light.json'
import cherryBlossom from './cherry-blossom.json'
import nord from './nord.json'
import solarizedLight from './solarized-light.json'

export const THEMES: UnderleafTheme[] = [
  underleafDark as UnderleafTheme,
  underleafLight as UnderleafTheme,
  cherryBlossom as UnderleafTheme,
  nord as UnderleafTheme,
  solarizedLight as UnderleafTheme,
]

export const DEFAULT_THEME_ID = 'underleaf-dark'

export function getTheme(id: string): UnderleafTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}
