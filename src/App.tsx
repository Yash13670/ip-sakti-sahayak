import { useAppStore } from './store';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Screening } from './pages/Screening';
import { Chat } from './pages/Chat';
import { Evidence } from './pages/Evidence';
import { Reports } from './pages/Reports';
import { EvidenceModal } from './components/shared/EvidenceModal';
import { EscalationModal } from './components/shared/EscalationModal';

function App() {
  const { currentScreen } = useAppStore();

  const renderPage = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'screening':
        return <Screening />;
      case 'chat':
        return <Chat />;
      case 'evidence':
        return <Evidence />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Layout>{renderPage()}</Layout>
      <EvidenceModal />
      <EscalationModal />
    </>
  );
}

export default App;
