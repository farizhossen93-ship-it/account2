export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'BDT' | 'INR' | 'BTC' | 'ETH';

export type AccountCategory = 
  | 'Gmail' 
  | 'Social Media' 
  | 'Banking' 
  | 'Crypto' 
  | 'Gaming' 
  | 'Business' 
  | 'Custom';

export interface SecurityQuestion {
  question: string;
  answer: string;
}

export interface Account {
  id: string;
  userId: string;
  title: string;
  platformName: string;
  category: AccountCategory;
  websiteUrl: string;
  username: string;
  loginEmail: string;
  passwordEncrypted: string; // encrypted
  recoveryEmailEncrypted?: string; // encrypted
  recoveryPhoneEncrypted?: string; // encrypted
  
  // Security information
  backupCodesEncrypted?: string; // encrypted
  securityQuestionsEncrypted?: string; // encrypted (JSON string of SecurityQuestion[])
  authenticatorSecretKeyEncrypted?: string; // encrypted
  passkeysNotes?: string; // notes on passkey presence
  
  // Financial info
  balance: number;
  currency: CurrencyCode;
  earnings: number;
  withdrawnAmount: number;
  availableAmount: number;
  
  // Metadata
  creationDate: string;
  lastLoginDate?: string;
  status: 'active' | 'suspended' | 'inactive';
  notes?: string;
  tags: string[]; // comma separated or array
  
  // Status flags
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean; // For trash bin
  deletedAt?: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  category: string; // 'Private', 'API Key', 'License Key', 'Reminder', etc.
  contentEncrypted: string; // encrypted
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  creationDate: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: 'LOGIN' | 'SIGNUP' | 'VIEW_PASSWORD' | 'EDIT_ACCOUNT' | 'DELETE_ACCOUNT' | 'RESTORE_ACCOUNT' | 'EXPORT_VAULT' | 'IMPORT_VAULT' | 'CREATE_NOTE' | 'EDIT_NOTE' | 'DELETE_NOTE' | 'UPDATE_PROFILE' | 'EMPTY_TRASH';
  details: string; // e.g. "Viewed password for account 'My Gmail'"
  timestamp: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  is2FAEnabled: boolean;
}

export interface DashboardStats {
  totalAccounts: number;
  totalGmailAccounts: number;
  totalWebsites: number;
  totalCryptoAccounts: number;
  totalSavedPasswords: number;
  recentlyAdded: Array<{ id: string; title: string; category: string; platform: string; date: string }>;
  totalBalanceUSD: number; // For summary
}

export interface PasswordHealthSummary {
  weakCount: number;
  reusedCount: number;
  oldCount: number; // older than 90 days
  securityScore: number; // 0-100 rating
}
