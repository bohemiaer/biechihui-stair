import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Home } from './pages/Home';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { CalendarView } from './pages/CalendarView';
import { Search } from './pages/Search';
import { Recommendations } from './pages/Recommendations';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="calendar" element={<CalendarView />} />
          <Route path="search" element={<Search />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
