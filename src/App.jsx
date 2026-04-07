import { useState, useEffect } from 'react';
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
  const { currentUser, loading, initialize } = useAuthStore();
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
      loadCards(currentUser.id);
      loadTemplates();
      loadDocuments(currentUser.id);
    }
  }, [currentUser]);

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
