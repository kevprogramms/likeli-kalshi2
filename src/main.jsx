import './lib/relayerPatch.js';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DemoProvider } from './lib/DemoContext.jsx'
import { ThemeProvider } from './lib/ThemeContext.jsx'
import { WalletProvider } from './lib/WalletContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <WalletProvider>
        <DemoProvider>
          <App />
        </DemoProvider>
      </WalletProvider>
    </ThemeProvider>
  </StrictMode>,
)

