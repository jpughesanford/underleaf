import { UnderleafTheme } from './schema'
import underleafDark from './themes/underleaf-dark.json'
import underleafLight from './themes/underleaf-light.json'
import lunar from './themes/lunar.json'
import solar from './themes/solar.json'
import red from './themes/red.json'
import green from './themes/green.json'
import blue from './themes/blue.json'

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
