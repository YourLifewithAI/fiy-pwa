import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Diagnose from './pages/Diagnose';
import Results from './pages/Results';
import Layout from './components/Layout';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/diagnose" element={<Diagnose />} />
        <Route path="/results/:sessionId" element={<Results />} />
      </Routes>
    </Layout>
  );
}
