import { v4 as uuidv4 } from 'uuid';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../lib/firebase';

export type Client = { id: string; name: string; companyType: string };
export type Insurance = { id: string; name: string; defaultStopLoss: number; defaultBrokerage: number };
export type Recipient = { 
  id: string; 
  name: string; 
  role: 'Technical' | 'Agent' | 'Marketing' | 'IT'; 
  defaultShare: number;
  bankName?: string;
  accountNumber?: string;
  npwp?: string;
};

export type CommissionDistribution = {
  recipientId: string;
  role: string;
  sharePercent: number;
  amount: number;
};

export type CommissionDetail = {
  id: string;
  clientId: string;
  insuranceId: string;
  grossPremium: number;
  internalSharing: number;
  calculatedNetCommission: number;
  stopLossPercent: number;
  stopLossAmount: number;
  incomeAfterStopLoss: number;
  vat: number;
  wht: number;
  nettBrokerage: number;
  distributions: CommissionDistribution[];
  companyNetIncome: number;
};

export type CommissionNote = {
  id: string;
  noteId: string;
  date: string;
  totalNetCommission: number;
  status: 'Draft' | 'Approved' | 'Commission Received' | 'Rejected';
  receiptDate?: string;
  receiptFileUrl?: string;
  details: CommissionDetail[];
};

export type PaymentSlip = {
  id: string;
  slipNumber: string;
  recipientId: string;
  date: string;
  period: string;
  paymentDate: string;
  taxAmount: number;
  totalGross: number;
  netCommission: number;
  status: 'Generated' | 'Paid';
  noteId: string;
  recipientNameSnapshot?: string;
  bankNameSnapshot?: string;
  accountNumberSnapshot?: string;
  npwpSnapshot?: string;
};

export type DbConnectionState = {
  status: 'connected' | 'connecting' | 'offline' | 'error';
  isCloud: boolean;
  projectId: string;
  lastSync: string | null;
  lastError: string | null;
  counts: {
    clients: number;
    insurance: number;
    recipients: number;
    notes: number;
    paymentSlips: number;
  };
};

const INITIAL_CLIENTS: Client[] = [];

const INITIAL_INSURANCE: Insurance[] = [];

const INITIAL_RECIPIENTS: Recipient[] = [];

const INITIAL_NOTES: CommissionNote[] = [];

const INITIAL_SLIPS: PaymentSlip[] = [];

