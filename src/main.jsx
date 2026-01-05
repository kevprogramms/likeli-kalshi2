import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoProvider } from './lib/DemoContext.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <DemoProvider>
        <App />
      </DemoProvider>
    </ThemeProvider>
  </StrictMode>,
)

