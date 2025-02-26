import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import CryptoData from './pages/CryptoData';
import FundData from './pages/FundData';
import Predictions from './pages/Predictions';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/fund-data" replace />} />
            <Route path="fund-data" element={<FundData />} />
            <Route path="crypto-data" element={<CryptoData />} />
            <Route path="predictions" element={<Predictions />} />
            <Route path="*" element={<Navigate to="/fund-data" replace />} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
