import { Navigate, Route, Routes } from 'react-router-dom';
import Home from '../pages/Home';
import FolderPage from '../pages/FolderPage';
import NotePage from '../pages/NotePage';
import SettingsPage from '../pages/SettingsPage';
import TagPage from '../pages/TagPage';
import ArchivePage from '../pages/ArchivePage';

/**
 * The app's pages. Each in-app tab renders its own copy for its own path (`location`), so hooks like useParams /
 * useSearchParams inside a page see that tab's URL even while another tab is on screen.
 */
export default function PageRoutes({ location }) {
  return (
    <Routes location={location}>
      <Route index element={<Home />} />
      <Route path="f/:folderId" element={<FolderPage />} />
      <Route path="n/:noteId" element={<NotePage />} />
      <Route path="tags/:tag" element={<TagPage />} />
      <Route path="archive" element={<ArchivePage />} />
      <Route path="settings/:tab?" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
