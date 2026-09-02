import React, { useState, useEffect } from 'react';
import { db, DbConnectionState } from '../store/db';
import { Modal, Button, Card, CardContent } from './ui';
import { 
  Database, 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  RefreshCw, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  HardDrive,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  XCircle,
  Search
} from 'lucide-react';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DatabaseModal({ isOpen, onClose }: DatabaseModalProps) {
  const [connState, setConnState] = useState<DbConnectionState>(db.getConnectionState());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recoveryItems, setRecoveryItems] = useState<{key: string, type: string, count: number, sample: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const unsub = db.subscribeConnectionState(setConnState);
    return () => unsub();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSyncFeedback(null);
    try {
      const result = await db.testConnection();
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || 'Test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePushToCloud = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await db.syncAll();
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        text: res.message
      });
    } catch (e: any) {
      setSyncFeedback({ type: 'error', text: e.message || 'Push failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await db.pullFromCloud();
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        text: res.message
      });
    } catch (e: any) {
      setSyncFeedback({ type: 'error', text: e.message || 'Pull failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    const jsonString = db.exportData();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iris-database-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSyncFeedback({ type: 'success', text: 'Database exported successfully as JSON file.' });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const success = await db.importData(text);
        if (success) {
          setSyncFeedback({ type: 'success', text: 'Database backup successfully imported and synchronized!' });
        } else {
          setSyncFeedback({ type: 'error', text: 'Invalid database backup JSON format.' });
        }
      } catch (err: any) {
        setSyncFeedback({ type: 'error', text: 'Failed to read file: ' + err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadDemoData = async () => {
    if (confirm('This will load a complete demo dataset with sample clients, insurers, recipients, notes, and payment slips. Continue?')) {
      setIsSyncing(true);
      await db.resetToSampleData();
      setIsSyncing(false);
      setSyncFeedback({ type: 'success', text: 'Sample demo data successfully populated!' });
    }
  };

  const scanLocalStorage = () => {
    setIsScanning(true);
    const found: {key: string, type: string, count: number, sample: string}[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const first = parsed[0];
                let type = 'Unknown Array';
                let sampleName = first.name || first.slipNumber || first.noteId || 'Item';
                
                if (first.companyType) type = 'Clients';
                else if (first.defaultStopLoss) type = 'Insurers';
                else if (first.role) type = 'Recipients';
                else if (first.slipNumber) type = 'Payment Slips';
                else if (first.noteId) type = 'Commission Notes';
                
                found.push({ key, type, count: parsed.length, sample: sampleName });
              }
            }
          } catch (e) {}
        }
      }
      setRecoveryItems(found.sort((a,b) => b.count - a.count));
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };
  
  const recoverKey = (item: {key: string, type: string, count: number}) => {
    if (confirm(`Recover ${item.count} items from '${item.key}' into ${item.type}? This will overwrite your current active ${item.type} data.`)) {
      try {
        const raw = localStorage.getItem(item.key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (item.type === 'Clients') db.saveClients(parsed);
          else if (item.type === 'Insurers') db.saveInsurance(parsed);
          else if (item.type === 'Recipients') db.saveRecipients(parsed);
          else if (item.type === 'Payment Slips') db.savePaymentSlips(parsed);
          else if (item.type === 'Commission Notes') db.saveNotes(parsed);
          
          setSyncFeedback({ type: 'success', text: `Successfully recovered data from ${item.key}.` });
        }
      } catch (e: any) {
        setSyncFeedback({ type: 'error', text: `Failed to recover: ${e.message}` });
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Database & Cloud Sync Center" className="max-w-2xl">
      <div className="space-y-5 text-sm">
        
        {/* Status Header Card */}
        <div className="bg-gradient-to-r from-[#001233] to-[#0a2558] text-white p-5 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
                {connState.status === 'connected' ? (
                  <CloudCheck className="w-7 h-7 text-emerald-400" />
                ) : connState.status === 'error' ? (
                  <CloudOff className="w-7 h-7 text-rose-400" />
                ) : (
                  <Cloud className="w-7 h-7 text-amber-300" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-base text-white">Google Cloud Firestore</h4>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    connState.status === 'connected' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : connState.status === 'error'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      connState.status === 'connected' 
                        ? 'bg-emerald-400 animate-pulse' 
                        : connState.status === 'error'
                        ? 'bg-rose-400'
                        : 'bg-amber-300'
                    }`} />
                    {connState.status === 'connected' ? 'Connected & Synced' : connState.status === 'error' ? 'Sync Error' : 'Local Storage Mode'}
                  </span>
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  Project: <span className="font-mono text-white">{connState.projectId}</span>
                  {connState.lastSync && (
                    <span className="ml-2 text-blue-300">• Last synced at {connState.lastSync}</span>
                  )}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shadow-none whitespace-nowrap self-start sm:self-auto"
            >
              <Activity className={`w-3.5 h-3.5 mr-1.5 ${isTesting ? 'animate-spin' : 'text-blue-300'}`} />
              {isTesting ? 'Testing Ping...' : 'Test Connection'}
            </Button>
          </div>

          {/* Test connection result pill */}
          {testResult && (
            <div className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              testResult.success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Live Records Overview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Synchronized Database Collections</h5>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              Dual-write persistent storage
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
              <span className="text-xs text-gray-500 block font-medium">Clients</span>
              <span className="text-lg font-bold text-[#001233]">{connState.counts.clients}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
              <span className="text-xs text-gray-500 block font-medium">Insurers</span>
              <span className="text-lg font-bold text-[#001233]">{connState.counts.insurance}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
              <span className="text-xs text-gray-500 block font-medium">Recipients</span>
              <span className="text-lg font-bold text-[#001233]">{connState.counts.recipients}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
              <span className="text-xs text-gray-500 block font-medium">Transactions</span>
              <span className="text-lg font-bold text-[#001233]">{connState.counts.notes}</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-center col-span-2 sm:col-span-1">
              <span className="text-xs text-gray-500 block font-medium">Payment Slips</span>
              <span className="text-lg font-bold text-[#001233]">{connState.counts.paymentSlips}</span>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {syncFeedback && (
          <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            syncFeedback.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{syncFeedback.text}</span>
          </div>
        )}

        {/* Actions Grid */}
        <div className="space-y-3 pt-2">
          <h5 className="font-semibold text-xs text-gray-500 uppercase tracking-wider">Sync & Data Management</h5>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Push Local to Cloud */}
            <div className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium text-gray-900 mb-1">
                  <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  <span>Push Local to Cloud</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Uploads all your current local transaction and master records to Firestore Cloud DB.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handlePushToCloud} 
                disabled={isSyncing}
                className="w-full text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Push to Cloud Now
              </Button>
            </div>

            {/* Pull Cloud to Local */}
            <div className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 transition-colors bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-medium text-gray-900 mb-1">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  <span>Pull Cloud to Local</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Refreshes your browser with the latest records saved in Firestore Cloud DB.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handlePullFromCloud} 
                disabled={isSyncing}
                className="w-full text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                Pull from Cloud Now
              </Button>
            </div>
          </div>

          {/* Recovery Scanner */}
          <div className="pt-2">
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-medium text-amber-900">
                  <Search className="w-4 h-4" />
                  <span>Missing Data? Run Local Recovery</span>
                </div>
                <Button size="sm" variant="secondary" onClick={scanLocalStorage} disabled={isScanning} className="text-xs bg-white text-gray-800 border border-gray-300">
                  {isScanning ? 'Scanning...' : 'Scan Browser Storage'}
                </Button>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                If you lost your data, it might still be safely stored in your browser under an old name. Scan to find and recover it!
              </p>
              
              {recoveryItems.length > 0 && (
                <div className="space-y-2 mt-3">
                  {recoveryItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-amber-100 text-xs">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {item.type} <span className="text-gray-400 font-normal ml-1">({item.count} items)</span>
                        </div>
                        <div className="text-gray-500">Key: <span className="font-mono text-gray-400">{item.key}</span></div>
                        <div className="text-gray-500 italic truncate max-w-[200px]">e.g. "{item.sample}"</div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => recoverKey(item)} className="bg-amber-100 hover:bg-amber-200 text-amber-900 border-none">
                        Recover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Backup & Demo Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={handleExport}
                className="text-xs py-1.5"
                title="Download backup JSON"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-gray-600" />
                Export Backup (JSON)
              </Button>

              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImport} 
                  className="hidden" 
                />
                <span className="inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 text-xs shadow-sm cursor-pointer">
                  <Upload className="w-3.5 h-3.5 mr-1 text-gray-600" />
                  Import Backup (JSON)
                </span>
              </label>
            </div>

            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleLoadDemoData}
              disabled={isSyncing}
              className="text-xs text-blue-700 hover:bg-blue-50 py-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Reset to Demo Data
            </Button>
          </div>
        </div>

        {/* Informational note */}
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
          <span className="font-semibold">How IRIS Database Works:</span> All transactions and master records are continuously preserved in local storage and synchronized with Cloud Firestore (<code className="font-mono font-semibold">commission-check-28311</code>). Your data remains safe and accessible across tab refreshes and shared previews.
        </div>

      </div>
    </Modal>
  );
}
