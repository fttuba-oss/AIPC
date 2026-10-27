import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ScoreSelection } from '../../contracts';
import { createMemoryScoreGateway } from '../../contracts/testing';
import { ScoreFilesManager, ScoreViewer, useScoreCatalog } from './index';
import '../../index.css';
import '../../shared/styles.css';
const gateway = createMemoryScoreGateway();
function ScoreWorkbench() {
 const catalog = useScoreCatalog(gateway);
 const [selection, setSelection] = useState<ScoreSelection | null>(null);
 return <main className="role-app app-content"><h1>Score developer workbench</h1><ScoreFilesManager catalog={catalog} onOpenScore={setSelection} /><ScoreViewer selection={selection} /></main>;
}
createRoot(document.getElementById('root')!).render(<ScoreWorkbench />);