// In-memory cache loaded from localStorage first for instant, rock-solid response
const loadFromStorage = (key: string, legacyKeys: string[], fallback: any) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    for (const legacyKey of legacyKeys) {
      const lRaw = localStorage.getItem(legacyKey);
      if (lRaw) {
        const parsed = JSON.parse(lRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[DB] Recovered data from legacy key: ${legacyKey}`);
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn(`[DB] Error parsing localStorage for ${key}`, e);
  }
  return fallback;
};

const localCache: Record<string, any[]> = {
  clients: loadFromStorage('clients', ['clients', 'Clients', 'iris_clients'], INITIAL_CLIENTS),
  insurance: loadFromStorage('insurance', ['insurance', 'insurers', 'Insurers', 'iris_insurance'], INITIAL_INSURANCE),
  recipients: loadFromStorage('recipients', ['recipients', 'Recipients', 'iris_recipients'], INITIAL_RECIPIENTS),
  notes: loadFromStorage('notes', ['notes', 'commissionNotes', 'transactions', 'Transactions'], INITIAL_NOTES),
  paymentSlips: loadFromStorage('paymentSlips', ['paymentSlips', 'PaymentSlips', 'slips'], INITIAL_SLIPS)
};

// Subscriber listeners map for reactive updates
type SubscriberCallback = (data: any) => void;
const subscribers = new Map<string, Set<SubscriberCallback>>();

const subscribe = (key: string, cb: SubscriberCallback) => {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key)!.add(cb);
  // Call immediately with current cached data
  cb(localCache[key]);
  return () => {
    subscribers.get(key)?.delete(cb);
  };
};

const notifySubscribers = (key: string) => {
  const set = subscribers.get(key);
  if (set) {
    const currentData = localCache[key];
    set.forEach(cb => {
      try {
        cb(currentData);
      } catch (err) {
        console.error(`[DB] Error in subscriber for ${key}`, err);
      }
    });
  }
  notifyConnectionSubscribers();
};

// Connection status tracking
let connectionState: DbConnectionState = {
  status: 'connecting',
  isCloud: true,
  projectId: 'commission-check-28311',
  lastSync: null,
  lastError: null,
  counts: {
    clients: localCache.clients.length,
    insurance: localCache.insurance.length,
    recipients: localCache.recipients.length,
    notes: localCache.notes.length,
    paymentSlips: localCache.paymentSlips.length,
  }
};

const connectionSubscribers = new Set<(state: DbConnectionState) => void>();

const updateConnectionState = (partial: Partial<DbConnectionState>) => {
  connectionState = {
    ...connectionState,
    ...partial,
    counts: {
      clients: localCache.clients?.length || 0,
      insurance: localCache.insurance?.length || 0,
      recipients: localCache.recipients?.length || 0,
      notes: localCache.notes?.length || 0,
      paymentSlips: localCache.paymentSlips?.length || 0,
    }
  };
  notifyConnectionSubscribers();
};

const notifyConnectionSubscribers = () => {
  connectionState.counts = {
    clients: localCache.clients?.length || 0,
    insurance: localCache.insurance?.length || 0,
    recipients: localCache.recipients?.length || 0,
    notes: localCache.notes?.length || 0,
    paymentSlips: localCache.paymentSlips?.length || 0,
  };
  connectionSubscribers.forEach(cb => {
    try {
      cb({ ...connectionState });
    } catch (e) {
      console.error('[DB] Connection subscriber error', e);
    }
  });
};

// Core save helper (writes to in-memory + localStorage immediately, then Firestore asynchronously)
const saveList = async (key: string, list: any[]) => {
  const sanitizedList = JSON.parse(JSON.stringify(list));
  // 1. Immediately update in-memory cache
  localCache[key] = sanitizedList;
  // 2. Immediately write to localStorage for durability
  try {
    localStorage.setItem(key, JSON.stringify(sanitizedList));
  } catch (e) {
    console.warn(`[DB] localStorage write failed for ${key}`, e);
  }
  // 3. Immediately notify all active React components
  notifySubscribers(key);

  // 4. Asynchronously persist to Firestore Cloud DB
  try {
    await setDoc(doc(firestore, 'appData', key), { 
      data: sanitizedList,
      updatedAt: new Date().toISOString()
    });
    updateConnectionState({
      status: 'connected',
      isCloud: true,
      lastSync: new Date().toLocaleTimeString(),
      lastError: null
    });
  } catch (error: any) {
    console.error(`[DB] Firestore write warning for ${key}:`, error);
    updateConnectionState({
      status: 'error',
      lastError: error.message || 'Firestore write rejected'
    });
  }
};

// Setup background Firestore sync listener for a collection key
const setupCloudListener = (key: string, defaultData: any) => {
  try {
    onSnapshot(doc(firestore, 'appData', key), async (snapshot) => {
      if (snapshot.exists()) {
        const cloudData = snapshot.data()?.data;
        if (Array.isArray(cloudData)) {
          localCache[key] = cloudData;
          try {
            localStorage.setItem(key, JSON.stringify(cloudData));
          } catch (e) {}
          notifySubscribers(key);
        }
        updateConnectionState({
          status: 'connected',
          isCloud: true,
          lastSync: new Date().toLocaleTimeString(),
          lastError: null
        });
      } else {
        // Document does not exist yet in Firestore, seed it from localCache
        const toSave = localCache[key] && localCache[key].length > 0 ? localCache[key] : defaultData;
        localCache[key] = toSave;
        try {
          localStorage.setItem(key, JSON.stringify(toSave));
          await setDoc(doc(firestore, 'appData', key), { 
            data: toSave, 
            updatedAt: new Date().toISOString() 
          });
        } catch (err) {}
        notifySubscribers(key);
      }
    }, (error) => {
      console.warn(`[DB] Firestore listener notice for ${key}:`, error.message);
      updateConnectionState({
        status: 'offline',
        isCloud: false,
        lastError: error.message
      });
    });
  } catch (err: any) {
    console.warn(`[DB] Firestore init notice for ${key}:`, err.message);
    updateConnectionState({
      status: 'offline',
      isCloud: false,
      lastError: err.message
    });
  }
};

// Initialize listeners for all collections
setupCloudListener('clients', INITIAL_CLIENTS);
setupCloudListener('insurance', INITIAL_INSURANCE);
setupCloudListener('recipients', INITIAL_RECIPIENTS);
setupCloudListener('notes', INITIAL_NOTES);
setupCloudListener('paymentSlips', INITIAL_SLIPS);

export const db = {
  // Clients
  getClients: (): Client[] => localCache['clients'] || [],
  saveClients: (clients: Client[]) => saveList('clients', clients),
  subscribeClients: (cb: (data: Client[]) => void) => subscribe('clients', cb),
  
  // Insurance
  getInsurance: (): Insurance[] => localCache['insurance'] || [],
  saveInsurance: (insurance: Insurance[]) => saveList('insurance', insurance),
  subscribeInsurance: (cb: (data: Insurance[]) => void) => subscribe('insurance', cb),
  
  // Recipients
  getRecipients: (): Recipient[] => localCache['recipients'] || [],
  saveRecipients: (recipients: Recipient[]) => saveList('recipients', recipients),
  subscribeRecipients: (cb: (data: Recipient[]) => void) => subscribe('recipients', cb),
  
  // Commission Notes
  getNotes: (): CommissionNote[] => localCache['notes'] || [],
  saveNotes: (notes: CommissionNote[]) => saveList('notes', notes),
  subscribeNotes: (cb: (data: CommissionNote[]) => void) => subscribe('notes', cb),

  // Payment Slips
  getPaymentSlips: (): PaymentSlip[] => localCache['paymentSlips'] || [],
  savePaymentSlips: (slips: PaymentSlip[]) => saveList('paymentSlips', slips),
  subscribePaymentSlips: (cb: (data: PaymentSlip[]) => void) => subscribe('paymentSlips', cb),

  // Connection & Diagnostics
  getConnectionState: (): DbConnectionState => ({ ...connectionState }),
  subscribeConnectionState: (cb: (state: DbConnectionState) => void) => {
    connectionSubscribers.add(cb);
    cb({ ...connectionState });
    return () => {
      connectionSubscribers.delete(cb);
    };
  },

  // Active Connection Test
  testConnection: async (): Promise<{ success: boolean; latencyMs: number; message: string }> => {
    const startTime = Date.now();
    try {
      const pingKey = 'connection_test_ping';
      const nowIso = new Date().toISOString();
      await setDoc(doc(firestore, 'appData', pingKey), { ping: nowIso });
      const snap = await getDoc(doc(firestore, 'appData', pingKey));
      const latencyMs = Date.now() - startTime;
      if (snap.exists() && snap.data()?.ping === nowIso) {
        updateConnectionState({
          status: 'connected',
          isCloud: true,
          lastSync: new Date().toLocaleTimeString(),
          lastError: null
        });
        return {
          success: true,
          latencyMs,
          message: `Firestore connected! Read/Write verified in ${latencyMs}ms.`
        };
      } else {
        throw new Error('Verification snapshot mismatched');
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      updateConnectionState({
        status: 'error',
        lastError: err.message || 'Connection test failed'
      });
      return {
        success: false,
        latencyMs,
        message: err.message || 'Could not connect to Cloud Firestore'
      };
    }
  },

  // Force Cloud Sync (Pushes all local data to Firestore)
  syncAll: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const keys = ['clients', 'insurance', 'recipients', 'notes', 'paymentSlips'];
      for (const key of keys) {
        const data = localCache[key] || [];
        await setDoc(doc(firestore, 'appData', key), { 
          data: JSON.parse(JSON.stringify(data)),
          updatedAt: new Date().toISOString()
        });
      }
      updateConnectionState({
        status: 'connected',
        isCloud: true,
        lastSync: new Date().toLocaleTimeString(),
        lastError: null
      });
      return {
        success: true,
        message: 'All collections successfully synchronized to Cloud Firestore.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Sync error: ${err.message || 'Failed to sync to Firestore'}`
      };
    }
  },

  // Pull latest data from Cloud to local
  pullFromCloud: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const keys = ['clients', 'insurance', 'recipients', 'notes', 'paymentSlips'];
      let pulledCount = 0;
      for (const key of keys) {
        const snap = await getDoc(doc(firestore, 'appData', key));
        if (snap.exists()) {
          const cloudData = snap.data()?.data;
          if (Array.isArray(cloudData)) {
            localCache[key] = cloudData;
            localStorage.setItem(key, JSON.stringify(cloudData));
            notifySubscribers(key);
            pulledCount++;
          }
        }
      }
      updateConnectionState({
        status: 'connected',
        isCloud: true,
        lastSync: new Date().toLocaleTimeString(),
        lastError: null
      });
      return {
        success: true,
        message: `Successfully pulled ${pulledCount} collections from Cloud Firestore.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Pull error: ${err.message || 'Failed to fetch from Firestore'}`
      };
    }
  },

  // Export all data to JSON
  exportData: (): string => {
    const payload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      data: {
        clients: localCache.clients,
        insurance: localCache.insurance,
        recipients: localCache.recipients,
        notes: localCache.notes,
        paymentSlips: localCache.paymentSlips
      }
    };
    return JSON.stringify(payload, null, 2);
  },

  // Import data from JSON
  importData: async (jsonStr: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonStr);
      const data = parsed.data || parsed;
      if (Array.isArray(data.clients)) await saveList('clients', data.clients);
      if (Array.isArray(data.insurance)) await saveList('insurance', data.insurance);
      if (Array.isArray(data.recipients)) await saveList('recipients', data.recipients);
      if (Array.isArray(data.notes)) await saveList('notes', data.notes);
      if (Array.isArray(data.paymentSlips)) await saveList('paymentSlips', data.paymentSlips);
      return true;
    } catch (e) {
      console.error('[DB] Import error:', e);
      return false;
    }
  },

  // Reset to full realistic sample data
  resetToSampleData: async () => {
    await saveList('clients', INITIAL_CLIENTS);
    await saveList('insurance', INITIAL_INSURANCE);
    await saveList('recipients', INITIAL_RECIPIENTS);
    await saveList('notes', INITIAL_NOTES);
    await saveList('paymentSlips', INITIAL_SLIPS);
    updateConnectionState({
      status: 'connected',
      lastSync: new Date().toLocaleTimeString()
    });
  },

  // Backward compatibility methods
  initDummyData: () => {
    db.resetToSampleData();
    setTimeout(() => window.location.reload(), 800);
  },

  restoreFromLocal: () => {
    db.syncAll();
  }
};
