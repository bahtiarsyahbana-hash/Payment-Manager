import { useState, useEffect, useMemo } from 'react';
import { db, CommissionNote, Client, Insurance, Recipient, PaymentSlip } from '../store/db';
import { Card, CardContent, CardHeader, CardTitle, Select, Table, Th, Td, Button, Input, Label, Modal } from '../components/ui';
import { formatIDR } from '../lib/utils';
import { Settings, Plus, Trash2, Printer, CheckCircle, FileText, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type CustomField = {
  id: string;
  name: string;
  source: string;
  formulaSource?: string;
  formulaOperator?: string;
  formulaSource2?: string;
  formulaConstant?: number;
  formulaPercent?: number;
};

const AVAILABLE_SOURCES = [
  { value: 'noteId', label: 'Note ID' },
  { value: 'date', label: 'Date' },
  { value: 'period', label: 'Period' },
  { value: 'client', label: 'Client Name' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'adminSharePercent', label: 'Admin Share Percent (%)' },
  { value: 'grossPremium', label: 'Gross Premium' },
  { value: 'incomeAfterStopLoss', label: 'Income After Stop Loss' },
  { value: 'nettBrokerage', label: 'Nett Brokerage' },
  { value: 'companyNet', label: 'Company Net After Distribution (Transaction Slip)' },
  { value: 'profitBeforeTax', label: 'Profit Distributor (Before Tax)' },
  { value: 'profitAfterTax', label: 'Profit Distributor (After Tax)' },
  { value: 'totalNetCommission', label: 'Total Net Commission (Document)' },
  { value: 'formula', label: 'Custom Formula (Calculation)' },
  { value: 'manual_date', label: 'Manual Input (Date)' },
  { value: 'manual_text', label: 'Manual Input (Text)' }
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'recap' | 'custom'>('recap');

  const [notes, setNotes] = useState<CommissionNote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [insurance, setInsurance] = useState<Insurance[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [paymentSlips, setPaymentSlips] = useState<PaymentSlip[]>([]);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterInsurance, setFilterInsurance] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterRecipient, setFilterRecipient] = useState('');

  // Custom Report State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    const saved = localStorage.getItem('lastCustomFields');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: uuidv4(), name: 'Date', source: 'date' },
      { id: uuidv4(), name: 'Client', source: 'client' },
      { id: uuidv4(), name: 'Income After Stop Loss', source: 'incomeAfterStopLoss' },
      { id: uuidv4(), name: 'Company Net After Distribution', source: 'companyNet' },
      { id: uuidv4(), name: 'Profit Distributed', source: 'profitBeforeTax' }
    ];
  });
  const [manualInputs, setManualInputs] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('reportManualInputs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });
  const [savedTemplates, setSavedTemplates] = useState<{name: string, fields: CustomField[]}[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [activeTemplateName, setActiveTemplateName] = useState(() => {
    return localStorage.getItem('lastActiveTemplateName') || 'Custom Report';
  });
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('landscape');

  const dynamicSources = useMemo(() => {
    const roles = Array.from(new Set(recipients.map(r => r.role))).sort();
    const roleSources = roles.map(role => ({ value: `role_${role}`, label: `Distributor (${role})` }));
    return [...AVAILABLE_SOURCES, ...roleSources];
  }, [recipients]);

  useEffect(() => {
    localStorage.setItem('lastCustomFields', JSON.stringify(customFields));
    localStorage.setItem('lastActiveTemplateName', activeTemplateName);
  }, [customFields, activeTemplateName]);

  useEffect(() => {
    const saved = localStorage.getItem('reportTemplates');
    if (saved) {
      try { setSavedTemplates(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveTemplate = () => {
    if (!newTemplateName) return;
    const newTemplates = [...savedTemplates, { name: newTemplateName, fields: customFields }];
    setSavedTemplates(newTemplates);
    localStorage.setItem('reportTemplates', JSON.stringify(newTemplates));
    setActiveTemplateName(newTemplateName);
    setNewTemplateName('');
  };

  const loadTemplate = (templateName: string) => {
    const template = savedTemplates.find(t => t.name === templateName);
    if (template) {
      setCustomFields(template.fields);
      setActiveTemplateName(templateName);
    }
  };

  const deleteTemplate = (templateName: string) => {
    const newTemplates = savedTemplates.filter(t => t.name !== templateName);
    setSavedTemplates(newTemplates);
    localStorage.setItem('reportTemplates', JSON.stringify(newTemplates));
  };

  useEffect(() => {
    const u1 = db.subscribeNotes(setNotes);
    const u2 = db.subscribeClients(setClients);
    const u3 = db.subscribeInsurance(setInsurance);
    const u4 = db.subscribeRecipients(setRecipients);
    const u5 = db.subscribePaymentSlips(setPaymentSlips);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Unknown';
  const getInsuranceName = (id: string) => insurance.find(i => i.id === id)?.name || 'Unknown';
  const getRecipientName = (id: string) => recipients.find(r => r.id === id)?.name || 'Unknown';

  const calculateProfitAfterTax = (noteId: string, totalGross: number) => {
    const slipsForNote = paymentSlips.filter(s => s.noteId === noteId);
    if (slipsForNote.length === 0) return totalGross; // No tax calculated yet
    
    // Calculate average tax rate for this note from generated slips
    let totalSlipGross = 0;
    let totalSlipTax = 0;
    slipsForNote.forEach(s => {
      totalSlipGross += s.totalGross;
      totalSlipTax += s.taxAmount;
    });

    if (totalSlipGross === 0) return totalGross;
    const taxRate = totalSlipTax / totalSlipGross;
    return totalGross * (1 - taxRate);
  };

  // Flatten data for reporting
  const approvedNotes = notes.filter(n => n.status === 'Approved' || n.status === 'Commission Received');
  let reportData = approvedNotes.flatMap(note => 
    note.details.map(detail => {
      const distributionsAmount = detail.distributions.reduce((sum, d) => sum + d.amount, 0);
      return {
        rowId: `${note.id}-${detail.id}`,
        noteId: note.noteId,
        date: note.date,
        clientId: detail.clientId,
        client: getClientName(detail.clientId),
        insuranceId: detail.insuranceId,
        insurance: getInsuranceName(detail.insuranceId),
        adminSharePercent: detail.adminSharePercent,
        grossPremium: detail.grossPremium,
        incomeAfterStopLoss: detail.incomeAfterStopLoss,
        nettBrokerage: detail.nettBrokerage,
        companyNet: detail.companyNetIncome,
        profitBeforeTax: distributionsAmount,
        profitAfterTax: calculateProfitAfterTax(note.noteId, distributionsAmount),
        totalNetCommission: note.totalNetCommission,
        distributions: detail.distributions
      };
    })
  );

  // Apply filters
  if (filterStartDate) {
    reportData = reportData.filter(d => d.date >= filterStartDate);
  }
  if (filterEndDate) {
    reportData = reportData.filter(d => d.date <= filterEndDate);
  }
  if (filterPeriod) {
    reportData = reportData.filter(d => d.date.startsWith(filterPeriod));
  }
  if (filterInsurance) {
    reportData = reportData.filter(d => d.insuranceId === filterInsurance);
  }
  if (filterClient) {
    reportData = reportData.filter(d => d.clientId === filterClient);
  }
  if (filterRole) {
    reportData = reportData.filter(d => d.distributions.some(dist => dist.role === filterRole));
  }
  if (filterRecipient) {
    reportData = reportData.filter(d => d.distributions.some(dist => dist.recipientId === filterRecipient));
  }

  // Calculate profit specifically for the filtered recipient/role if they are selected
  if (filterRole || filterRecipient) {
    reportData = reportData.map(d => {
      let filteredDists = d.distributions;
      if (filterRole) filteredDists = filteredDists.filter(dist => dist.role === filterRole);
      if (filterRecipient) filteredDists = filteredDists.filter(dist => dist.recipientId === filterRecipient);
      
      const distAmount = filteredDists.reduce((sum, dist) => sum + dist.amount, 0);
      return {
        ...d,
        profitBeforeTax: distAmount,
        profitAfterTax: calculateProfitAfterTax(d.noteId, distAmount)
      };
    });
  }

  // Get unique months for filter
  const months = Array.from(new Set(approvedNotes.map(n => n.date.substring(0, 7)))).sort().reverse();

  const handleAddField = () => {
    setCustomFields([
      ...customFields,
      { id: uuidv4(), name: 'New Column', source: 'grossPremium' }
    ]);
  };

  const handleRemoveField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const handleUpdateField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(customFields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatPeriod = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString.length === 7 ? `${dateString}-01` : dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const getCellValue = (row: any, field: CustomField, allFields: CustomField[], visited = new Set<string>()): number | string => {
    if (visited.has(field.id)) return 0; // Prevent infinite loops
    visited.add(field.id);

    if (field.source === 'formula') {
      let sourceVal1 = 0;
      let sourceVal2 = 0;
      
      const getVal = (sourceStr: string | undefined, constant?: number) => {
        if (!sourceStr) return constant || 0;
        const sourceField = allFields.find(f => f.id === sourceStr);
        if (sourceField) return Number(getCellValue(row, sourceField, allFields, new Set(visited))) || 0;
        
        if (sourceStr.startsWith('role_')) {
          const role = sourceStr.replace('role_', '');
          const dists = row.distributions || [];
          return dists.filter((d: any) => d.role === role).reduce((sum: number, d: any) => sum + d.amount, 0);
        }
        
        return parseFloat(row[sourceStr as keyof typeof row] as unknown as string || '0');
      };

      sourceVal1 = getVal(field.formulaSource);

      if (field.formulaOperator) {
        sourceVal2 = getVal(field.formulaSource2, field.formulaConstant);
        switch (field.formulaOperator) {
          case '+': return sourceVal1 + sourceVal2;
          case '-': return sourceVal1 - sourceVal2;
          case '*': return sourceVal1 * sourceVal2;
          case '/': return sourceVal2 !== 0 ? sourceVal1 / sourceVal2 : 0;
          default: return sourceVal1;
        }
      }

      // Legacy percent fallback
      const pct = field.formulaPercent || 0;
      return sourceVal1 * (pct / 100);
    }
    
    if (field.source.startsWith('role_')) {
      const role = field.source.replace('role_', '');
      const dists = row.distributions || [];
      return dists.filter((d: any) => d.role === role).reduce((sum: number, d: any) => sum + d.amount, 0);
    }
    
    if (field.source === 'period') {
      return row.date;
    }
    
    return row[field.source as keyof typeof row] as any;
  };

  const renderCellValue = (row: any, field: CustomField) => {
    const val = getCellValue(row, field, customFields);
    
    if (field.source === 'manual_date' || field.source === 'manual_text') {
      return (
        <Input 
          type={field.source === 'manual_date' ? 'date' : 'text'}
          value={manualInputs[`${row.rowId}-${field.id}`] || ''} 
          onChange={(e) => {
            const newInputs = {...manualInputs, [`${row.rowId}-${field.id}`]: e.target.value};
            setManualInputs(newInputs);
            localStorage.setItem('reportManualInputs', JSON.stringify(newInputs));
          }}
          className="h-8 text-xs print:border-none print:p-0 print:bg-transparent min-w-[120px]"
          placeholder={field.source === 'manual_text' ? '...' : ''}
        />
      );
    }

    if (field.source === 'formula') {
      return formatIDR(val as number);
    }
    
    if (field.source === 'date') {
      return formatDate(val as string);
    }

    if (field.source === 'period') {
      return formatPeriod(val as string);
    }

    if (typeof val === 'number') {
      if (field.source === 'adminSharePercent') return `${val}%`;
      return formatIDR(val);
    }
    return val || '-';
  };

  const handleExportExcel = () => {
    const header = ['No', ...customFields.map(f => `"${f.name.replace(/"/g, '""')}"`)].join(',');
    const rows = reportData.map((row, i) => {
      const rowData = [
        i + 1,
        ...customFields.map(field => {
          let val = getCellValue(row, field, customFields);
          
          if (field.source === 'manual_date' || field.source === 'manual_text') {
            val = manualInputs[`${row.rowId}-${field.id}`] || '';
          } else if (field.source === 'date') {
            val = formatDate(val as string);
          } else if (field.source === 'period') {
            val = formatPeriod(val as string);
          }
          
          const stringVal = String(val).replace(/"/g, '""');
          return `"${stringVal}"`;
        })
      ];
      return rowData.join(',');
    });

    if (reportData.length > 0) {
      const totalRowData = [
        '',
        ...customFields.map(field => {
          const isNumber = field.source === 'formula' || typeof reportData[0][field.source as keyof typeof reportData[0]] === 'number';
          if (!isNumber || field.source === 'adminSharePercent') return '""';
          
          let total = 0;
          reportData.forEach(row => {
            total += Number(getCellValue(row, field, customFields)) || 0;
          });
          return `"${total}"`;
        })
      ];
      rows.push(totalRowData.join(','));
    }

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTemplateName || 'Custom_Report'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = activeTemplateName;
    window.print();
    document.title = originalTitle;
  };

  return (
    <div className="space-y-6">
      <style>
        {`@media print { @page { size: ${printLayout}; margin: 1cm; } }`}
      </style>
      <div className="flex justify-between items-center sm:items-end flex-col sm:flex-row gap-4 no-print border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        
        <div className="flex flex-wrap gap-3 w-full sm:w-auto items-end">
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">Period (Month)</Label>
            <Input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-[140px]" />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">Start Date</Label>
            <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-[140px]" disabled={!!filterPeriod} />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">End Date</Label>
            <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-[140px]" disabled={!!filterPeriod} />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">Client</Label>
            <Select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full sm:w-40">
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">Insurance</Label>
            <Select value={filterInsurance} onChange={e => setFilterInsurance(e.target.value)} className="w-full sm:w-40">
              <option value="">All Insurance</option>
              {insurance.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </Select>
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">Role</Label>
            <Select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="w-full sm:w-32">
              <option value="">All Roles</option>
              {Array.from(new Set(recipients.map(r => r.role))).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col">
            <Label className="text-xs text-gray-500 mb-1">Distributor</Label>
            <Select value={filterRecipient} onChange={e => setFilterRecipient(e.target.value)} className="w-full sm:w-40">
              <option value="">All</option>
              {recipients.filter(r => filterRole ? r.role === filterRole : true).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 mb-6 no-print">
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'recap' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('recap')}
        >
          Transaction Recap
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'custom' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('custom')}
        >
          Custom Report
        </button>
      </div>

      {activeTab === 'recap' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Recap Table</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Note ID</Th>
                    <Th>Client</Th>
                    <Th>Insurance</Th>
                    <Th className="text-right">Gross Premium</Th>
                    <Th className="text-right">Income After SL</Th>
                    <Th className="text-right">Nett Brokerage</Th>
                    <Th className="text-right">Company Net</Th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.length === 0 ? (
                    <tr><Td colSpan={8} className="text-center text-gray-500 py-8">No data found for selected filters.</Td></tr>
                  ) : (
                    reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <Td>{formatDate(row.date)}</Td>
                        <Td className="font-medium text-blue-600">{row.noteId}</Td>
                        <Td>{row.client}</Td>
                        <Td>{row.insurance}</Td>
                        <Td className="text-right">{formatIDR(row.grossPremium)}</Td>
                        <Td className="text-right">{formatIDR(row.incomeAfterStopLoss)}</Td>
                        <Td className="text-right">{formatIDR(row.nettBrokerage)}</Td>
                        <Td className="text-right font-semibold text-green-600">{formatIDR(row.companyNet)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <h2 className="text-xl font-bold text-gray-900 pt-4">Payment Slip Summary</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportData.map((row, i) => (
              <Card key={i} className="border-t-4 border-t-blue-500">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{row.noteId}</CardTitle>
                    <span className="text-sm text-gray-500">{formatDate(row.date)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{row.client} - {row.insurance}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="text-gray-500">Nett Brokerage (Pool)</span>
                      <span className="font-semibold">{formatIDR(row.nettBrokerage)}</span>
                    </div>
                    {row.distributions.map(dist => (
                      <div key={dist.recipientId} className="flex justify-between text-sm">
                        <span className="text-gray-700">{getRecipientName(dist.recipientId)} <span className="text-gray-400 text-xs">({dist.role} - {dist.sharePercent}%)</span></span>
                        <span className="font-medium">{formatIDR(dist.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="font-semibold text-green-700">Company Net After Dist.</span>
                      <span className="font-bold text-green-700">{formatIDR(row.companyNet)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'custom' && (
        <Card className="print:shadow-none print:border-none print:w-full print:bg-transparent">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print border-b pb-4 mb-4 border-gray-100">
            <CardTitle>{activeTemplateName} Preview</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsSetupModalOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Setup Columns
              </Button>
              <Select value={printLayout} onChange={e => setPrintLayout(e.target.value as any)} className="w-32 h-10">
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </Select>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Preview to PDF
              </Button>
              <Button onClick={handleExportExcel} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                <Download className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="print:p-0">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] print:max-h-none print:overflow-visible">
              <table className="w-full text-sm border-collapse relative print:text-[10px] print-fit">
                <thead className="sticky top-0 z-10 print:table-header-group">
                  <tr className="hidden print:table-row bg-white">
                    <th colSpan={customFields.length + 1} className="p-0 border-none bg-white font-normal pb-6">
                      <h2 className="text-xl font-bold text-center tracking-widest text-[#001233] mb-1 uppercase">{activeTemplateName}</h2>
                      <div className="text-center text-xs text-gray-600">
                        <p>
                          {filterPeriod ? `Period: ${formatPeriod(filterPeriod)} ` : (filterStartDate || filterEndDate) ? `Period: ${filterStartDate || '...'} to ${filterEndDate || '...'} ` : 'All Periods '}
                          {filterClient ? ` | Client: ${getClientName(filterClient)}` : ''}
                          {filterInsurance ? ` | Insurance: ${getInsuranceName(filterInsurance)}` : ''}
                          {filterRole ? ` | Role: ${filterRole}` : ''}
                          {filterRecipient ? ` | Distributor: ${getRecipientName(filterRecipient)}` : ''}
                        </p>
                      </div>
                    </th>
                  </tr>
                  <tr className="bg-[#001233] text-white print:bg-[#001233]">
                    <th className="p-3 print:p-1 text-center w-12 font-semibold bg-[#001233]">No</th>
                    {customFields.map(field => (
                      <th key={field.id} className="p-3 print:p-1 text-left font-semibold border-l border-blue-800 bg-[#001233]">
                        {field.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.length === 0 ? (
                    <tr>
                      <td colSpan={customFields.length + 1} className="p-8 text-center text-gray-500">
                        No data available for the custom report.
                      </td>
                    </tr>
                  ) : (
                    reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors print:border-b print:border-gray-300">
                        <td className="p-3 print:p-1 text-center text-gray-500">{i + 1}</td>
                        {customFields.map(field => {
                          const isNumber = field.source === 'formula' || typeof row[field.source as keyof typeof row] === 'number';
                          return (
                            <td key={field.id} className={`p-3 print:p-1 border-l border-gray-100 ${isNumber ? 'text-right' : 'text-left'} ${field.source.startsWith('manual_') ? 'print:p-0' : ''}`}>
                              {renderCellValue(row, field)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                  {reportData.length > 0 && (
                    <tr className="bg-gray-100 font-bold border-t-2 border-[#001233]">
                      <td className="p-3 print:p-1 text-center"></td>
                      {customFields.map(field => {
                        const isNumber = field.source === 'formula' || typeof reportData[0][field.source as keyof typeof reportData[0]] === 'number';
                        if (!isNumber || field.source === 'adminSharePercent') return <td key={field.id} className="p-3 print:p-1 border-l border-gray-200"></td>;
                        
                        // Calculate total
                        let total = 0;
                        reportData.forEach(row => {
                          total += Number(getCellValue(row, field, customFields)) || 0;
                        });
                        
                        return (
                          <td key={field.id} className="p-3 print:p-1 text-right border-l border-gray-200 text-[#001233]">
                            {formatIDR(total)}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} title="Setup Custom Report Columns" className="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">Add, remove, or customize the columns that will appear in your generated report.</p>
          
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Report Templates</h3>
            <div className="flex gap-2">
              <Input 
                placeholder="New Template Name" 
                value={newTemplateName} 
                onChange={e => setNewTemplateName(e.target.value)} 
                className="flex-1 h-9 text-sm"
              />
              <Button onClick={saveTemplate} disabled={!newTemplateName} className="h-9" variant="outline">Save</Button>
            </div>
            {savedTemplates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {savedTemplates.map(t => (
                  <div key={t.name} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs shadow-sm">
                    <span className="cursor-pointer hover:text-blue-600 font-medium" onClick={() => loadTemplate(t.name)}>{t.name}</span>
                    <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-500 cursor-pointer ml-1" onClick={() => deleteTemplate(t.name)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-2">
            {customFields.map((field, idx) => (
              <div key={field.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative group">
                <button 
                  onClick={() => handleRemoveField(field.id)}
                  className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Column Name</Label>
                    <Input 
                      value={field.name} 
                      onChange={e => handleUpdateField(field.id, { name: e.target.value })} 
                      placeholder="e.g., My Custom Column"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Data Source</Label>
                    <Select 
                      value={field.source} 
                      onChange={e => handleUpdateField(field.id, { source: e.target.value })}
                      className="mt-1 w-full"
                    >
                      {dynamicSources.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {field.source === 'formula' && (
                  <div className="mt-4 p-3 bg-blue-50/50 rounded-md border border-blue-100 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-xs text-blue-800">Operand 1</Label>
                      <Select 
                        value={field.formulaSource || ''} 
                        onChange={e => handleUpdateField(field.id, { formulaSource: e.target.value })}
                        className="mt-1 w-full"
                      >
                        <option value="">Select Field...</option>
                        {dynamicSources.filter(s => s.value !== 'formula' && !s.value.startsWith('manual_') && s.value !== 'noteId' && s.value !== 'date' && s.value !== 'period' && s.value !== 'client' && s.value !== 'insurance').map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                        {customFields.filter(f => f.id !== field.id && f.source === 'formula').length > 0 && (
                          <optgroup label="Custom Columns">
                            {customFields.filter(f => f.id !== field.id && f.source === 'formula').map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                    </div>
                    
                    <div className="w-16">
                      <Label className="text-xs text-blue-800">Operator</Label>
                      <Select 
                        value={field.formulaOperator || ''} 
                        onChange={e => {
                          handleUpdateField(field.id, { formulaOperator: e.target.value, formulaPercent: undefined });
                        }}
                        className="mt-1 w-full"
                      >
                        <option value="">...</option>
                        <option value="+">+</option>
                        <option value="-">-</option>
                        <option value="*">×</option>
                        <option value="/">÷</option>
                      </Select>
                    </div>

                    {field.formulaOperator ? (
                      <div className="flex-1 flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-blue-800">Operand 2</Label>
                          <Select 
                            value={field.formulaSource2 || ''} 
                            onChange={e => handleUpdateField(field.id, { formulaSource2: e.target.value })}
                            className="mt-1 w-full"
                          >
                            <option value="">Constant Number</option>
                            {dynamicSources.filter(s => s.value !== 'formula' && !s.value.startsWith('manual_') && s.value !== 'noteId' && s.value !== 'date' && s.value !== 'period' && s.value !== 'client' && s.value !== 'insurance').map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                            {customFields.filter(f => f.id !== field.id && f.source === 'formula').length > 0 && (
                              <optgroup label="Custom Columns">
                                {customFields.filter(f => f.id !== field.id && f.source === 'formula').map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </optgroup>
                            )}
                          </Select>
                        </div>
                        {!field.formulaSource2 && (
                          <div className="w-20">
                            <Label className="text-xs text-blue-800">Value</Label>
                            <Input 
                              type="number" 
                              value={field.formulaConstant || ''} 
                              onChange={e => handleUpdateField(field.id, { formulaConstant: parseFloat(e.target.value) || 0 })}
                              placeholder="e.g., 2"
                              className="mt-1"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-32">
                        <Label className="text-xs text-blue-800">Percentage (%)</Label>
                        <Input 
                          type="number" 
                          value={field.formulaPercent || ''} 
                          onChange={e => handleUpdateField(field.id, { formulaPercent: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g., 50"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full border-dashed border-2 py-6 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50" onClick={handleAddField}>
            <Plus className="w-5 h-5 mr-2" /> Add New Column
          </Button>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-6">
            <Button onClick={() => setIsSetupModalOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

