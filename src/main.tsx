import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initTauriAiProxy } from './lib/ai/tauriAiProxy.ts';
import { ToastProvider } from './components/ToastProvider.tsx';

initTauriAiProxy();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

