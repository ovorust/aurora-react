import { HashRouter, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import KnowledgeManager from './pages/KnowledgeManager';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/knowledge-manager" element={<KnowledgeManager />} />
      </Routes>
    </HashRouter>
  );
}
