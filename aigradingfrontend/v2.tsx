import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { HeroUIRootProvider } from './src/components/heroui/HeroUIRootProvider';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <React.StrictMode>
    <HeroUIRootProvider>
      <App />
    </HeroUIRootProvider>
  </React.StrictMode>
);
