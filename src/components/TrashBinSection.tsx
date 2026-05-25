import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertOctagon, Loader2, Database, FileText } from 'lucide-react';
import { Account, Note } from '../types.js';

interface TrashProps {
  token: string | null;
  onRefreshStats: () => void;
}

export default function TrashBinSection({ token, onRefreshStats }: TrashProps) {
  const [deletedAccounts, setDeletedAccounts] = useState<Account[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const accResp = await fetch('/api/accounts?includeDeleted=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const accounts: Account[] = await accResp.json();
      
      const noteResp = await fetch('/api/notes?includeDeleted=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const notes: Note[] = await noteResp.json();

      if (accResp.ok) {
        setDeletedAccounts(accounts.filter(a => a.isDeleted));
      }
      if (noteResp.ok) {
        setDeletedNotes(notes.filter(n => n.isDeleted));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedItems();
  }, [token]);

  const handleRestoreAccount = async (id: string) => {
    setActioningId(id);
    try {
      const resp = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isDeleted: false })
      });
      if (resp.ok) {
        fetchDeletedItems();
        onRefreshStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  };

  const handleRestoreNote = async (id: string) => {
    setActioningId(id);
    try {
      const resp = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isDeleted: false })
      });
      if (resp.ok) {
        fetchDeletedItems();
        onRefreshStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  };

  const handleDeleteAccountPerm = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to PERMANENTLY delete account '${name}'?\nThis will purge all AES encrypted credentials, balance sheets and tracking logs from servers forever.`)) return;
    setActioningId(id);
    try {
      const resp = await fetch(`/api/accounts/${id}?permanent=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        fetchDeletedItems();
        onRefreshStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  };

  const handleDeleteNotePerm = async (id: string, title: string) => {
    if (!confirm(`Are you absolutely sure you want to PERMANENTLY delete secure note '${title}'?\nThis action is irreversible.`)) return;
    setActioningId(id);
    try {
      const resp = await fetch(`/api/notes/${id}?permanent=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        fetchDeletedItems();
        onRefreshStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActioningId(null);
    }
  };

  const handleEmptyTrash = async () => {
    const totalCount = deletedAccounts.length + deletedNotes.length;
    if (totalCount === 0) return;
    
    if (!confirm(`CRITICAL WARNING!\n\nYou are about to empty your trash bin (${totalCount} items).\n\nThis will purge all selected accounts, balances lists, usernames and encrypted passwords PERMANENTLY from physical disk storage.\n\nDo you want to proceed?`)) {
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/trash/empty', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        fetchDeletedItems();
        onRefreshStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalTrashCount = deletedAccounts.length + deletedNotes.length;

  return (
    <div className="space-y-6 animate-fade-in font-sans" id="trash-bin-module">
      
      {/* Upper bar with empty action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-red-955/20 pb-4">
        <div className="text-left font-sans">
          <h3 className="text-md font-bold text-slate-100 font-display flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500 animate-pulse" />
            Trash Bin Audits
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Soft-deleted credentials and note cards are kept here until permanently purged</p>
        </div>

        {totalTrashCount > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="px-4.5 py-2 bg-red-650 hover:bg-red-550 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/25 border border-red-500/10"
          >
            <AlertOctagon className="w-4 h-4 shrink-0 text-white" />
            Purge Trash Bin
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        </div>
      ) : totalTrashCount === 0 ? (
        <div className="text-center py-16 bg-[#050505] border border-red-955/40 rounded-3xl max-w-lg mx-auto space-y-3 shadow-lg crimson-glow">
          <div className="p-3 bg-[#0a0a0a] border border-red-955/20 rounded-2xl inline-block">
            <Trash2 className="w-8 h-8 text-red-500/70" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-200 font-display">Trash Bin is Empty</h4>
            <p className="text-[10.5px] text-slate-500 max-w-sm mx-auto font-sans leading-relaxed">No soft-deleted credentials or private logs discovered. Safe actions performed so far.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="trash-items-board">
          
          {/* Trashed Login Credentials */}
          <div className="bg-[#050505] border border-red-955/40 rounded-3xl p-6 space-y-4 text-left shadow-lg crimson-glow">
            <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 border-b border-red-955/20 pb-2.5">
              <Database className="w-4 h-4 text-red-500" />
              Trashed Credentials ({deletedAccounts.length})
            </h4>

            {deletedAccounts.length === 0 ? (
              <p className="text-xs text-slate-505 italic py-6 text-center font-sans">No credential cards soft-deleted.</p>
            ) : (
              <div className="divide-y divide-red-955/20 max-h-[400px] overflow-y-auto pr-1 space-y-2">
                {deletedAccounts.map(a => (
                  <div key={a.id} className="pt-3 pb-3 flex items-center justify-between gap-4 first:pt-0">
                    <div className="ellipsis flex-1 text-left font-sans">
                      <span className="text-[9px] text-red-500 font-mono block uppercase font-bold">{a.category}</span>
                      <strong className="text-xs text-slate-250 block truncate font-display">{a.title}</strong>
                      <span className="text-[10px] text-slate-400 font-mono italic">{a.username || a.loginEmail}</span>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRestoreAccount(a.id)}
                        disabled={actioningId === a.id}
                        className="p-1.5 bg-[#0a0a0a] text-slate-400 hover:text-red-400 hover:bg-red-950/20 border border-red-955/60 transition-all rounded-xl cursor-pointer"
                        title="Restore to active directory"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccountPerm(a.id, a.title)}
                        disabled={actioningId === a.id}
                        className="p-1.5 bg-[#0a0a0a] text-slate-400 hover:text-red-500 hover:bg-red-950/20 border border-red-955/60 transition-all rounded-xl cursor-pointer"
                        title="Delete Permanently From Servers"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trashed Secure Notes */}
          <div className="bg-[#050505] border border-red-955/40 rounded-3xl p-6 space-y-4 text-left shadow-lg crimson-glow">
            <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 border-b border-red-955/20 pb-2.5 font-display">
              <FileText className="w-4 h-4 text-red-500" />
              Trashed Secure Notes ({deletedNotes.length})
            </h4>

            {deletedNotes.length === 0 ? (
              <p className="text-xs text-slate-505 italic py-6 text-center font-sans">No secure note cards soft-deleted.</p>
            ) : (
              <div className="divide-y divide-red-955/20 max-h-[400px] overflow-y-auto pr-1 space-y-2">
                {deletedNotes.map(n => (
                  <div key={n.id} className="pt-3 pb-3 flex items-center justify-between gap-4 first:pt-0">
                    <div className="ellipsis flex-1 text-left font-sans">
                      <span className="text-[9px] text-red-500 font-mono block uppercase font-bold">{n.category}</span>
                      <strong className="text-xs text-slate-250 block truncate font-display">{n.title}</strong>
                      <span className="text-[9px] text-slate-405 font-mono">Deleted: {n.deletedAt ? new Date(n.deletedAt).toLocaleDateString() : 'N/A'}</span>
                    </div>

                    <div className="flex gap-1.5 shrink-0 font-sans">
                      <button
                        onClick={() => handleRestoreNote(n.id)}
                        disabled={actioningId === n.id}
                        className="p-1.5 bg-[#0a0a0a] text-slate-400 hover:text-red-400 hover:bg-red-950/20 border border-red-955/60 transition-all rounded-xl cursor-pointer"
                        title="Restore Note Card"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNotePerm(n.id, n.title)}
                        disabled={actioningId === n.id}
                        className="p-1.5 bg-[#0a0a0a] text-slate-400 hover:text-red-500 hover:bg-red-950/20 border border-red-955/60 transition-all rounded-xl cursor-pointer"
                        title="Purge Note Permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
