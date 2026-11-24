import './ui/styles/tokens.css'
import './ui/styles/app.css'
import { loadSettings } from './ui/storage'
import { applyTheme } from './ui/theme'

applyTheme(await loadSettings())
