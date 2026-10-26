import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StudentApp from './App';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudentApp />
  </StrictMode>,
);
