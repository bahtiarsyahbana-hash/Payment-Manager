import { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import MasterData from './pages/MasterData';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import PaymentSlips from './pages/PaymentSlips';
import Login from './pages/Login';
import DatabaseModal from './components/DatabaseModal';
import { db, DbConnectionState } from './store/db';
import { LayoutDashboard, Database, FileText, PieChart, Receipt, LogOut, ChevronLeft, ChevronRight, Menu, CloudCheck, CloudOff, Cloud } from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'master' | 'transactions' | 'payment-slips' | 'reports'>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [connState, setConnState] = useState<DbConnectionState>(db.getConnectionState());

  useEffect(() => {
    const unsub = db.subscribeConnectionState(setConnState);
    return () => unsub();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'master', label: 'Master Data', icon: Database },
    { id: 'transactions', label: 'Transactions', icon: FileText },
    { id: 'payment-slips', label: 'Payment Slips', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: PieChart },
  ] as const;

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row print:bg-white overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-[#001233] text-white p-4 flex items-center justify-between print:hidden z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
            <img 
              src="https://i.ibb.co.com/RGLHt7bM/Alt-02-removebg-preview.png" 
              alt="BCI Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <h2 className="text-lg font-bold text-white">IRIS</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile DB Status Button */}
          <button
            onClick={() => setIsDbModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white border border-white/10 transition-colors"
            title="Database Connection Status"
          >
            <span className={`w-2 h-2 rounded-full ${
              connState.status === 'connected' ? 'bg-emerald-400 animate-pulse' :
              connState.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'
            }`} />
            <span className="text-[11px] font-medium">
              {connState.status === 'connected' ? 'Cloud DB' : 'Local DB'}
            </span>
          </button>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {!isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative inset-y-0 left-0 z-40
          bg-[#001233] text-white flex flex-col print:hidden shadow-2xl md:shadow-xl
          transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'w-72 translate-x-0' : 'w-20 -translate-x-full md:translate-x-0'}
        `}
      >
        {/* Toggle Button (Desktop) */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center text-gray-600 hover:text-[#001233] hover:shadow-md transition-all z-50 cursor-pointer"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="p-6 h-24 flex items-center">
          <div className={`flex items-center gap-3 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-full opacity-100' : 'w-0 opacity-0 md:w-full md:opacity-100 md:justify-center'}`}>
            <div className="w-10 h-10 min-w-[40px] bg-white rounded-lg flex items-center justify-center shadow-sm p-1">
              <img 
                src="https://i.ibb.co.com/RGLHt7bM/Alt-02-removebg-preview.png" 
                alt="BCI Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <h2 className="text-lg font-bold text-white leading-tight">IRIS</h2>
              <p className="text-xs text-blue-200">Payment Manager</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive 
                    ? 'bg-[#F59E0B] text-white shadow-md' 
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                } ${isSidebarOpen ? 'justify-start' : 'justify-center md:justify-start lg:justify-center'}`}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 min-w-[20px] transition-colors ${isActive ? 'text-white' : 'text-blue-300 group-hover:text-white'}`} />
                <span className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Database Status Button in Sidebar */}
        <div className="px-4 pt-2">
          <button
            onClick={() => setIsDbModalOpen(true)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-left border border-white/10 transition-colors ${
              isSidebarOpen ? 'justify-start' : 'justify-center'
            }`}
            title="Database Connection & Sync Status"
          >
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              connState.status === 'connected' ? 'bg-emerald-400 animate-pulse' :
              connState.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'
            }`} />
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate">
                    {connState.status === 'connected' ? 'Cloud DB Connected' : 'Local Storage Mode'}
                  </span>
                  <span className="text-[10px] text-blue-300 font-mono bg-white/10 px-1.5 py-0.5 rounded">Sync</span>
                </div>
                <p className="text-[10px] text-blue-200 truncate font-mono">
                  {connState.projectId}
                </p>
              </div>
            )}
          </button>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3 mt-4">
          <div className={`flex items-center gap-3 px-2 overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
            <div className="w-9 h-9 min-w-[36px] rounded-full bg-white flex items-center justify-center font-bold text-[#001233] shadow-sm">
              <span className="opacity-90">A</span>
            </div>
            <div className={`text-sm flex-1 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <p className="font-medium text-white">Admin User</p>
              <p className="text-xs text-blue-200">admin@bci.com</p>
            </div>
          </div>
          <button 
            onClick={() => setIsLoggedIn(false)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium mt-2 ${isSidebarOpen ? 'justify-center' : 'justify-center'}`}
            title={!isSidebarOpen ? 'Sign Out' : undefined}
          >
            <LogOut className="w-5 h-5 min-w-[20px]" />
            <span className={`whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 h-screen overflow-auto print:p-0 print:h-auto print:overflow-visible">
        <div className="max-w-6xl mx-auto print:max-w-none print:m-0">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'master' && <MasterData />}
          {currentPage === 'transactions' && <Transactions />}
          {currentPage === 'payment-slips' && <PaymentSlips />}
          {currentPage === 'reports' && <Reports />}
        </div>
      </main>

      {/* Database Connection & Cloud Sync Modal */}
      <DatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}
