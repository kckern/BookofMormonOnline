import './polyfills/randomUUID'; // must be first — secure-context polyfill
// import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import App from './App';
import SimpleReactLightbox from 'simple-react-lightbox'
import "./views/_Common/Header.css";
import "./views/_Common/Main.css";

// Clear old Sendbird localStorage data (CDN is dead, service discontinued)
try {
  Object.keys(localStorage)
    .filter(k => k.toLowerCase().includes('sendbird') || k.startsWith('sb_') || k.startsWith('SB_'))
    .forEach(k => localStorage.removeItem(k));
} catch (e) {
  console.warn('Failed to clear Sendbird storage:', e);
}

// Sentry.init({
//     dsn: "https://714feecb8d8146cfa52a9b494c3fbfb9@o1153664.ingest.sentry.io/6233207",
//     integrations: [new BrowserTracing()],
  
//     // Set tracesSampleRate to 1.0 to capture 100%
//     // of transactions for performance monitoring.
//     // We recommend adjusting this value in production
//     tracesSampleRate: 1.0,
//   });

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'CACHE_CLEARED' && event.data.reload) {
            console.log('Cache cleared by service worker, reloading...');
            window.location.reload();
          }
        });
        
        // Check for updates to the service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, ask it to skip waiting
                console.log('New service worker available, activating...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                // Reload the page to get fresh content
                setTimeout(() => window.location.reload(), 1000);
              }
            });
          }
        });

        // Add global function to manually clear cache (for debugging)
        window.clearServiceWorkerCache = () => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
          }
        };
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
  
ReactDOM.render(<SimpleReactLightbox><App /></SimpleReactLightbox>,document.getElementById('root'));
