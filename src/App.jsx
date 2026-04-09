import { useState, useEffect, useCallback } from 'react';
import {
  useAuthStore,
  useCardsStore,
  useTemplatesStore,
  useDocumentsStore,
} from './stores';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/ToastContainer';
import Dashboard from './pages/Dashboard';
import CardUpload from './pages/CardUpload';
import CardLibrary from './pages/CardLibrary';
import DocumentComposer from './pages/DocumentComposer';
import DocumentHistory from './pages/DocumentHistory';

export default function App() {
  const { currentUser, loading, initialize, validateSession } = useAuthStore();
  const { loadCards } = useCardsStore();
  const { loadTemplates } = useTemplatesStore();
  const { loadDocuments } = useDocumentsStore();

  const [activePage, setActivePage] = useState('dashboard');
  const [composerDocId, setComposerDocId] = useState(null);
  const [composerCardId, setComposerCardId] = useState(null);

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, []);

  // Load data when user logged in
  useEffect(() => {
    if (currentUser) {
      loadCards();
      loadTemplates();
      loadDocuments();
    }
  }, [currentUser]);

  const syncFromServer = useCallback(async () => {
    if (!currentUser) return;
    try {
      const valid = await validateSession();
      if (!valid) return;
      await Promise.all([
        loadCards(),
        loadDocuments(),
      ]);
    } catch (err) {
      console.error('Background sync failed', err);
    }
  }, [currentUser, validateSession, loadCards, loadDocuments]);

  // Keep browser tabs/devices eventually in sync.
  useEffect(() => {
    if (!currentUser) return undefined;
    const intervalId = setInterval(syncFromServer, 30000);
    const onFocus = () => {
      syncFromServer();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromServer();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser, syncFromServer]);

  const handleNavigate = (page, docId = null, cardId = null) => {
    setActivePage(page);
    setComposerDocId(docId);
    setComposerCardId(cardId);
  };

  if (loading) {
    return (
      <div className="auth-page">
        <div className="app-bg" />
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'cards':
        return <CardLibrary onNavigate={handleNavigate} />;
      case 'upload':
        return <CardUpload onNavigate={handleNavigate} />;
      case 'composer':
        return (
          <DocumentComposer
            key={composerCardId || composerDocId || 'new'}
            onNavigate={handleNavigate}
            editDocId={composerDocId}
            preselectedCardId={composerCardId}
          />
        );
      case 'documents':
        return <DocumentHistory onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <>
      <div className="app-bg" />
      <div className="app-layout">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="main-content">{renderPage()}</main>
      </div>
      <ToastContainer />
    </>
  );
}
