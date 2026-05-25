import { createClient } from '@supabase/supabase-js';

export function getSupabaseConfig() {
  const url = localStorage.getItem('supabase_url') || '';
  const key = localStorage.getItem('supabase_key') || '';
  return { url, key };
}

export function saveSupabaseConfig(url: string, key: string) {
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_key', key.trim());
}

export function clearSupabaseConfig() {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_key');
}

export function createSupabase() {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (err) {
    console.error('Supabase initialization error:', err);
    return null;
  }
}

/**
 * Uploads current vault JSON payload to the Supabase Storage Bucket 'digital-vault'
 */
export async function uploadVaultToSupabase(fileName: string, vaultData: any) {
  const supabase = createSupabase();
  if (!supabase) throw new Error('Supabase integration credentials are not configured.');

  const content = JSON.stringify(vaultData, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const file = new File([blob], fileName, { type: 'application/json' });

  // Try to create the bucket 'digital-vault' if it doesn't exist
  try {
    await supabase.storage.createBucket('digital-vault', { public: false });
  } catch (e) {
    // Normal to fail if already exists or lacks bucket creation permissions
  }

  // Upload or update file in 'digital-vault'
  const { data, error } = await supabase.storage
    .from('digital-vault')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

/**
 * Downloads list of backups from Supabase Storage
 */
export async function listSupabaseVaultBackups() {
  const supabase = createSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.storage
    .from('digital-vault')
    .list('', {
      limit: 50,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' }
    });

  if (error) {
    console.error('Error listing Supabase storage files:', error);
    return [];
  }
  return data || [];
}

/**
 * Downloads and parses backup JSON from Supabase Storage
 */
export async function downloadVaultFromSupabase(fileName: string) {
  const supabase = createSupabase();
  if (!supabase) throw new Error('Supabase credentials are not configured.');

  const { data, error } = await supabase.storage
    .from('digital-vault')
    .download(fileName);

  if (error) {
    throw new Error(error.message);
  }

  const text = await data.text();
  return JSON.parse(text);
}
