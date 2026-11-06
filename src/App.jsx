import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { supabase, supabaseConfigured } from './lib/supabase';
import { useApp, flushSettings } from './store/useApp';
import { useAppearance } from './lib/appearance';
import Login from './pages/Login';
import Layout from './components/Layout';
import Toasts from './components/Toasts';
import DialogHost from './components/Dialog';
import Splash from './components/Splash';

export default function App() {
  const session = useApp((s) => s.session);
  const authReady = useApp((s) => s.authReady);
  const dataReady = useApp((s) => s.dataReady);
  const setSession = useApp((s) => s.setSession);
  useAppearance();

  useEffect(() => {
    if (!supabaseConfigured) {
      setSession(null);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    const onUnload = () => flushSettings();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [setSession]);

  let body;
  if (!authReady) body = <Splash />;
  else if (!session) body = <Login />;
  else if (!dataReady) body = <Splash label="Loading your notes…" />;
  else
    body = (
      // The page routes live in components/PageRoutes; Layout renders one copy per in-app tab.
      <Routes>
        <Route path="*" element={<Layout />} />
      </Routes>
    );

  return (
    <>
      {body}
      <Toasts />
      <DialogHost />
    </>
  );
}
