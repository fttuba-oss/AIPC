import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StudentApp from './App';
import { StudentStartupBoundary } from './StudentStartupBoundary';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudentStartupBoundary><StudentApp /></StudentStartupBoundary>
  </StrictMode>,
);
