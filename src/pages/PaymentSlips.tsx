import { useState, useEffect } from 'react';
import { db, CommissionNote, Recipient, PaymentSlip, Client } from '../store/db';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Table, Th, Td, Modal } from '../components/ui';
import { formatIDR } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { Printer, CheckCircle, Clock, Plus, AlertCircle, Eye } from 'lucide-react';

export default function PaymentSlips() {
  const [view, setView] = useState<'list' | 'generate'>('list');
  const [listTab, setListTab] = useState<'recap' | 'slips'>('recap');
  const [recapFilter, setRecapFilter] = useState<'All' | 'No Payments' | 'Partially Paid' | 'Fully Paid'>('All');
  const [slipsTransactionFilter, setSlipsTransactionFilter] = useState<string>('All');
  const [slipsDateFilter, setSlipsDateFilter] = useState<string>('');
  const [slipsPeriodFilter, setSlipsPeriodFilter] = useState<string>('All');
  const [slipsRecipientFilter, setSlipsRecipientFilter] = useState<string>('All');
  const [viewingRecapNote, setViewingRecapNote] = useState<CommissionNote | null>(null);
  
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [notes, setNotes] = useState<CommissionNote[]>([]);
  const [slips, setSlips] = useState<PaymentSlip[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const u1 = db.subscribeRecipients(setRecipients);
    const u2 = db.subscribeNotes(setNotes);
    const u3 = db.subscribePaymentSlips(setSlips);
    const u4 = db.subscribeClients(setClients);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const handleRefreshMaster = () => {
    // Data refreshes automatically now via Firebase listeners
  };

  // Form state
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [period, setPeriod] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [taxPercentage, setTaxPercentage] = useState<number>(0);

  const [printSlip, setPrintSlip] = useState<PaymentSlip | null>(null);
  const [compilePrintNote, setCompilePrintNote] = useState<CommissionNote | null>(null);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatPeriod = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString.length === 7 ? `${dateString}-01` : dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  const handlePrint = (title: string) => {
    const originalTitle = document.title;
    document.title = title;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Helper to get Client Names for a Note
  const getNoteClients = (note: CommissionNote) => {
    const clientIds = Array.from(new Set(note.details.map(d => d.clientId)));
    return clientIds.map(id => clients.find(c => c.id === id)?.name).filter(Boolean).join(', ');
  };

  const getNoteSums = (note: CommissionNote) => {
    let grossPremium = 0;
    let stopLossAmount = 0;
    let incomeAfterStopLoss = 0;
    let calculatedNetCommission = 0;
    let vatAmount = 0;
    let whtAmount = 0;
    let nettBrokerage = 0;

    note.details.forEach(d => {
      grossPremium += d.grossPremium || 0;
      stopLossAmount += d.stopLossAmount || 0;
      incomeAfterStopLoss += d.incomeAfterStopLoss || 0;
      
      const calcNet = d.calculatedNetCommission || 0;
      calculatedNetCommission += calcNet;
      
      vatAmount += calcNet * ((d.vat || 0) / 100);
      whtAmount += calcNet * ((d.wht || 0) / 100);
      
      nettBrokerage += d.nettBrokerage || 0;
    });

    return {
      grossPremium,
      stopLossAmount,
      incomeAfterStopLoss,
      calculatedNetCommission,
      vatAmount,
      whtAmount,
      nettBrokerage
    };
  };

  const renderRecapHeader = (note: CommissionNote) => {
    const sums = getNoteSums(note);
    const noteSlips = slips.filter(s => s.noteId === note.id);
    const generatedDate = noteSlips.length > 0 ? noteSlips[0].date : (note.receiptDate || new Date().toISOString().split('T')[0]);
    
    return (
      <>
        {/* Header without Logo */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-black">
          <div className="pt-1">
            <h1 className="text-2xl font-bold uppercase tracking-wider mb-1 text-gray-900">PT. LONG TERM VISION</h1>
            <p className="text-sm text-gray-600">One Pacific Place, 15th Floor, Suite 1501</p>
            <p className="text-sm text-gray-600">Jl. Jendral Sudirman Kav. 52-53, Jakarta 12190</p>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center tracking-widest text-[#001233] mb-8">PAYMENT CALCULATION SLIP</h2>
        
        <div className="grid grid-cols-2 gap-12 mb-6 text-sm">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Transaction ID</span>
              <span className="font-semibold text-gray-900 text-right">{note.noteId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Period</span>
              <span className="font-semibold text-gray-900 text-right">{formatPeriod(note.date.substring(0, 7))}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-gray-900 text-right">{formatDate(generatedDate)}</span>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-black my-6"></div>

        <div className="grid grid-cols-2 gap-12 mb-8 text-sm">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Client Name:</span>
              <span className="font-semibold text-gray-900 text-right">{getNoteClients(note)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Premium:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.grossPremium)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Stop loss:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.stopLossAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Income After Stop Los:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.incomeAfterStopLoss)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">To Broker:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.calculatedNetCommission)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">VAT:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.vatAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">WHT:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.whtAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GROSS BROKER:</span>
              <span className="font-semibold text-gray-900 text-right">{formatIDR(sums.nettBrokerage)}</span>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-black mb-8"></div>
      </>
    );
  };

  // Helper to get Distribution Status
  const getPaymentStatusInfo = (note: CommissionNote) => {
    const noteSlips = slips.filter(s => s.noteId === note.id);
    const uniqueRecipientsInNote = new Set<string>();
    note.details.forEach(d => d.distributions.forEach(dist => uniqueRecipientsInNote.add(dist.recipientId)));
    
    // Check how many UNIQUE recipients have slips generated
    const uniqueSlipsGenerated = new Set<string>();
    noteSlips.forEach(s => uniqueSlipsGenerated.add(s.recipientId));

    const total = uniqueRecipientsInNote.size;
    const generated = uniqueSlipsGenerated.size;

    if (total === 0) return { status: 'No Payments', text: 'No Recipients', allGenerated: false };
    if (generated === 0) return { status: 'No Payments', text: `No Slips (${generated}/${total} generated)`, allGenerated: false };
    if (generated >= total) {
      // Check if all generated slips are marked as 'Paid'
      const allPaid = noteSlips.every(s => s.status === 'Paid');
      if (allPaid) {
        return { status: 'Fully Paid', text: `Fully Paid (${generated}/${total} recipients)`, allGenerated: true };
      } else {
        return { status: 'Partially Paid', text: `Awaiting Payment (${generated}/${total} generated)`, allGenerated: true };
      }
    }
    return { status: 'Partially Paid', text: `Partially Generated (${generated}/${total})`, allGenerated: false };
  };

  const getRecapDetails = (note: CommissionNote) => {
    const noteSlips = slips.filter(s => s.noteId === note.id);
    const recipientMap = new Map<string, { recipient: Recipient, gross: number, slip: PaymentSlip | undefined }>();
    
    note.details.forEach(d => {
      d.distributions.forEach(dist => {
        if (!recipientMap.has(dist.recipientId)) {
          const rec = recipients.find(r => r.id === dist.recipientId);
          if (rec) {
            recipientMap.set(dist.recipientId, {
              recipient: rec,
              gross: 0,
              slip: noteSlips.find(s => s.recipientId === dist.recipientId)
            });
          }
        }
        if (recipientMap.has(dist.recipientId)) {
          recipientMap.get(dist.recipientId)!.gross += dist.amount;
        }
      });
    });
    
    return Array.from(recipientMap.values());
  };

  const approvedNotes = notes.filter(n => n.status === 'Commission Received');
  const incompleteNotes = approvedNotes.filter(n => getPaymentStatusInfo(n).status !== 'Fully Paid');

  // Generate View Logic
  const selectedNote = notes.find(n => n.id === selectedNoteId);
  const noteStatusInfo = selectedNote ? getPaymentStatusInfo(selectedNote) : null;
  
  const noteRecipients = selectedNote 
    ? Array.from(new Set(selectedNote.details.flatMap(d => d.distributions.map(dist => dist.recipientId))))
    : [];
  
  const generatedRecipientIds = selectedNote 
    ? slips.filter(s => s.noteId === selectedNote.id).map(s => s.recipientId)
    : [];

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId);
  const isMasterDataIncomplete = selectedRecipient && (!selectedRecipient.bankName || !selectedRecipient.accountNumber || !selectedRecipient.npwp);

  let totalGross = 0;
  if (selectedNote && selectedRecipientId) {
    selectedNote.details.forEach(d => {
      const dist = d.distributions.find(x => x.recipientId === selectedRecipientId);
      if (dist) totalGross += dist.amount;
    });
  }

  const taxAmount = totalGross * (taxPercentage / 100);
  const netCommission = totalGross - taxAmount;

  const handleGenerate = () => {
    if (!selectedNoteId || !selectedRecipientId || !period || !paymentDate) {
      alert('Please fill in all required fields.');
      return;
    }

    // Database Validation: Prevent double payments
    const existingSlip = slips.find(s => s.noteId === selectedNoteId && s.recipientId === selectedRecipientId);
    if (existingSlip) {
      const recName = recipients.find(r => r.id === selectedRecipientId)?.name || 'Unknown';
      alert(`Error: Payment slip for ${recName} in this transaction has already been generated.`);
      return;
    }

    const currentYear = new Date().getFullYear();
    const yearSlips = slips.filter(s => s.slipNumber.startsWith(`PV-${currentYear}-`));
    const nextNum = yearSlips.length + 1;

    const rec = recipients.find(r => r.id === selectedRecipientId);

    const newSlip: PaymentSlip = {
      id: uuidv4(),
      slipNumber: `PV-${currentYear}-${nextNum.toString().padStart(3, '0')}`,
      recipientId: selectedRecipientId,
      date: new Date().toISOString().split('T')[0],
      period,
      paymentDate,
      taxAmount,
      totalGross,
      netCommission,
      status: 'Generated',
      noteId: selectedNoteId,
      recipientNameSnapshot: rec?.name || null,
      bankNameSnapshot: rec?.bankName || null,
      accountNumberSnapshot: rec?.accountNumber || null,
      npwpSnapshot: rec?.npwp || null
    };

    const updatedSlips = [newSlip, ...slips];
    setSlips(updatedSlips);
    db.savePaymentSlips(updatedSlips);
    
    // Reset form
    setSelectedRecipientId('');
    setPeriod('');
    setPaymentDate('');
    setTaxPercentage(0);
    
    // If fully processed now, go back to list
    const newStatusInfo = getPaymentStatusInfo(selectedNote!);
    if (newStatusInfo.allGenerated || updatedSlips.filter(s => s.noteId === selectedNoteId).length >= noteRecipients.length) {
      setView('list');
      setSelectedNoteId('');
    }
  };

  const handleMarkPaid = (id: string) => {
    const updatedSlips = slips.map(s => s.id === id ? { ...s, status: 'Paid' as const } : s);
    setSlips(updatedSlips);
    db.savePaymentSlips(updatedSlips);
  };

  const getRecipientName = (id: string) => recipients.find(r => r.id === id)?.name || 'Unknown';

  // Filtered Recap Notes
  const filteredRecapNotes = approvedNotes.filter(note => {
    if (recapFilter === 'All') return true;
    return getPaymentStatusInfo(note).status === recapFilter;
  });

  // Filtered Slips
  const filteredSlips = slips.filter(slip => {
    if (slipsTransactionFilter !== 'All' && slip.noteId !== slipsTransactionFilter) return false;
    if (slipsDateFilter && slip.date !== slipsDateFilter) return false;
    if (slipsPeriodFilter !== 'All' && slip.period !== slipsPeriodFilter) return false;
    if (slipsRecipientFilter !== 'All' && slip.recipientId !== slipsRecipientFilter) return false;
    return true;
  });

  // Unique transactions that have slips
  const transactionsWithSlips = Array.from(new Set(slips.map(s => s.noteId)))
    .map(noteId => notes.find(n => n.id === noteId))
    .filter(Boolean) as CommissionNote[];

  const uniquePeriods = Array.from(new Set(slips.map(s => s.period))).filter(Boolean).sort();
  const recipientsWithSlips = Array.from(new Set(slips.map(s => s.recipientId)))
    .map(id => recipients.find(r => r.id === id))
    .filter(Boolean) as Recipient[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h1 className="text-2xl font-bold text-gray-900">Payment Slips</h1>
        {view === 'list' ? (
          <Button onClick={() => { setView('generate'); setSelectedNoteId(''); }}><Plus className="w-4 h-4 mr-2" /> Generate New Slip</Button>
        ) : (
          <Button variant="secondary" onClick={() => setView('list')}>Back to List</Button>
        )}
      </div>

      {view === 'list' ? (
        <div className="no-print space-y-4">
          <div className="flex space-x-4 border-b border-gray-200">
            <button 
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${listTab === 'recap' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setListTab('recap')}
            >
              Distribution Recap
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${listTab === 'slips' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setListTab('slips')}
            >
              Generated Slips History
            </button>
          </div>

          {listTab === 'recap' ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Transaction Distribution Status</CardTitle>
                <Select value={recapFilter} onChange={e => setRecapFilter(e.target.value as any)} className="w-64">
                  <option value="All">All Transactions</option>
                  <option value="No Payments">No Payments</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Fully Paid">Fully Paid</option>
                </Select>
              </CardHeader>
              <CardContent>
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Receipt Date</Th>
                      <Th>Note ID</Th>
                      <Th>Client(s)</Th>
                      <Th className="text-right">Total Net Commission</Th>
                      <Th>Payment Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecapNotes.length === 0 ? (
                      <tr><Td colSpan={7} className="text-center text-gray-500 py-8">No transactions found for this filter.</Td></tr>
                    ) : (
                      filteredRecapNotes.map(note => {
                        const info = getPaymentStatusInfo(note);
                        return (
                          <tr key={note.id} className="hover:bg-gray-50">
                            <Td>{note.date}</Td>
                            <Td>{note.receiptDate || '-'}</Td>
                            <Td className="font-medium">{note.noteId}</Td>
                            <Td>{getNoteClients(note)}</Td>
                            <Td className="text-right">{formatIDR(note.totalNetCommission)}</Td>
                            <Td>
                              {info.status === 'Fully Paid' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> {info.text}</span>}
                              {info.status === 'Partially Paid' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/> {info.text}</span>}
                              {info.status === 'No Payments' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1"/> {info.text}</span>}
                            </Td>
                            <Td className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 px-2" onClick={() => setViewingRecapNote(note)} title="View Details">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {!info.allGenerated && (
                                  <Button size="sm" variant="secondary" onClick={() => { setSelectedNoteId(note.id); setView('generate'); }}>
                                    Generate Slips
                                  </Button>
                                )}
                                {info.allGenerated && (
                                  <Button size="sm" variant="secondary" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setCompilePrintNote(note)}>
                                    <Printer className="w-4 h-4 mr-1" /> Print All
                                  </Button>
                                )}
                              </div>
                            </Td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
                <CardTitle>Generated Payment Slips</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 mb-1">Date</span>
                    <Input type="date" value={slipsDateFilter} onChange={e => setSlipsDateFilter(e.target.value)} className="w-full sm:w-auto h-9" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 mb-1">Period</span>
                    <Select value={slipsPeriodFilter} onChange={e => setSlipsPeriodFilter(e.target.value)} className="w-full sm:w-32 h-9 py-1">
                      <option value="All">All Periods</option>
                      {uniquePeriods.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 mb-1">Recipient</span>
                    <Select value={slipsRecipientFilter} onChange={e => setSlipsRecipientFilter(e.target.value)} className="w-full sm:w-32 h-9 py-1">
                      <option value="All">All Recipients</option>
                      {recipientsWithSlips.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500 mb-1">Transaction</span>
                    <Select value={slipsTransactionFilter} onChange={e => setSlipsTransactionFilter(e.target.value)} className="w-full sm:w-40 h-9 py-1">
                      <option value="All">All Transactions</option>
                      {transactionsWithSlips.map(note => (
                        <option key={note.id} value={note.id}>{note.noteId}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Slip Number</Th>
                      <Th>Transaction</Th>
                      <Th>Recipient</Th>
                      <Th>Period</Th>
                      <Th className="text-right">Net Commission</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSlips.length === 0 ? (
                      <tr><Td colSpan={8} className="text-center text-gray-500 py-8">No payment slips found for this filter.</Td></tr>
                    ) : (
                      filteredSlips.map(slip => {
                        const note = notes.find(n => n.id === slip.noteId);
                        return (
                          <tr key={slip.id} className="hover:bg-gray-50">
                            <Td>{slip.date}</Td>
                            <Td className="font-medium text-blue-600">{slip.slipNumber}</Td>
                            <Td>{note?.noteId || 'Unknown'}</Td>
                            <Td>{getRecipientName(slip.recipientId)}</Td>
                            <Td>{slip.period}</Td>
                            <Td className="text-right font-semibold">{formatIDR(slip.netCommission)}</Td>
                            <Td>
                              {slip.status === 'Paid' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Paid</span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/> Generated</span>
                              )}
                            </Td>
                            <Td className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button size="sm" variant="secondary" onClick={() => setPrintSlip(slip)}><Printer className="w-4 h-4 mr-1" /> Print</Button>
                                {slip.status === 'Generated' && (
                                  <Button size="sm" variant="secondary" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleMarkPaid(slip.id)}>Mark Paid</Button>
                                )}
                              </div>
                            </Td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="no-print space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Payment Slip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label>Approved Transaction</Label>
                  <Select value={selectedNoteId} onChange={e => { setSelectedNoteId(e.target.value); setSelectedRecipientId(''); }}>
                    <option value="">Select Transaction...</option>
                    {incompleteNotes.map(n => (
                      <option key={n.id} value={n.id}>{n.noteId} - {getNoteClients(n)}</option>
                    ))}
                  </Select>
                  {selectedNoteId && (
                    <p className="text-sm mt-2 flex items-center">
                      Status: 
                      <span className={`ml-2 font-semibold ${noteStatusInfo?.status === 'Partially Paid' ? 'text-yellow-600' : 'text-blue-600'}`}>
                        {noteStatusInfo?.text}
                      </span>
                    </p>
                  )}
                </div>

                {selectedNoteId && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Eligible Recipient</Label>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600" onClick={handleRefreshMaster}>
                          Refresh from Master
                        </Button>
                      </div>
                      <Select value={selectedRecipientId} onChange={e => setSelectedRecipientId(e.target.value)}>
                        <option value="">Select Recipient...</option>
                        {noteRecipients.filter(rId => !generatedRecipientIds.includes(rId)).map(rId => {
                          const rec = recipients.find(r => r.id === rId);
                          return (
                            <option key={rId} value={rId}>
                              {rec?.name} ({rec?.role})
                            </option>
                          );
                        })}
                      </Select>
                      {selectedRecipient && (
                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm">
                          <p className="font-semibold text-gray-700 mb-2">Master Data Snapshot:</p>
                          <div className="grid grid-cols-2 gap-2 text-gray-600">
                            <p><span className="font-medium">Account Name:</span> {selectedRecipient.name}</p>
                            <p><span className="font-medium">Bank Name:</span> {selectedRecipient.bankName || '-'}</p>
                            <p><span className="font-medium">Account No:</span> {selectedRecipient.accountNumber || '-'}</p>
                            <p><span className="font-medium">NPWP:</span> {selectedRecipient.npwp || '-'}</p>
                          </div>
                          {isMasterDataIncomplete && (
                            <div className="mt-2 text-yellow-700 bg-yellow-50 p-2 rounded flex items-start text-xs">
                              <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
                              <p>Warning: Master data for this recipient is incomplete. Please update it in the Master Data menu if needed.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Period</Label>
                      <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g., October 2023" />
                    </div>
                    <div>
                      <Label>Payment Date</Label>
                      <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              {selectedRecipientId && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-semibold text-blue-900 mb-4">Calculation Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-blue-700">Total Gross Commission</Label>
                      <p className="text-xl font-bold text-blue-900">{formatIDR(totalGross)}</p>
                      <p className="text-xs text-blue-600 mt-1">From Transaction {selectedNote?.noteId}</p>
                    </div>
                    <div>
                      <Label className="text-blue-700">Tax (%)</Label>
                      <div className="flex items-center space-x-2">
                        <Input type="number" value={taxPercentage} onChange={e => setTaxPercentage(parseFloat(e.target.value) || 0)} className="bg-white w-24" />
                        <span className="text-blue-900 font-medium">%</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">Amount: {formatIDR(taxAmount)}</p>
                    </div>
                    <div>
                      <Label className="text-blue-700">Net Commission After Tax</Label>
                      <p className="text-xl font-bold text-green-700">{formatIDR(netCommission)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleGenerate} disabled={!selectedRecipientId}>
                  Generate Payment Slip
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disbursement Recap Print Modal */}
      {viewingRecapNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col print:shadow-none print:overflow-visible print:max-h-none print:w-full print:max-w-none print:block">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 no-print">
              <h3 className="text-lg font-bold">Print Distribution Recap</h3>
              <div className="space-x-2 flex items-center">
                <Button variant="secondary" onClick={() => setViewingRecapNote(null)}>Close</Button>
                <Button onClick={() => handlePrint(viewingRecapNote.noteId)}><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>
              </div>
            </div>
            
            <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-start gap-2 no-print">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Having trouble printing?</strong>
                Because this app is running inside a secure preview frame, your browser might block the print dialog. 
                If the "Print PDF" button doesn't work, please open this app in a <strong>new tab</strong> using the button at the top right of the screen, and try printing again.
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-gray-100 flex-1 flex justify-center print:bg-transparent print:p-0 print:block">
              {/* The printable area */}
              <div id="printable-recap" className="bg-white w-full max-w-[210mm] aspect-[21/29.7] p-8 sm:p-12 shadow-sm text-black relative print:aspect-auto print:w-[210mm] print:h-[297mm] print:max-w-none print:min-h-0 print:shadow-none print:p-0 print:block overflow-hidden mx-auto">
                {renderRecapHeader(viewingRecapNote)}

                {/* Content */}
                <h3 className="font-bold text-gray-900 mb-3 text-sm tracking-wide">PAYMENT DESCRIPTION</h3>
                
                <table className="w-full mb-10 text-sm">
                  <thead>
                    <tr className="bg-[#001233] text-white">
                      <th className="p-3 text-left font-semibold rounded-tl-md">PAYMENT DESCRIPTION</th>
                      <th className="p-3 text-right font-semibold">COMMISSION AMOUNT</th>
                      <th className="p-3 text-right font-semibold">TAX</th>
                      <th className="p-3 w-4"></th>
                      <th className="p-3 text-right font-semibold rounded-tr-md">NETT AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getRecapDetails(viewingRecapNote).length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-gray-500 py-8">No distributions found.</td></tr>
                    ) : (
                      <>
                        {getRecapDetails(viewingRecapNote).map((detail, idx) => {
                          const tax = detail.slip ? detail.slip.taxAmount : 0;
                          const nett = detail.slip ? detail.slip.netCommission : detail.gross;
                          return (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="p-3 text-left uppercase text-gray-800 font-medium">{detail.recipient.role.toUpperCase()} - {detail.recipient.name.toUpperCase()}</td>
                              <td className="p-3 text-right text-gray-600">{formatIDR(detail.gross)}</td>
                              <td className="p-3 text-right text-red-500">{formatIDR(tax)}</td>
                              <td className="p-3"></td>
                              <td className="p-3 text-right text-gray-900 font-semibold">{formatIDR(nett)}</td>
                            </tr>
                          );
                        })}
                        {/* Company Net (Nett Broker) */}
                        <tr className="bg-gray-50/50">
                          <td className="p-3 text-left uppercase text-gray-800 font-bold">NETT BROKER</td>
                          <td className="p-3 text-right text-gray-600">{formatIDR(viewingRecapNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0))}</td>
                          <td className="p-3 text-right text-red-500">{formatIDR(0)}</td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right text-gray-900 font-bold">{formatIDR(viewingRecapNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0))}</td>
                        </tr>
                        {/* Summary Footer */}
                        <tr className="bg-[#001233]/5 border-t-2 border-[#001233]">
                          <td className="p-4 text-left font-bold text-[#001233]">TOTAL</td>
                          <td className="p-4 text-right text-[#001233] font-bold text-lg">
                            {formatIDR(viewingRecapNote.details.reduce((sum, d) => sum + d.distributions.reduce((s, dist) => s + dist.amount, 0), 0) + viewingRecapNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0))}
                          </td>
                          <td className="p-4 text-right text-red-600 font-bold">
                            {formatIDR(getRecapDetails(viewingRecapNote).reduce((sum, d) => sum + (d.slip ? d.slip.taxAmount : 0), 0))}
                          </td>
                          <td className="p-4"></td>
                          <td className="p-4 text-right text-[#001233] font-bold text-xl">
                            {formatIDR(
                              getRecapDetails(viewingRecapNote).reduce((sum, d) => sum + (d.slip ? d.slip.netCommission : d.gross), 0) + 
                              viewingRecapNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0)
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compile Print Modal */}
      {compilePrintNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col print:shadow-none print:overflow-visible print:max-h-none print:w-full print:max-w-none print:block">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 no-print">
              <h3 className="text-lg font-bold">Print All (Recap + Slips)</h3>
              <div className="space-x-2 flex items-center">
                <Button variant="secondary" onClick={() => setCompilePrintNote(null)}>Close</Button>
                <Button onClick={() => handlePrint(compilePrintNote.noteId)}><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>
              </div>
            </div>
            
            <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-start gap-2 no-print">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Having trouble printing?</strong>
                Because this app is running inside a secure preview frame, your browser might block the print dialog. 
                If the "Print PDF" button doesn't work, please open this app in a <strong>new tab</strong> using the button at the top right of the screen, and try printing again.
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-gray-100 flex-1 flex flex-col gap-8 flex-wrap items-center print:bg-transparent print:p-0 print:block">
              {/* PAGE 1: RECAP */}
              <div id="printable-recap-compiled" className="bg-white w-full max-w-[210mm] aspect-[21/29.7] p-8 sm:p-12 shadow-sm text-black relative print:aspect-auto print:w-[210mm] print:h-[297mm] print:max-w-none print:min-h-0 print:shadow-none print:p-0 print:block overflow-hidden mx-auto print:break-inside-avoid">
                {renderRecapHeader(compilePrintNote)}

                {/* Content */}
                <h3 className="font-bold text-gray-900 mb-3 text-sm tracking-wide">PAYMENT DESCRIPTION</h3>
                
                <table className="w-full mb-10 text-sm">
                  <thead>
                    <tr className="bg-[#001233] text-white">
                      <th className="p-3 text-left font-semibold rounded-tl-md">PAYMENT DESCRIPTION</th>
                      <th className="p-3 text-right font-semibold">COMMISSION AMOUNT</th>
                      <th className="p-3 text-right font-semibold">TAX</th>
                      <th className="p-3 w-4"></th>
                      <th className="p-3 text-right font-semibold rounded-tr-md">NETT AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getRecapDetails(compilePrintNote).length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-gray-500 py-8">No distributions found.</td></tr>
                    ) : (
                      <>
                        {getRecapDetails(compilePrintNote).map((detail, idx) => {
                          const tax = detail.slip ? detail.slip.taxAmount : 0;
                          const nett = detail.slip ? detail.slip.netCommission : detail.gross;
                          return (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="p-3 text-left uppercase text-gray-800 font-medium">{detail.recipient.role.toUpperCase()} - {detail.recipient.name.toUpperCase()}</td>
                              <td className="p-3 text-right text-gray-600">{formatIDR(detail.gross)}</td>
                              <td className="p-3 text-right text-red-500">{formatIDR(tax)}</td>
                              <td className="p-3"></td>
                              <td className="p-3 text-right text-gray-900 font-semibold">{formatIDR(nett)}</td>
                            </tr>
                          );
                        })}
                        {/* Company Share */}
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-left uppercase text-gray-800 font-medium">NETT BROKER</td>
                          <td className="p-3 text-right text-gray-600">{formatIDR(compilePrintNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0))}</td>
                          <td className="p-3 text-right text-red-500">Rp 0</td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right text-gray-900 font-bold">{formatIDR(compilePrintNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0))}</td>
                        </tr>
                        {/* Summary Footer */}
                        <tr className="bg-[#001233]/5 border-t-2 border-[#001233]">
                          <td className="p-4 text-left font-bold text-[#001233]">TOTAL</td>
                          <td className="p-4 text-right text-[#001233] font-bold text-lg">
                            {formatIDR(compilePrintNote.details.reduce((sum, d) => sum + d.distributions.reduce((s, dist) => s + dist.amount, 0), 0) + compilePrintNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0))}
                          </td>
                          <td className="p-4 text-right text-red-600 font-bold">
                            {formatIDR(getRecapDetails(compilePrintNote).reduce((sum, d) => sum + (d.slip ? d.slip.taxAmount : 0), 0))}
                          </td>
                          <td className="p-4"></td>
                          <td className="p-4 text-right text-[#001233] font-bold text-xl">
                            {formatIDR(
                              getRecapDetails(compilePrintNote).reduce((sum, d) => sum + (d.slip ? d.slip.netCommission : d.gross), 0) + 
                              compilePrintNote.details.reduce((sum, d) => sum + d.companyNetIncome, 0)
                            )}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* INDIVIDUAL SLIPS... */}
              {slips.filter(s => s.noteId === compilePrintNote.id).map(compiledSlip => {
                const rec = recipients.find(r => r.id === compiledSlip.recipientId);
                const note = compilePrintNote;
                return (
                  <div key={compiledSlip.id} className="bg-white w-full max-w-[210mm] aspect-[21/29.7] p-8 sm:p-12 shadow-sm text-black relative print:aspect-auto print:w-[210mm] print:h-[297mm] print:max-w-none print:min-h-0 print:shadow-none print:p-0 print:block overflow-hidden mx-auto print:break-before-page">
                      {/* Header without Logo */}
                      <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-black">
                        <div className="pt-1">
                          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1 text-gray-900">PT. LONG TERM VISION</h1>
                          <p className="text-sm text-gray-600">One Pacific Place, 15th Floor, Suite 1501</p>
                          <p className="text-sm text-gray-600">Jl. Jendral Sudirman Kav. 52-53, Jakarta 12190</p>
                        </div>
                        <div className="text-right">
                          <h2 className="text-2xl font-bold tracking-widest text-[#001233] mb-1">PAYMENT SLIP</h2>
                          <p className="text-sm font-semibold text-gray-600">Voucher No: {compiledSlip.slipNumber}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-12 mb-8 text-sm">
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Request For</span>
                            <span className="font-semibold">{rec?.name}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Account Name</span>
                            <span className="font-semibold">{compiledSlip.recipientNameSnapshot || rec?.name}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Transaction ID</span>
                            <span className="font-semibold">{note?.noteId}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Date</span>
                            <span className="font-semibold text-right">{formatDate(compiledSlip.date)}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Period</span>
                            <span className="font-semibold text-right">{formatPeriod(compiledSlip.period)}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Payment Date</span>
                            <span className="font-semibold text-right">{formatDate(compiledSlip.paymentDate)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t-2 border-black mb-6"></div>

                      <h3 className="font-bold text-gray-900 mb-3 text-sm tracking-wide">COMMISSION BREAKDOWN</h3>

                      {/* Table */}
                      <table className="w-full mb-10 text-sm">
                        <thead>
                          <tr className="bg-[#001233] text-white">
                            <th className="p-3 text-center font-semibold rounded-tl-md w-16">No</th>
                            <th className="p-3 text-center font-semibold">Share %</th>
                            <th className="p-3 text-right font-semibold">Gross Amount</th>
                            <th className="p-3 text-right font-semibold">Tax Deduction</th>
                            <th className="p-3 text-right font-semibold rounded-tr-md">Net Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 border-b border-gray-200">
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-center text-gray-800">1</td>
                            <td className="p-4 text-center text-gray-600 font-medium">{rec?.defaultShare}%</td>
                            <td className="p-4 text-right text-gray-600">{formatIDR(compiledSlip.totalGross)}</td>
                            <td className="p-4 text-right text-red-500">
                              {compiledSlip.taxAmount > 0 ? `${((compiledSlip.taxAmount / compiledSlip.totalGross) * 100).toFixed(2)}% ` : ''}
                              ({formatIDR(compiledSlip.taxAmount)})
                            </td>
                            <td className="p-4 text-right font-bold text-[#001233] text-lg bg-blue-50/30">{formatIDR(compiledSlip.netCommission)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Footer */}
                      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5 mb-16">
                        <p className="font-bold mb-3 text-[#001233] text-sm">Bank Transfer Details</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Account Name</span>
                            <span className="font-semibold text-right">{compiledSlip.recipientNameSnapshot || rec?.name} ({rec?.role})</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Account Number</span>
                            <span className="font-semibold text-right font-mono">{compiledSlip.accountNumberSnapshot || rec?.accountNumber || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Bank Name</span>
                            <span className="font-semibold text-right">{compiledSlip.bankNameSnapshot || rec?.bankName || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">NPWP Number</span>
                            <span className="font-semibold text-right font-mono">{compiledSlip.npwpSnapshot || rec?.npwp || '-'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Signatures */}
                      <div className="mt-auto grid grid-cols-3 gap-8 text-center text-sm pb-8">
                        <div className="flex flex-col items-center">
                          <p className="mb-20 font-medium text-gray-500">Prepared By,</p>
                          <div className="w-full max-w-[160px] border-t-2 border-black pt-2">
                            <p className="font-bold text-gray-900">Finance Dept</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="mb-20 font-medium text-gray-500">Approved By,</p>
                          <div className="w-full max-w-[160px] border-t-2 border-black pt-2">
                            <p className="font-bold text-gray-900">Director</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="mb-20 font-medium text-gray-500">Received By,</p>
                          <div className="w-full max-w-[160px] border-t-2 border-black pt-2">
                            <p className="font-bold text-gray-900">{rec?.name}</p>
                          </div>
                        </div>
                      </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm p-4 print:static print:bg-transparent print:p-0 print:block">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col print:shadow-none print:overflow-visible print:max-h-none print:w-full print:max-w-none print:block">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10 no-print">
              <h3 className="text-lg font-bold">Print Preview</h3>
              <div className="space-x-2 flex items-center">
                <Button variant="secondary" onClick={() => setPrintSlip(null)}>Close</Button>
                <Button onClick={() => handlePrint(notes.find(n => n.id === printSlip.noteId)?.noteId || printSlip.slipNumber)}><Printer className="w-4 h-4 mr-2" /> Print PDF</Button>
              </div>
            </div>
            
            <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm flex items-start gap-2 no-print">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">Having trouble printing?</strong>
                Because this app is running inside a secure preview frame, your browser might block the print dialog. 
                If the "Print PDF" button doesn't work, please open this app in a <strong>new tab</strong> using the button at the top right of the screen, and try printing again.
              </div>
            </div>

            <div className="p-4 sm:p-8 bg-gray-100 flex-1 flex justify-center print:bg-transparent print:p-0 print:block">
              {/* The actual printable area */}
              <div id="printable-slip" className="bg-white w-full max-w-[210mm] aspect-[21/29.7] p-8 sm:p-12 shadow-sm text-black relative print:aspect-auto print:w-[210mm] print:h-[297mm] print:max-w-none print:min-h-0 print:shadow-none print:p-0 print:block overflow-hidden mx-auto">
                {(() => {
                  const rec = recipients.find(r => r.id === printSlip.recipientId);
                  const note = notes.find(n => n.id === printSlip.noteId);
                  return (
                    <>
                      {/* Header without Logo */}
                      <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-black">
                        <div className="pt-1">
                          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1 text-gray-900">PT. LONG TERM VISION</h1>
                          <p className="text-sm text-gray-600">One Pacific Place, 15th Floor, Suite 1501</p>
                          <p className="text-sm text-gray-600">Jl. Jendral Sudirman Kav. 52-53, Jakarta 12190</p>
                        </div>
                        <div className="text-right">
                          <h2 className="text-2xl font-bold tracking-widest text-[#001233] mb-1">PAYMENT SLIP</h2>
                          <p className="text-sm font-semibold text-gray-600">Voucher No: {printSlip.slipNumber}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-12 mb-8 text-sm">
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Request For</span>
                            <span className="font-semibold">{rec?.name}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Account Name</span>
                            <span className="font-semibold">{printSlip.recipientNameSnapshot || rec?.name}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Transaction ID</span>
                            <span className="font-semibold">{note?.noteId}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Date</span>
                            <span className="font-semibold text-right">{formatDate(printSlip.date)}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Period</span>
                            <span className="font-semibold text-right">{formatPeriod(printSlip.period)}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                            <span className="text-gray-500">Payment Date</span>
                            <span className="font-semibold text-right">{formatDate(printSlip.paymentDate)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t-2 border-black mb-6"></div>

                      <h3 className="font-bold text-gray-900 mb-3 text-sm tracking-wide">COMMISSION BREAKDOWN</h3>

                      {/* Table */}
                      <table className="w-full mb-10 text-sm">
                        <thead>
                          <tr className="bg-[#001233] text-white">
                            <th className="p-3 text-center font-semibold rounded-tl-md w-16">No</th>
                            <th className="p-3 text-center font-semibold">Share %</th>
                            <th className="p-3 text-right font-semibold">Gross Amount</th>
                            <th className="p-3 text-right font-semibold">Tax Deduction</th>
                            <th className="p-3 text-right font-semibold rounded-tr-md">Net Commission</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 border-b border-gray-200">
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-center text-gray-800">1</td>
                            <td className="p-4 text-center text-gray-600 font-medium">{rec?.defaultShare}%</td>
                            <td className="p-4 text-right text-gray-600">{formatIDR(printSlip.totalGross)}</td>
                            <td className="p-4 text-right text-red-500">
                              {printSlip.taxAmount > 0 ? `${((printSlip.taxAmount / printSlip.totalGross) * 100).toFixed(2)}% ` : ''}
                              ({formatIDR(printSlip.taxAmount)})
                            </td>
                            <td className="p-4 text-right font-bold text-[#001233] text-lg bg-blue-50/30">{formatIDR(printSlip.netCommission)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Footer */}
                      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5 mb-16">
                        <p className="font-bold mb-3 text-[#001233] text-sm">Bank Transfer Details</p>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Account Name</span>
                            <span className="font-semibold text-right">{printSlip.recipientNameSnapshot || rec?.name} ({rec?.role})</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Account Number</span>
                            <span className="font-semibold text-right font-mono">{printSlip.accountNumberSnapshot || rec?.accountNumber || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">Bank Name</span>
                            <span className="font-semibold text-right">{printSlip.bankNameSnapshot || rec?.bankName || '-'}</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                            <span className="text-gray-500">NPWP Number</span>
                            <span className="font-semibold text-right font-mono">{printSlip.npwpSnapshot || rec?.npwp || '-'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Signatures */}
                      <div className="mt-auto grid grid-cols-3 gap-8 text-center text-sm pb-8">
                        <div className="flex flex-col items-center">
                          <p className="mb-20 font-medium text-gray-500">Prepared By,</p>
                          <div className="w-full max-w-[160px] border-t-2 border-black pt-2">
                            <p className="font-bold text-gray-900">Finance Dept</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="mb-20 font-medium text-gray-500">Approved By,</p>
                          <div className="w-full max-w-[160px] border-t-2 border-black pt-2">
                            <p className="font-bold text-gray-900">Director</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="mb-20 font-medium text-gray-500">Received By,</p>
                          <div className="w-full max-w-[160px] border-t-2 border-black pt-2">
                            <p className="font-bold text-gray-900">{rec?.name}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
