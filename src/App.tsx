import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CreateAdventurePage from './pages/CreateAdventurePage';
import AdventuresListPage from './pages/AdventuresListPage';
import AdventureDetailPage from './pages/AdventureDetailPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import RecordsPage from './pages/RecordsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="adventures" element={<AdventuresListPage />} />
        <Route path="adventures/:id" element={<AdventureDetailPage />} />
        <Route path="adventures/:adventureId/places/:placeId" element={<PlaceDetailPage inAdventure />} />
        <Route path="create" element={<CreateAdventurePage />} />
        <Route path="places/:placeId" element={<PlaceDetailPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
