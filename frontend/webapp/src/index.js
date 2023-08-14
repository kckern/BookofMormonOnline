// import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import App from './App';
import SimpleReactLightbox from 'simple-react-lightbox'
import "./views/_Common/Header.css";
import "./views/_Common/Main.css";

// Sentry.init({
//     dsn: "https://714feecb8d8146cfa52a9b494c3fbfb9@o1153664.ingest.sentry.io/6233207",
//     integrations: [new BrowserTracing()],
  
//     // Set tracesSampleRate to 1.0 to capture 100%
//     // of transactions for performance monitoring.
//     // We recommend adjusting this value in production
//     tracesSampleRate: 1.0,
//   });
  
ReactDOM.render(<SimpleReactLightbox><App /></SimpleReactLightbox>,document.getElementById('root'));
