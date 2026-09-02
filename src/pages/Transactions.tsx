import { useState, useEffect, ChangeEvent } from 'react';
import { db, Client, Insurance, Recipient, CommissionNote, CommissionDetail, CommissionDistribution, PaymentSlip } from '../store/db';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Select, Table, Th, Td, Modal } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';
import { AlertCircle, Plus, Trash2, Save, CheckCircle, XCircle, Clock, Eye, Edit, Receipt, Download, Upload, ExternalLink, Filter, RotateCcw, Search, X } from 'lucide-react';
import { formatIDR } from '../lib/utils';

export default function Transactions() {
  const [view, setView] = useState<'list' | 'new' | 'edit' | 'view'>('list');
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [notes, setNotes] = useState<CommissionNote[]>([]);
  const [slips, setSlips] = useState<PaymentSlip[]>([]);

  useEffect(() => {
    const u1 = db.subscribeClients(setClients);
    const u2 = db.subscribeInsurance(setInsurance);
    const u3 = db.subscribeRecipients(setRecipients);
    const u4 = db.subscribeNotes(setNotes);
    const u5 = db.subscribePaymentSlips(setSlips);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const [receiptConfirmId, setReceiptConfirmId] = useState<string | null>(null);
  const [receiptDateInput, setReceiptDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFileInput, setReceiptFileInput] = useState<string | null>(null);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);
  const [viewSlip, setViewSlip] = useState<PaymentSlip | null>(null);

  // Filter States
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterInsurance, setFilterInsurance] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterTransactionStatus, setFilterTransactionStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Import State
  const [showImportSummary, setShowImportSummary] = useState(false);
  const [importState, setImportState] = useState({
    isProcessing: false,
    progress: 0,
    statusText: '',
    total: 0,
    success: 0,
    failed: 0,
    errors: [] as { row: number, reason: string }[]
  });

  // CSV Parsing Helper
  const parseCSVRow = (str: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result.map(s => s.replace(/^"|"$/g, '').trim());
  };

  const downloadTemplate = () => {
    const headers = ['Note ID', 'Date (YYYY-MM-DD)', 'Client Name', 'Insurance Name', 'Gross Premium', 'Internal Sharing %', 'VAT %', 'WHT %'];
    const sampleRow = ['TRX-HIST-001', '2023-10-01', 'PT. Sample Client', 'Sample Insurance', '15000000', '3.5', '11', '2'];
    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transaction_import_template.csv';
    a.click();
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSV(text);
    };
    reader.readAsText(file);
    // Reset input so the same file can be uploaded again if needed
    e.target.value = '';
  };

  const processCSV = async (csv: string) => {
    setImportState({ isProcessing: true, progress: 0, statusText: 'Parsing CSV...', total: 0, success: 0, failed: 0, errors: [] });

    const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) {
      setImportState(prev => ({ ...prev, isProcessing: false }));
      alert('Import Failed: File is empty or missing data rows.');
      return;
    }

    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
    const requiredHeaders = ['note id', 'date (yyyy-mm-dd)', 'client name', 'insurance name', 'gross premium', 'internal sharing %', 'vat %', 'wht %'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      setImportState(prev => ({ ...prev, isProcessing: false }));
      alert(`Import Failed: Missing columns [${missingHeaders.join(', ')}]`);
      return;
    }

    const headerIndex = requiredHeaders.reduce((acc, h) => {
      acc[h] = headers.indexOf(h);
      return acc;
    }, {} as Record<string, number>);

    const errors: { row: number, reason: string }[] = [];
    const successNotes = new Map<string, CommissionNote>();
    let successCount = 0;
    let failedCount = 0;

    // Process in chunks to allow UI to update
    const chunkSize = 50;
    for (let i = 1; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);

      for (let j = 0; j < chunk.length; j++) {
        const rowNum = i + j + 1;
        const row = parseCSVRow(chunk[j]);

        // Validation
        const policyNumber = row[headerIndex['note id']];
        const receiptDate = row[headerIndex['date (yyyy-mm-dd)']];
        const clientName = row[headerIndex['client name']];
        const insuranceName = row[headerIndex['insurance name']];
        const grossPremiumStr = row[headerIndex['gross premium']];
        const sharingStr = row[headerIndex['internal sharing %']];
        const vatStr = row[headerIndex['vat %']];
        const whtStr = row[headerIndex['wht %']];

        const rowErrors = [];

        if (!policyNumber) rowErrors.push("Note ID is empty");

        const client = clients.find(c => c.name.toLowerCase() === clientName?.toLowerCase());
        if (!client) rowErrors.push(`Client '${clientName}' not found`);

        const ins = insurance.find(ins => ins.name.toLowerCase() === insuranceName?.toLowerCase());
        if (!ins) rowErrors.push(`Insurance '${insuranceName}' not found`);

        const grossPremium = parseFloat(grossPremiumStr?.replace(/[^0-9.-]+/g, ""));
        if (isNaN(grossPremium)) rowErrors.push(`Gross Premium '${grossPremiumStr}' is not a valid number`);

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (receiptDate && !dateRegex.test(receiptDate)) rowErrors.push(`Date '${receiptDate}' must be YYYY-MM-DD`);

        // Duplicate check (against existing notes and currently processing notes)
        if (notes.some(n => n.noteId === policyNumber) || successNotes.has(policyNumber)) {
          rowErrors.push(`Note ID '${policyNumber}' already exists`);
        }

        if (rowErrors.length > 0) {
          errors.push({ row: rowNum, reason: rowErrors.join(' | ') });
          failedCount++;
          continue;
        }

        // Calculation
        const internalSharing = parseFloat(sharingStr) || 3.5;
        const vat = parseFloat(vatStr) || 2.2; // Default to 2.2 if empty/invalid
        const wht = parseFloat(whtStr) || 2; // Default to 2 if empty/invalid

        const stopLossPercent = ins!.defaultStopLoss || 0;
        const stopLossAmount = grossPremium * (stopLossPercent / 100);
        const incomeAfterStopLoss = grossPremium - stopLossAmount;

        const calcNet = grossPremium * (internalSharing / 100);
        const vatAmount = calcNet * (vat / 100);
        const whtAmount = calcNet * (wht / 100);
        const nettBrokerage = calcNet - vatAmount - whtAmount;

        const distributions: CommissionDistribution[] = recipients.map(r => ({
          recipientId: r.id,
          role: r.role,
          sharePercent: r.defaultShare,
          amount: nettBrokerage * (r.defaultShare / 100)
        }));

        const totalDistributed = distributions.reduce((sum, dist) => sum + dist.amount, 0);
        const companyNetIncome = nettBrokerage - totalDistributed;

        const detail: CommissionDetail = {
          id: uuidv4(),
          clientId: client!.id,
          insuranceId: ins!.id,
          grossPremium,
          internalSharing,
          vat,
          wht,
          stopLossPercent,
          stopLossAmount,
          incomeAfterStopLoss,
          calculatedNetCommission: calcNet,
          nettBrokerage,
          distributions,
          companyNetIncome
        };

        successNotes.set(policyNumber, {
          id: uuidv4(),
          noteId: policyNumber,
          date: receiptDate || new Date().toISOString().split('T')[0],
          totalNetCommission: calcNet,
          status: receiptDate ? 'Commission Received' : 'Draft',
          details: [detail]
        });
        successCount++;
      }

      setImportState(prev => ({
        ...prev,
        progress: Math.round(((i + chunkSize) / lines.length) * 100),
        statusText: `Processing row ${Math.min(i + chunkSize, lines.length)} of ${lines.length}...`
      }));

      // Yield to event loop to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (successNotes.size > 0) {
      const finalNotes = [...Array.from(successNotes.values()), ...notes];
      db.saveNotes(finalNotes);
      setNotes(finalNotes);
    }

    setImportState(prev => ({
      ...prev,
      isProcessing: false,
      total: lines.length - 1,
      success: successCount,
      failed: failedCount,
      errors
    }));
    setShowImportSummary(true);
  };

  // Form State
  const [noteId, setNoteId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalNetCommission, setTotalNetCommission] = useState<number>(0);
  
  // Detail State
  const [details, setDetails] = useState<Partial<CommissionDetail>[]>([]);
  
  // Validation Modal State
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTotalNetChange = (val: number) => {
    setTotalNetCommission(val);
    const gp = val / 0.035;
    if (details.length === 0) {
      setDetails([{
        id: uuidv4(),
        clientId: clients[0]?.id || '',
        insuranceId: insurance[0]?.id || '',
        grossPremium: gp,
        internalSharing: 3.5,
        vat: 2.2,
        wht: 2,
      }]);
    } else {
      setDetails(details.map((d, i) => i === 0 ? { ...d, grossPremium: gp, internalSharing: 3.5 } : d));
    }
  };

  const addDetailRow = () => {
    setDetails([...details, {
      id: uuidv4(),
      clientId: clients[0]?.id || '',
      insuranceId: insurance[0]?.id || '',
      grossPremium: 0,
      internalSharing: 0,
      vat: 2.2,
      wht: 2,
    }]);
  };

  const updateDetail = (id: string, field: keyof CommissionDetail, value: any) => {
    setDetails(details.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const removeDetail = (id: string) => {
    setDetails(details.filter(d => d.id !== id));
  };

  // Calculations
  const calculatedDetails = details.map(d => {
    const selectedInsurance = insurance.find(i => i.id === d.insuranceId);
    const stopLossPercent = selectedInsurance?.defaultStopLoss || 0;
    const stopLossAmount = (d.grossPremium || 0) * (stopLossPercent / 100);
    const incomeAfterStopLoss = (d.grossPremium || 0) - stopLossAmount;

    const calcNet = (d.grossPremium || 0) * ((d.internalSharing || 0) / 100);
    const vatAmount = calcNet * ((d.vat || 0) / 100);
    const whtAmount = calcNet * ((d.wht || 0) / 100);
    const nettBrokerage = calcNet - vatAmount - whtAmount;

    // Distributions
    const distributions: CommissionDistribution[] = recipients.map(r => ({
      recipientId: r.id,
      role: r.role,
      sharePercent: r.defaultShare,
      amount: nettBrokerage * (r.defaultShare / 100)
    }));

    const totalDistributed = distributions.reduce((sum, dist) => sum + dist.amount, 0);
    const companyNetIncome = nettBrokerage - totalDistributed;

    return {
      ...d,
      stopLossPercent,
      stopLossAmount,
      incomeAfterStopLoss,
      calculatedNetCommission: calcNet,
      nettBrokerage,
      distributions,
      companyNetIncome
    } as CommissionDetail;
  });

  const totalCalculatedNet = calculatedDetails.reduce((sum, d) => sum + d.calculatedNetCommission, 0);
  const isMismatch = totalCalculatedNet !== totalNetCommission;

  const handleSave = () => {
    if (!noteId.trim()) {
      setValidationError('Please fill in the Note ID.');
      return;
    }
    
    // Duplicate Note ID check
    if (notes.some(n => n.noteId.toLowerCase() === noteId.trim().toLowerCase() && n.id !== currentNoteId)) {
      setValidationError(`Note ID '${noteId}' already exists. Please use a different ID.`);
      return;
    }

    if (details.length === 0) {
      setValidationError('Please add at least one commission detail.');
      return;
    }
    
    // Check if any detail is missing client or insurance
    const missingFields = details.some(d => !d.clientId || !d.insuranceId);
    if (missingFields) {
      setValidationError('Please select a Client and Insurance for all details.');
      return;
    }

    const newNote: CommissionNote = {
      id: currentNoteId || uuidv4(),
      noteId,
      date,
      totalNetCommission,
      status: currentNoteId ? (notes.find(n => n.id === currentNoteId)?.status || 'Draft') : 'Draft',
      details: calculatedDetails
    };

    let updatedNotes;
    if (currentNoteId) {
      updatedNotes = notes.map(n => n.id === currentNoteId ? newNote : n);
    } else {
      updatedNotes = [newNote, ...notes];
    }
    setNotes(updatedNotes);
    db.saveNotes(updatedNotes);
    
    resetForm();
  };

  const handleApprove = (id: string) => {
    const updatedNotes = notes.map(n => n.id === id ? { ...n, status: 'Approved' as const } : n);
    setNotes(updatedNotes);
    db.saveNotes(updatedNotes);
  };

  const handleReject = (id: string) => {
    const updatedNotes = notes.map(n => n.id === id ? { ...n, status: 'Rejected' as const } : n);
    setNotes(updatedNotes);
    db.saveNotes(updatedNotes);
  };

  const generateNextNoteId = () => {
    const yearStr = new Date().getFullYear().toString().slice(-2);
    const prefix = `VOC-${yearStr}-`;
    let max = 0;
    notes.forEach(n => {
      if (n.noteId.startsWith(prefix)) {
        const numStr = n.noteId.substring(prefix.length);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    return `${prefix}${(max + 1).toString().padStart(5, '0')}`;
  };

  const handleNewTransaction = () => {
    resetForm();
    setNoteId(generateNextNoteId());
    setView('new');
  };

  const resetForm = () => {
    setNoteId('');
    setDate(new Date().toISOString().split('T')[0]);
    setTotalNetCommission(0);
    setDetails([]);
    setCurrentNoteId(null);
    setView('list');
  };

  const handleView = (note: CommissionNote) => {
    setNoteId(note.noteId);
    setDate(note.date);
    setTotalNetCommission(note.totalNetCommission);
    setDetails(note.details);
    setCurrentNoteId(note.id);
    setView('view');
  };

  const handleEdit = (note: CommissionNote) => {
    setNoteId(note.noteId);
    setDate(note.date);
    setTotalNetCommission(note.totalNetCommission);
    setDetails(note.details);
    setCurrentNoteId(note.id);
    setView('edit');
  };

  const handleDelete = () => {
    if (deleteConfirmId) {
      const updatedNotes = notes.filter(n => n.id !== deleteConfirmId);
      setNotes(updatedNotes);
      db.saveNotes(updatedNotes);
      setDeleteConfirmId(null);
    }
  };

  const handleConfirmReceipt = () => {
    if (receiptConfirmId && receiptDateInput) {
      const updatedNotes = notes.map(n => n.id === receiptConfirmId ? { ...n, status: 'Commission Received' as const, receiptDate: receiptDateInput, receiptFileUrl: receiptFileInput || undefined } : n);
      setNotes(updatedNotes);
      db.saveNotes(updatedNotes);
      setReceiptConfirmId(null);
      setReceiptFileInput(null);
    }
  };

  // Helper to get Client Names for a Note
  const getNoteClients = (note: CommissionNote) => {
    const clientIds = Array.from(new Set(note.details.map(d => d.clientId)));
    return clientIds.map(id => clients.find(c => c.id === id)?.name).filter(Boolean).join(', ');
  };

  // Helper to get Insurance Names for a Note
  const getNoteInsurances = (note: CommissionNote) => {
    const insuranceIds = Array.from(new Set(note.details.map(d => d.insuranceId)));
    return insuranceIds.map(id => insurance.find(i => i.id === id)?.name).filter(Boolean).join(', ');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Commission Received': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"><CheckCircle className="w-3 h-3 mr-1"/> Commission Received</span>;
      case 'Approved': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Approved</span>;
      case 'Rejected': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Rejected</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/> Draft</span>;
    }
  };

  const getPaymentStatusInfo = (note: CommissionNote) => {
    const noteSlips = slips.filter(s => s.noteId === note.id);
    const uniqueRecipientsInNote = new Set<string>();
    note.details.forEach(d => d.distributions.forEach(dist => uniqueRecipientsInNote.add(dist.recipientId)));
    
    const total = uniqueRecipientsInNote.size;
    const paid = noteSlips.length;

    if (total === 0) return { status: 'No Payments', text: 'No Recipients' };
    if (paid === 0) return { status: 'No Payments', text: `No Payments (${paid}/${total} paid)` };
    if (paid >= total) return { status: 'Fully Paid', text: `Fully Paid (${paid}/${total} paid)` };
    return { status: 'Partially Paid', text: `Partially Paid (${paid}/${total} paid)` };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const hasActiveFilters = Boolean(
    filterStartDate ||
    filterEndDate ||
    filterClient ||
    filterInsurance ||
    filterPaymentStatus ||
    filterTransactionStatus ||
    filterSearch
  );

  const resetFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterClient('');
    setFilterInsurance('');
    setFilterPaymentStatus('');
    setFilterTransactionStatus('');
    setFilterSearch('');
  };

  const filteredNotes = notes.filter(note => {
    if (filterStartDate && note.date < filterStartDate) return false;
    if (filterEndDate && note.date > filterEndDate) return false;
    if (filterClient && !note.details.some(d => d.clientId === filterClient)) return false;
    if (filterInsurance && !note.details.some(d => d.insuranceId === filterInsurance)) return false;
    if (filterPaymentStatus && getPaymentStatusInfo(note).status !== filterPaymentStatus) return false;
    if (filterTransactionStatus && note.status !== filterTransactionStatus) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      const matchId = note.noteId.toLowerCase().includes(q);
      const matchClient = getNoteClients(note).toLowerCase().includes(q);
      const matchInsurance = getNoteInsurances(note).toLowerCase().includes(q);
      if (!matchId && !matchClient && !matchInsurance) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Import Progress Overlay */}
      {importState.isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Importing Transactions...</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${importState.progress}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 text-center">{importState.statusText}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Summary Modal */}
      <Modal isOpen={showImportSummary} onClose={() => setShowImportSummary(false)} title="Migration Summary">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 font-medium">Total Processed</p>
              <p className="text-2xl font-bold text-gray-900">{importState.total}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">Successful</p>
              <p className="text-2xl font-bold text-green-700">{importState.success}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-sm text-red-600 font-medium">Failed</p>
              <p className="text-2xl font-bold text-red-700">{importState.failed}</p>
            </div>
          </div>

          {importState.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Error Log</h3>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <Table>
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <Th className="w-24">Row</Th>
                      <Th>Error Reason</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {importState.errors.map((err, idx) => (
                      <tr key={idx}>
                        <Td className="font-medium text-gray-900">{err.row}</Td>
                        <Td className="text-red-600 text-sm">{err.reason}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <p className="text-xs text-gray-500 mt-2">Please fix these rows in your CSV and re-upload. Successful rows have already been saved.</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setShowImportSummary(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {view === 'list' ? 'Transactions' : view === 'new' ? 'New Transaction' : view === 'edit' ? 'Edit Transaction' : 'View Transaction'}
        </h1>
        {view === 'list' ? (
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={downloadTemplate}><Download className="w-4 h-4 mr-2" /> Template</Button>
            <input type="file" accept=".csv" className="hidden" id="csv-upload" onChange={handleImport} />
            <Button variant="secondary" onClick={() => document.getElementById('csv-upload')?.click()}><Upload className="w-4 h-4 mr-2" /> Import CSV</Button>
            <Button onClick={handleNewTransaction}><Plus className="w-4 h-4 mr-2" /> New Transaction</Button>
          </div>
        ) : (
          <div className="flex space-x-2">
            {currentNoteId && notes.find(n => n.id === currentNoteId)?.status === 'Draft' && (
              <>
                <Button variant="secondary" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApprove(currentNoteId)}>Approve</Button>
                <Button variant="secondary" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(currentNoteId)}>Reject</Button>
              </>
            )}
            {currentNoteId && notes.find(n => n.id === currentNoteId)?.status === 'Approved' && (
              <Button variant="secondary" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setReceiptConfirmId(currentNoteId); setReceiptDateInput(new Date().toISOString().split('T')[0]); }}>Confirm Receipt</Button>
            )}
            <Button variant="secondary" onClick={resetForm}>Back to List</Button>
          </div>
        )}
      </div>

      {view === 'list' ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="border-gray-200 shadow-sm bg-white">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span>Filter Transactions</span>
                  {hasActiveFilters && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                      Active
                    </span>
                  )}
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors py-1 px-2.5 rounded-lg hover:bg-gray-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* 1. Date: From Date */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">From Date</Label>
                  <Input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="h-9 text-xs sm:text-sm"
                  />
                </div>

                {/* Date: To Date */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">To Date</Label>
                  <Input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="h-9 text-xs sm:text-sm"
                  />
                </div>

                {/* 2. Client */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">Client</Label>
                  <Select
                    value={filterClient}
                    onChange={e => setFilterClient(e.target.value)}
                    className="h-9 text-xs sm:text-sm"
                  >
                    <option value="">All Clients</option>
                    {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>

                {/* 3. Insurance */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">Insurance</Label>
                  <Select
                    value={filterInsurance}
                    onChange={e => setFilterInsurance(e.target.value)}
                    className="h-9 text-xs sm:text-sm"
                  >
                    <option value="">All Insurances</option>
                    {[...insurance].sort((a, b) => a.name.localeCompare(b.name)).map(i => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </Select>
                </div>

                {/* 4. Payment Status */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">Payment Status</Label>
                  <Select
                    value={filterPaymentStatus}
                    onChange={e => setFilterPaymentStatus(e.target.value)}
                    className="h-9 text-xs sm:text-sm"
                  >
                    <option value="">All Payment Statuses</option>
                    <option value="Fully Paid">Fully Paid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="No Payments">No Payments</option>
                  </Select>
                </div>
              </div>

              {/* Secondary Row: Search & Approval Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">Search Keyword / Note ID</Label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Search by Note ID, client, insurance..."
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                      className="h-9 pl-9 pr-8 text-xs sm:text-sm"
                    />
                    {filterSearch && (
                      <button
                        onClick={() => setFilterSearch('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1 font-medium">Approval Status</Label>
                  <Select
                    value={filterTransactionStatus}
                    onChange={e => setFilterTransactionStatus(e.target.value)}
                    className="h-9 text-xs sm:text-sm"
                  >
                    <option value="">All Approval Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Approved">Approved</option>
                    <option value="Commission Received">Commission Received</option>
                    <option value="Rejected">Rejected</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle>Transaction List</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  Showing {filteredNotes.length} of {notes.length} transactions
                  {hasActiveFilters && <span className="text-blue-600 font-semibold ml-1">(Filtered)</span>}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Note ID</Th>
                    <Th>Client(s)</Th>
                    <Th>Insurance(s)</Th>
                    <Th className="text-right">Total Net Commission</Th>
                    <Th>Status</Th>
                    <Th>Payment Status</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotes.length === 0 ? (
                    <tr>
                      <Td colSpan={8} className="text-center text-gray-500 py-12">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <AlertCircle className="w-8 h-8 text-gray-300" />
                          <p className="font-medium text-gray-700">No transactions found</p>
                          <p className="text-xs text-gray-400">
                            {hasActiveFilters
                              ? 'No transactions match the selected filters.'
                              : 'No transactions recorded yet.'}
                          </p>
                          {hasActiveFilters && (
                            <Button size="sm" variant="secondary" onClick={resetFilters} className="mt-2 text-xs">
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset All Filters
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ) : (
                    filteredNotes.map(note => {
                      const paymentInfo = getPaymentStatusInfo(note);
                      return (
                      <tr key={note.id} className="hover:bg-gray-50">
                        <Td>{formatDate(note.date)}</Td>
                        <Td className="font-medium">{note.noteId}</Td>
                        <Td>{getNoteClients(note)}</Td>
                        <Td>{getNoteInsurances(note)}</Td>
                        <Td className="text-right">{formatIDR(note.totalNetCommission)}</Td>
                        <Td>{getStatusBadge(note.status)}</Td>
                        <Td>
                          {paymentInfo.status === 'Fully Paid' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> {paymentInfo.text}</span>}
                          {paymentInfo.status === 'Partially Paid' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1"/> {paymentInfo.text}</span>}
                          {paymentInfo.status === 'No Payments' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1"/> {paymentInfo.text}</span>}
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end items-center space-x-2">
                            <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 px-2" onClick={() => handleView(note)} title="View"><Eye className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-orange-600 hover:bg-orange-50 px-2" onClick={() => handleEdit(note)} title="Edit"><Edit className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 px-2" onClick={() => setDeleteConfirmId(note.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                            {note.status === 'Draft' && (
                              <>
                                <Button size="sm" variant="secondary" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApprove(note.id)}>Approve</Button>
                                <Button size="sm" variant="secondary" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(note.id)}>Reject</Button>
                              </>
                            )}
                            {note.status === 'Approved' && (
                              <Button size="sm" variant="secondary" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setReceiptConfirmId(note.id); setReceiptDateInput(new Date().toISOString().split('T')[0]); }}>Confirm Receipt</Button>
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
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Commission Note (Header)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label>Note ID</Label>
                <Input value={noteId} onChange={e => setNoteId(e.target.value)} placeholder="e.g. CN-2023-002" disabled={view === 'view'} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={view === 'view'} />
              </div>
              <div>
                <Label>Total Net Commission (Document)</Label>
                <Input type="number" value={totalNetCommission} onChange={e => handleTotalNetChange(parseFloat(e.target.value) || 0)} disabled={view === 'view'} />
                <p className="text-xs text-gray-500 mt-1">{formatIDR(totalNetCommission)}</p>
              </div>
              {currentNoteId && notes.find(n => n.id === currentNoteId)?.status === 'Commission Received' && (
                <>
                  <div>
                    <Label className="text-purple-700">Receipt Date</Label>
                    <p className="font-medium mt-1 text-purple-900 border border-purple-100 bg-purple-50 p-2 rounded-md">{notes.find(n => n.id === currentNoteId)?.receiptDate}</p>
                  </div>
                  {notes.find(n => n.id === currentNoteId)?.receiptFileUrl && (
                    <div>
                      <Label className="text-purple-700">Receipt Document</Label>
                      <div className="mt-1 border border-purple-100 bg-purple-50 p-2 rounded-md">
                        <button type="button" onClick={() => setViewReceiptUrl(notes.find(n => n.id === currentNoteId)?.receiptFileUrl!)} className="text-purple-700 hover:text-purple-900 font-medium hover:underline inline-flex items-center">
                          <ExternalLink className="w-4 h-4 mr-2" /> View File
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Commission Details</CardTitle>
              {view !== 'view' && (
                <Button onClick={addDetailRow} size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2" /> Add Detail</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {details.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No details added. Click "Add Detail" to start.</div>
              ) : (
                <div className="space-y-8">
                  {calculatedDetails.map((detail, index) => (
                    <div key={detail.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <h4 className="font-semibold text-gray-700">Detail #{index + 1}</h4>
                        {view !== 'view' && (
                          <Button variant="ghost" size="sm" onClick={() => removeDetail(detail.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label>Client</Label>
                          <Select value={detail.clientId} onChange={e => updateDetail(detail.id, 'clientId', e.target.value)} disabled={view === 'view'}>
                            <option value="">Select Client...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>Insurance</Label>
                          <Select value={detail.insuranceId} onChange={e => updateDetail(detail.id, 'insuranceId', e.target.value)} disabled={view === 'view'}>
                            <option value="">Select Insurance...</option>
                            {insurance.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>Gross Premium</Label>
                          <Input type="number" value={detail.grossPremium} onChange={e => updateDetail(detail.id, 'grossPremium', parseFloat(e.target.value) || 0)} disabled={view === 'view'} />
                          <p className="text-xs text-gray-500 mt-1">{formatIDR(detail.grossPremium || 0)}</p>
                        </div>
                        <div>
                          <Label>Internal Sharing (%)</Label>
                          <Input type="number" value={detail.internalSharing} onChange={e => updateDetail(detail.id, 'internalSharing', parseFloat(e.target.value) || 0)} disabled={view === 'view'} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                        <div>
                          <Label>VAT (%)</Label>
                          <Input type="number" value={detail.vat} onChange={e => updateDetail(detail.id, 'vat', parseFloat(e.target.value) || 0)} disabled={view === 'view'} />
                        </div>
                        <div>
                          <Label>WHT (%)</Label>
                          <Input type="number" value={detail.wht} onChange={e => updateDetail(detail.id, 'wht', parseFloat(e.target.value) || 0)} disabled={view === 'view'} />
                        </div>
                      </div>

                      <div className="md:col-span-4 bg-blue-50 p-4 rounded-md border border-blue-100 grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-blue-600 font-semibold uppercase">Stop Loss ({detail.stopLossPercent}%)</p>
                          <p className="text-lg font-bold text-blue-900">{formatIDR(detail.stopLossAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600 font-semibold uppercase">Income After Stop Loss</p>
                          <p className="text-lg font-bold text-blue-900">{formatIDR(detail.incomeAfterStopLoss)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600 font-semibold uppercase">Calculated Net</p>
                          <p className="text-lg font-bold text-blue-900">{formatIDR(detail.calculatedNetCommission)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-600 font-semibold uppercase">Nett Brokerage (After Tax)</p>
                          <p className="text-lg font-bold text-blue-900">{formatIDR(detail.nettBrokerage)}</p>
                        </div>
                      </div>

                      {/* Distribution Preview */}
                      <div className="pt-4">
                        <Label className="mb-2">Profit Distribution Preview</Label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {detail.distributions.map(dist => (
                            <div key={dist.recipientId} className="bg-white p-2 border border-gray-200 rounded text-center">
                              <p className="text-xs text-gray-500">{dist.role} ({dist.sharePercent}%)</p>
                              <p className="font-semibold text-gray-900">{formatIDR(dist.amount)}</p>
                            </div>
                          ))}
                          <div className="bg-green-50 p-2 border border-green-200 rounded text-center">
                            <p className="text-xs text-green-700 font-semibold">Company Net</p>
                            <p className="font-bold text-green-900">{formatIDR(detail.companyNetIncome)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>


          {/* Payment Slip Information Section */}
          {details.length > 0 && view === 'view' && currentNoteId && ['Approved', 'Commission Received'].includes(notes.find(n => n.id === currentNoteId)?.status || '') && (
            <Card className="mt-6 border-blue-200 shadow-sm">
              <CardHeader className="bg-blue-50 border-b border-blue-100 p-4">
                <CardTitle className="text-blue-900 flex items-center text-base font-semibold">
                  <Receipt className="w-5 h-5 mr-2" />
                  Payment Slip Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {(() => {
                   const noteSlips = slips.filter(s => s.noteId === currentNoteId);
                   if (noteSlips.length === 0) {
                     return <p className="text-sm text-gray-500 italic">No payment slips generated yet.</p>;
                   }
                   return (
                     <div className="space-y-3">
                       {noteSlips.map(slip => {
                         const recipientName = slip.recipientNameSnapshot || recipients.find(r => r.id === slip.recipientId)?.name || 'Unknown';
                         return (
                           <div key={slip.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-white">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{recipientName}</p>
                                <p className="text-xs text-gray-500">Slip No: {slip.slipNumber} | Amount: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(slip.netCommission)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${slip.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {slip.status}
                                </span>
                                <Button size="sm" variant="secondary" onClick={() => setViewSlip(slip)}>
                                  <Eye className="w-4 h-4 mr-2" /> View Slip
                                </Button>
                              </div>
                           </div>
                         )
                       })}
                     </div>
                   );
                })()}
              </CardContent>
            </Card>
          )}

          {details.length > 0 && view !== 'view' && (
            <Card className={isMismatch ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {isMismatch ? (
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold">✓</div>
                  )}
                  <div>
                    <h4 className={`font-semibold ${isMismatch ? 'text-red-900' : 'text-green-900'}`}>
                      Validation Check
                    </h4>
                    <p className={`text-sm ${isMismatch ? 'text-red-700' : 'text-green-700'}`}>
                      Document Total: {formatIDR(totalNetCommission)} | Calculated Total: {formatIDR(totalCalculatedNet)}
                    </p>
                    {isMismatch && (
                      <p className="text-xs text-red-600 mt-1 font-medium">Warning: Calculated net commission differs from the document total.</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleSave} className={isMismatch ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}>
                  <Save className="w-4 h-4 mr-2" /> Save Transaction
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      <Modal 
        isOpen={!!validationError} 
        onClose={() => setValidationError(null)} 
        title="Validation Error"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-gray-700">{validationError}</p>
          <Button className="w-full mt-4" onClick={() => setValidationError(null)}>
            Acknowledge
          </Button>
        </div>
      </Modal>
      <Modal 
        isOpen={!!deleteConfirmId} 
        onClose={() => setDeleteConfirmId(null)} 
        title="Confirm Delete"
      >
        <div className="flex flex-col space-y-4">
          <p className="text-gray-700">Are you sure you want to delete this transaction? This action cannot be undone.</p>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
      <Modal 
        isOpen={!!receiptConfirmId} 
        onClose={() => { setReceiptConfirmId(null); setReceiptFileInput(null); }} 
        title="Confirm Receipt"
      >
        <div className="flex flex-col space-y-4">
          <p className="text-gray-700">Please enter the date the commission was received from the insurance company.</p>
          <div>
            <Label>Receipt Date</Label>
            <Input type="date" value={receiptDateInput} onChange={e => setReceiptDateInput(e.target.value)} />
          </div>
          <div>
            <Label>Receipt File (Optional)</Label>
            <Input 
              type="file" 
              accept="image/*,.pdf"
              className="mt-1"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setReceiptFileInput(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                } else {
                  setReceiptFileInput(null);
                }
              }} 
            />
            {receiptFileInput && (
              <p className="text-xs text-green-600 mt-1 font-medium flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> File attached</p>
            )}
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="secondary" onClick={() => { setReceiptConfirmId(null); setReceiptFileInput(null); }}>Cancel</Button>
            <Button onClick={handleConfirmReceipt}>Confirm Receipt</Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={!!viewReceiptUrl}
        onClose={() => setViewReceiptUrl(null)}
        title="View Receipt"
      >
        <div className="flex flex-col space-y-4">
          <div className="flex justify-center border border-gray-200 p-2 rounded-md bg-gray-50 max-h-[80vh] overflow-auto">
            {viewReceiptUrl && viewReceiptUrl.startsWith('data:application/pdf') ? (
              <iframe src={viewReceiptUrl} className="w-full h-[600px]" title="Receipt" />
            ) : viewReceiptUrl ? (
              <img src={viewReceiptUrl} alt="Receipt" className="max-w-full h-auto object-contain" />
            ) : null}
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="secondary" onClick={() => setViewReceiptUrl(null)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* View Slip Modal */}
      <Modal
        isOpen={!!viewSlip}
        onClose={() => setViewSlip(null)}
        title="Payment Slip Preview"
        className="max-w-3xl"
      >
        {viewSlip && (() => {
          const rec = recipients.find(r => r.id === viewSlip.recipientId);
          const note = notes.find(n => n.id === viewSlip.noteId);
          const formatDate = (dateString: string) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          };
          const formatPeriod = (dateString: string) => {
            if (!dateString) return '';
            const date = new Date(dateString.length === 7 ? `${dateString}-01` : dateString);
            return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
          };
          const formatIDR = (amount: number) => {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
          };

          return (
            <div className="flex flex-col space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-10 shadow-sm relative overflow-hidden mx-auto w-full max-w-2xl text-black">
                <div className="flex justify-between items-start mb-6 pb-6 border-b-2 border-black">
                  <div className="pt-1">
                    <h1 className="text-xl font-bold uppercase tracking-wider mb-1 text-gray-900">PT. LONG TERM VISION</h1>
                    <p className="text-xs text-gray-600">One Pacific Place, 15th Floor, Suite 1501</p>
                    <p className="text-xs text-gray-600">Jl. Jendral Sudirman Kav. 52-53, Jakarta 12190</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold tracking-widest text-[#001233] mb-1">PAYMENT SLIP</h2>
                    <p className="text-xs font-semibold text-gray-600">Voucher No: {viewSlip.slipNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Request For</span>
                      <span className="font-semibold">{rec?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Account Name</span>
                      <span className="font-semibold">{viewSlip.recipientNameSnapshot || rec?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Transaction ID</span>
                      <span className="font-semibold">{note?.noteId}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Date</span>
                      <span className="font-semibold text-right">{formatDate(viewSlip.date)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Period</span>
                      <span className="font-semibold text-right">{formatPeriod(viewSlip.period)}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-gray-500">Payment Date</span>
                      <span className="font-semibold text-right">{formatDate(viewSlip.paymentDate)}</span>
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 mb-3 text-xs tracking-wide uppercase">Commission Breakdown</h3>
                <table className="w-full mb-8 text-sm">
                  <thead>
                    <tr className="bg-[#001233] text-white">
                      <th className="p-2 text-center font-semibold rounded-tl-md">Share %</th>
                      <th className="p-2 text-right font-semibold">Gross Amount</th>
                      <th className="p-2 text-right font-semibold">Tax Deduction</th>
                      <th className="p-2 text-right font-semibold rounded-tr-md">Net Commission</th>
                    </tr>
                  </thead>
                  <tbody className="border-b border-gray-200">
                    <tr className="bg-gray-50">
                      <td className="p-3 text-center text-gray-600 font-medium">{rec?.defaultShare}%</td>
                      <td className="p-3 text-right text-gray-600">{formatIDR(viewSlip.totalGross)}</td>
                      <td className="p-3 text-right text-red-500">
                        {viewSlip.taxAmount > 0 ? `${((viewSlip.taxAmount / viewSlip.totalGross) * 100).toFixed(2)}% ` : ''}
                        ({formatIDR(viewSlip.taxAmount)})
                      </td>
                      <td className="p-3 text-right font-bold text-[#001233] bg-blue-50/50">{formatIDR(viewSlip.netCommission)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={() => setViewSlip(null)}>Close Preview</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

    </div>
  );
}
