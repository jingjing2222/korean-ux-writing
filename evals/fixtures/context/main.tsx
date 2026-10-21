import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.createElement('div');
document.body.appendChild(container);
createRoot(container).render(<App />);
