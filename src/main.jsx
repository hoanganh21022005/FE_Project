import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SCMSProvider } from './context/SCMSContext'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SCMSProvider>
      <App />
    </SCMSProvider>
  </StrictMode>,
)
