import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from '@/components/theme-provider';
import { LayerSelectionProvider } from '@/hooks/useLayerSelection';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import 'leaflet/dist/leaflet.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found in index.html');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="pum-theme">
      <LayerSelectionProvider>
        <BrowserRouter
          future={{
            // v7_startTransition: React Router v7 will wrap navigation state
            // updates in React.startTransition. Opt-in early so the deprecation
            // warning goes away and we smooth-transition-ready.
            v7_startTransition: true,
            // v7_relativeSplatPath: relative child paths resolve differently
            // under splat (path="*") routes in v7. This app has no splat
            // routes (App.tsx only defines "/" and "/property/:id"), so the
            // flag is a pure no-op for behaviour; it only clears the warning.
            v7_relativeSplatPath: true,
          }}
        >
          <App />
        </BrowserRouter>
        <Toaster />
      </LayerSelectionProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
