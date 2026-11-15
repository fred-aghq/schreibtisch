import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/global.css';
import { App } from './app/App';
import { initStore } from './store/init';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
initStore();
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
