import { BarChart2, Home, Database, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div className="h-screen w-60 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700 flex items-center">
        <BarChart2 className="mr-2 text-blue-400" />
        <h1 className="text-xl font-bold">PCC FUND PREDICTION</h1>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <Link to="/" className="flex items-center p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <Home className="mr-3 text-gray-400" size={20} />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link to="/fund-data" className="flex items-center p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <Database className="mr-3 text-gray-400" size={20} />
              <span>Fund Data</span>
            </Link>
          </li>
          <li>
            <Link to="/crypto-data" className="flex items-center p-3 rounded-lg bg-blue-900 hover:bg-blue-800 transition-colors">
              <TrendingUp className="mr-3 text-blue-400" size={20} />
              <span>Crypto Data</span>
            </Link>
          </li>
          <li>
            <Link to="/predictions" className="flex items-center p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <BarChart2 className="mr-3 text-gray-400" size={20} />
              <span>Predictions</span>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar; 