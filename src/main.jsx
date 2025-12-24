import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoProvider } from './lib/DemoContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DemoProvider>
      <App />
    </DemoProvider>
  </StrictMode>,
)
