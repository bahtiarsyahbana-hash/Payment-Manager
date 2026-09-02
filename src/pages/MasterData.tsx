import { useState, useEffect } from 'react';
import { db, Client, Insurance, Recipient, DbConnectionState } from '../store/db';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Table, Th, Td } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';
import { Trash2, Edit, Database, CloudCheck, CloudOff, Cloud, RefreshCw } from 'lucide-react';
import DatabaseModal from '../components/DatabaseModal';

export default function MasterData() {
  const [activeTab, setActiveTab] = useState<'clients' | 'insurance' | 'recipients'>('clients');
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [connState, setConnState] = useState<DbConnectionState>(db.getConnectionState());
  
  const [clients, setClients] = useState<Client[]>([]);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  useEffect(() => {
    const u1 = db.subscribeClients(setClients);
    const u2 = db.subscribeInsurance(setInsurance);
    const u3 = db.subscribeRecipients(setRecipients);
    const u4 = db.subscribeConnectionState(setConnState);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const saveClients = (data: Client[]) => { setClients(data); db.saveClients(data); };
  const saveInsurance = (data: Insurance[]) => { setInsurance(data); db.saveInsurance(data); };
  const saveRecipients = (data: Recipient[]) => { setRecipients(data); db.saveRecipients(data); };

  // Forms state
  const [newClient, setNewClient] = useState({ name: '', companyType: '' });
  const [newInsurance, setNewInsurance] = useState({ name: '', defaultStopLoss: 0, defaultBrokerage: 0 });
  const [newRecipient, setNewRecipient] = useState({ name: '', role: 'Technical', defaultShare: 0, bankName: '', accountNumber: '', npwp: '' });

  // Edit state
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);

  const addClient = () => {
    if (!newClient.name) return;
    if (editingClientId) {
      saveClients(clients.map(c => c.id === editingClientId ? { ...c, ...newClient } : c));
      setEditingClientId(null);
    } else {
      saveClients([...clients, { id: uuidv4(), ...newClient }]);
    }
    setNewClient({ name: '', companyType: '' });
  };

  const handleEditClient = (c: Client) => {
    setEditingClientId(c.id);
    setNewClient({ name: c.name, companyType: c.companyType });
  };

  const addInsurance = () => {
    if (!newInsurance.name) return;
    if (editingInsuranceId) {
      saveInsurance(insurance.map(i => i.id === editingInsuranceId ? { ...i, ...newInsurance } : i));
      setEditingInsuranceId(null);
    } else {
      saveInsurance([...insurance, { id: uuidv4(), ...newInsurance }]);
    }
    setNewInsurance({ name: '', defaultStopLoss: 0, defaultBrokerage: 0 });
  };

  const handleEditInsurance = (i: Insurance) => {
    setEditingInsuranceId(i.id);
    setNewInsurance({ name: i.name, defaultStopLoss: i.defaultStopLoss, defaultBrokerage: i.defaultBrokerage });
  };

  const addRecipient = () => {
    if (!newRecipient.name) return;
    if (editingRecipientId) {
      saveRecipients(recipients.map(r => r.id === editingRecipientId ? {
        ...r,
        name: newRecipient.name, 
        role: newRecipient.role as any, 
        defaultShare: newRecipient.defaultShare,
        bankName: newRecipient.bankName,
        accountNumber: newRecipient.accountNumber,
        npwp: newRecipient.npwp
      } : r));
      setEditingRecipientId(null);
    } else {
      saveRecipients([...recipients, { 
        id: uuidv4(), 
        name: newRecipient.name, 
        role: newRecipient.role as any, 
        defaultShare: newRecipient.defaultShare,
        bankName: newRecipient.bankName,
        accountNumber: newRecipient.accountNumber,
        npwp: newRecipient.npwp
      }]);
    }
    setNewRecipient({ name: '', role: 'Technical', defaultShare: 0, bankName: '', accountNumber: '', npwp: '' });
  };

  const handleEditRecipient = (r: Recipient) => {
    setEditingRecipientId(r.id);
    setNewRecipient({
      name: r.name,
      role: r.role,
      defaultShare: r.defaultShare,
      bankName: r.bankName || '',
      accountNumber: r.accountNumber || '',
      npwp: r.npwp || ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Data</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage clients, insurers, recipients, and cloud database sync.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Cloud Database Status Trigger */}
          <button
            onClick={() => setIsDbModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white border border-gray-200 hover:border-blue-300 text-gray-700 shadow-sm transition-all"
            title="Open Database & Cloud Sync Center"
          >
            <span className={`w-2 h-2 rounded-full ${
              connState.status === 'connected' ? 'bg-emerald-500 animate-pulse' :
              connState.status === 'error' ? 'bg-rose-500' : 'bg-amber-500'
            }`} />
            <span className="font-semibold text-gray-900">
              {connState.status === 'connected' ? 'Cloud DB Connected' : 'Local Storage Mode'}
            </span>
            <span className="text-gray-400 font-mono text-[11px]">• Sync & Backup</span>
          </button>

          <Button variant="secondary" size="sm" onClick={() => setIsDbModalOpen(true)}>
            <Database className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Database Settings
          </Button>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-max">
        {['clients', 'insurance', 'recipients'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'clients' && (
        <Card>
          <CardHeader><CardTitle>Clients</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex-1">
                <Label>Name</Label>
                <Input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Client Name" />
              </div>
              <div className="flex-1">
                <Label>Company Type</Label>
                <Input value={newClient.companyType} onChange={e => setNewClient({...newClient, companyType: e.target.value})} placeholder="e.g. IT, Retail" />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={addClient}>{editingClientId ? 'Update' : 'Add Client'}</Button>
                {editingClientId && (
                  <Button variant="secondary" onClick={() => { setEditingClientId(null); setNewClient({ name: '', companyType: '' }); }}>Cancel</Button>
                )}
              </div>
            </div>
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Company Type</Th><Th className="w-24 text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <Td>{c.name}</Td>
                    <Td>{c.companyType}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditClient(c)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => saveClients(clients.filter(x => x.id !== c.id))}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'insurance' && (
        <Card>
          <CardHeader><CardTitle>Insurance Providers</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex-1">
                <Label>Name</Label>
                <Input value={newInsurance.name} onChange={e => setNewInsurance({...newInsurance, name: e.target.value})} placeholder="Provider Name" />
              </div>
              <div className="flex-1">
                <Label>Default Stop Loss (%)</Label>
                <Input type="number" value={newInsurance.defaultStopLoss} onChange={e => setNewInsurance({...newInsurance, defaultStopLoss: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="flex-1">
                <Label>Default Brokerage (%)</Label>
                <Input type="number" value={newInsurance.defaultBrokerage} onChange={e => setNewInsurance({...newInsurance, defaultBrokerage: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={addInsurance}>{editingInsuranceId ? 'Update' : 'Add Provider'}</Button>
                {editingInsuranceId && (
                  <Button variant="secondary" onClick={() => { setEditingInsuranceId(null); setNewInsurance({ name: '', defaultStopLoss: 0, defaultBrokerage: 0 }); }}>Cancel</Button>
                )}
              </div>
            </div>
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Stop Loss (%)</Th><Th>Brokerage (%)</Th><Th className="w-24 text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {insurance.map(i => (
                  <tr key={i.id}>
                    <Td>{i.name}</Td>
                    <Td>{i.defaultStopLoss}%</Td>
                    <Td>{i.defaultBrokerage}%</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditInsurance(i)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => saveInsurance(insurance.filter(x => x.id !== i.id))}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === 'recipients' && (
        <Card>
          <CardHeader><CardTitle>Recipients</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label>Account Name</Label>
                  <Input value={newRecipient.name} onChange={e => setNewRecipient({...newRecipient, name: e.target.value})} placeholder="Recipient / Account Name" />
                </div>
                <div className="flex-1">
                  <Label>Role</Label>
                  <Select value={newRecipient.role} onChange={e => setNewRecipient({...newRecipient, role: e.target.value})}>
                    <option value="Technical">Technical</option>
                    <option value="Agent">Agent</option>
                    <option value="Marketing">Marketing</option>
                    <option value="IT">IT</option>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Default Share (%)</Label>
                  <Input type="number" value={newRecipient.defaultShare} onChange={e => setNewRecipient({...newRecipient, defaultShare: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label>Bank</Label>
                  <Input value={newRecipient.bankName} onChange={e => setNewRecipient({...newRecipient, bankName: e.target.value})} placeholder="e.g. BCA, Mandiri" />
                </div>
                <div className="flex-1">
                  <Label>Acc. Number</Label>
                  <Input value={newRecipient.accountNumber} onChange={e => setNewRecipient({...newRecipient, accountNumber: e.target.value})} placeholder="Account Number" />
                </div>
                <div className="flex-1">
                  <Label>NPWP</Label>
                  <Input value={newRecipient.npwp} onChange={e => setNewRecipient({...newRecipient, npwp: e.target.value})} placeholder="NPWP Number" />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={addRecipient} className="w-32">{editingRecipientId ? 'Update' : 'Add Recipient'}</Button>
                  {editingRecipientId && (
                    <Button variant="secondary" onClick={() => { setEditingRecipientId(null); setNewRecipient({ name: '', role: 'Technical', defaultShare: 0, bankName: '', accountNumber: '', npwp: '' }); }}>Cancel</Button>
                  )}
                </div>
              </div>
            </div>
            <Table>
              <thead>
                <tr><Th>Account Name</Th><Th>Role</Th><Th>Default Share (%)</Th><Th>Bank</Th><Th>Acc. Number</Th><Th>NPWP</Th><Th className="w-24 text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {recipients.map(r => (
                  <tr key={r.id}>
                    <Td>{r.name}</Td>
                    <Td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {r.role}
                      </span>
                    </Td>
                    <Td>{r.defaultShare}%</Td>
                    <Td>{r.bankName || '-'}</Td>
                    <Td>{r.accountNumber || '-'}</Td>
                    <Td>{r.npwp || '-'}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditRecipient(r)}><Edit className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => saveRecipients(recipients.filter(x => x.id !== r.id))}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Database & Cloud Sync Center Modal */}
      <DatabaseModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}
