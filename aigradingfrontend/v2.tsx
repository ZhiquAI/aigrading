import React from 'react';
import ReactDOM from 'react-dom/client';
import ModernLayout from './src/components/v2/layout/ModernLayout';
import { ToastProvider } from './components/Toast';
import { AppProvider } from './contexts/AppContext';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <AppProvider>
            <ToastProvider>
                <ModernLayout />
            </ToastProvider>
        </AppProvider>
    </React.StrictMode>
);
