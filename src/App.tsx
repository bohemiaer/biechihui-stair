import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { routes } from './app/routes';
import { AppLayout } from './components/layout/AppLayout';
import { Home } from './pages/Home';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { CalendarView } from './pages/CalendarView';
import { Search } from './pages/Search';
import { Recommendations } from './pages/Recommendations';
import { Settings } from './pages/Settings';
import { Trash } from './pages/Trash';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path={routes.homeAlias.slice(1)} element={<Home />} />
          <Route path={routes.knowledge.slice(1)} element={<KnowledgeBase />} />
          <Route path={routes.trash.slice(1)} element={<Trash />} />
          <Route path={routes.libraryAlias.slice(1)} element={<KnowledgeBase />} />
          <Route path={routes.calendar.slice(1)} element={<CalendarView />} />
          <Route path={routes.search.slice(1)} element={<Search />} />
          <Route path={routes.recommendations.slice(1)} element={<Recommendations />} />
          <Route path={routes.hotAlias.slice(1)} element={<Recommendations />} />
          <Route path={routes.settings.slice(1)} element={<Settings />} />
          <Route path="*" element={<Navigate to={routes.home} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
