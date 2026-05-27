import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/animations.css'
import './styles/utilities.css'
import './styles/pdf-viewer.css'
import './styles/theme-album.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
