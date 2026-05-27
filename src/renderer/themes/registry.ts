import { UnderleafTheme } from './schema'
import underleafDark from './underleaf-dark.json'
import underleafLight from './underleaf-light.json'
import lunar from './lunar.json'
import solar from './solar.json'
import red from './red.json'
import green from './green.json'
import blue from './blue.json'

export const THEMES: UnderleafTheme[] = [
  underleafDark as UnderleafTheme,
  underleafLight as UnderleafTheme,
  lunar as UnderleafTheme,
  solar as UnderleafTheme,
  red as UnderleafTheme,
  green as UnderleafTheme,
  blue as UnderleafTheme,
]

export const DEFAULT_THEME_ID = 'underleaf-dark'

export function getTheme(id: string): UnderleafTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}
