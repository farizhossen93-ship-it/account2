import { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, Tag, Copy, Check, Eye, EyeOff, 
  Trash2, Star, Pin, Calendar, Loader2, Info, Lock 
} from 'lucide-react';
import { Note } from '../types.js';

interface NotesProps {
  token: string | null;
  onLogAction: () => void; // Trigger list update
}

export default function NotesSection({ token, onLogAction }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  
  // Create / Edit form states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Private Note');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [saving, setSaving] = useState(false);

  // Decrypted content storage
  const [decryptedNoteId, setDecryptedNoteId] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [decrypting, setDecrypting] = useState<boolean>(false);
  const [copiedNote, setCopiedNote] = useState<boolean>(false);

  // Load notes list
  const fetchNotes = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/notes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setNotes(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [token]);

  const handleRevealNoteContent = async (note: Note) => {
    if (decryptedNoteId === note.id) {
      setDecryptedNoteId(null);
      setDecryptedContent('');
      return;
    }

    setDecrypting(true);
    try {
      const resp = await fetch(`/api/notes/${note.id}/reveal`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setDecryptedNoteId(note.id);
        setDecryptedContent(data.content);
        if (editorMode === 'edit' || isEditorOpen) {
          setEditContent(data.content);
        }
      } else {
        alert(data.error || 'Failed to decrypt note content.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDecrypting(false);
    }
  };

  const handleCreateNoteTrigger = () => {
    setEditorMode('create');
    setEditTitle('');
    setEditCategory('Private Note');
    setEditContent('');
    setEditTags('');
    setDecryptedNoteId(null);
    setDecryptedContent('');
    setIsEditorOpen(true);
  };

  const handleEditNoteTrigger = async (note: Note) => {
    setEditorMode('edit');
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditCategory(note.category);
    setEditTags(note.tags ? note.tags.join(', ') : '');
    
    setDecrypting(true);
    setIsEditorOpen(true);
    try {
      const resp = await fetch(`/api/notes/${note.id}/reveal`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        setEditContent(data.content);
        setDecryptedNoteId(note.id);
        setDecryptedContent(data.content);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDecrypting(false);
    }
  };

  const handleSaveNote = async () => {
    if (!editTitle.trim()) {
      alert('Note Title is required.');
      return;
    }
    setSaving(true);
    const tagsArr = editTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const body = {
      title: editTitle,
      category: editCategory,
      contentEncrypted: editContent,
      tags: tagsArr
    };

    try {
      const url = editorMode === 'create' ? '/api/notes' : `/api/notes/${selectedNote?.id}`;
      const method = editorMode === 'create' ? 'POST' : 'PUT';

      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (resp.ok) {
        setIsEditorOpen(false);
        fetchNotes();
        onLogAction();
        setDecryptedNoteId(null);
        setDecryptedContent('');
      } else {
        const err = await resp.json();
        alert(err.error || 'Failed to save note.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavoriteNote = async (note: Note) => {
    try {
      const resp = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isFavorite: !note.isFavorite })
      });
      if (resp.ok) {
        fetchNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePinNote = async (note: Note) => {
    try {
      const resp = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isPinned: !note.isPinned })
      });
      if (resp.ok) {
        fetchNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNote = async (note: Note) => {
    if (!confirm(`Move secure note '${note.title}' to the trash bin?`)) return;
    try {
      const resp = await fetch(`/api/notes/${note.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        fetchNotes();
        onLogAction();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyNoteContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const filteredNotes = notes.filter(n => {
    const query = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(query) ||
      n.category.toLowerCase().includes(query) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))
    );
  });

  const sortedNotes = [...filteredNotes].sort((a,b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
  });

  return (
    <div id="notes-module" className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
      {/* Sidebar: Notes directory index */}
      <div className="md:col-span-1 bg-[#050505] border border-red-955/40 rounded-3xl p-5 space-y-4 crimson-glow">
        <div className="flex items-center justify-between">
          <div className="text-left font-sans">
            <h3 className="text-sm font-bold text-slate-100 font-display">Notes Vault</h3>
            <p className="text-[10px] text-slate-500 font-mono">Encrypted private database</p>
          </div>
          <button
            id="btn-add-note"
            onClick={handleCreateNoteTrigger}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 hover:bg-red-550 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Note
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-505 pointer-events-none" />
          <input
            id="notes-search-input"
            type="text"
            placeholder="Search notes catalog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-red-955/60 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-205 focus:outline-none focus:border-red-650 font-sans"
          />
        </div>

        {/* Notes Catalog List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1" id="notes-catalog-list">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
            </div>
          ) : sortedNotes.length === 0 ? (
            <div className="text-center py-12 bg-[#0a0a0a] border border-red-955/30 rounded-2xl">
              <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No secure notes saved</p>
            </div>
          ) : (
            sortedNotes.map(n => (
              <div
                key={n.id}
                onClick={() => {
                  setSelectedNote(n);
                  if (decryptedNoteId !== n.id) {
                    setDecryptedNoteId(null);
                    setDecryptedContent('');
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left select-none ${
                  selectedNote?.id === n.id 
                    ? 'bg-[#0a0a0a] border-red-500/40 ring-1 ring-red-500/10 shadow-md' 
                    : 'bg-[#0a0a0a]/50 border-red-955/20 hover:bg-[#0c0506]/55 hover:border-red-900/40'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[9px] text-red-500 font-mono font-bold uppercase">{n.category}</span>
                  <div className="flex gap-1.5 font-sans">
                    {n.isPinned && <Pin className="w-3 h-3 text-red-500 fill-red-500" />}
                    {n.isFavorite && <Star className="w-3 h-3 text-red-500 fill-red-500" />}
                  </div>
                </div>
                <h4 className="text-xs font-semibold text-slate-200 font-display ellipsis mb-2">{n.title}</h4>
                
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                  <span>{new Date(n.creationDate).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1 bg-[#000000] px-2 py-0.5 rounded border border-red-955/50">
                    <Lock className="w-2.5 h-2.5 text-red-500/70" />
                    AES-256
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Primary Pane: Note Display & Editor */}
      <div className="md:col-span-2 bg-[#050505] border border-red-955/40 rounded-3xl p-6 min-h-[440px] flex flex-col justify-between shadow-lg crimson-glow text-left">
        {isEditorOpen ? (
          /* =================================================================
             NOTE WRITING / EDITING INTERFACE
             ================================================================= */
          <div className="space-y-4 h-full flex flex-col justify-between" id="note-editor-wrapper">
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest text-left">
                {editorMode === 'create' ? 'Record New Secure Note' : `Modifying Note: ${editTitle}`}
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] text-slate-400">Note Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Server VPS root, SSH backups"
                    className="w-full bg-[#0a0a0a] text-xs border border-red-955/60 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-red-655"
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] text-slate-400">Classification Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-[#0a0a0a] text-xs border border-red-955/60 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-red-655 cursor-pointer"
                  >
                    <option value="Private Note">Private Notes</option>
                    <option value="API Keys">API Keys</option>
                    <option value="License Keys">License Keys</option>
                    <option value="Important Links">Important Links</option>
                    <option value="Reminder">Personal Reminders</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1 flex-1 flex flex-col text-left">
                <label className="text-[10px] text-slate-400">Database Sensitive Content (Encrypted symmetrically on disk)</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Insert secure passwords, root variables, SSH files, or recovery keys..."
                  className="w-full min-h-[180px] bg-[#0a0a0a] text-xs border border-red-955/60 rounded-xl px-3 py-2 text-[#f1f5f9] font-mono leading-relaxed focus:outline-none focus:border-red-655"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] text-slate-400 flex justify-between">
                  <span>Meta tags</span>
                  <span className="text-[8px] text-slate-500">Comma-separated</span>
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="ssh, backup, private"
                  className="w-full bg-[#0a0a0a] text-xs border border-red-955/60 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-red-655"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-red-955/20 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-[#0a0a0a] hover:bg-[#111111] rounded-xl border border-red-955/35 transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-650 hover:bg-red-550 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : null}
                Save Encrypted Note
              </button>
            </div>
          </div>
        ) : selectedNote ? (
          /* =================================================================
             DETAILED SECURE NOTES PREVIEW PANE
             ================================================================= */
          <div className="space-y-5 h-full flex flex-col justify-between text-left" id="note-preview-active">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-red-955/20 pb-3">
                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-red-500 font-mono font-bold uppercase tracking-widest">
                    {selectedNote.category}
                  </span>
                  <h3 className="text-md font-extrabold text-[#f1f5f9] font-display">{selectedNote.title}</h3>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleFavoriteNote(selectedNote)}
                    className={`p-1.5 border rounded-lg transition-all cursor-pointer ${
                      selectedNote.isFavorite ? 'bg-red-950/20 border-red-900/40 text-red-500' : 'bg-[#0a0a0a] border-red-955/40 text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleTogglePinNote(selectedNote)}
                    className={`p-1.5 border rounded-lg transition-all cursor-pointer ${
                      selectedNote.isPinned ? 'bg-red-950/20 border-red-900/40 text-red-505' : 'bg-[#0a0a0a] border-red-955/40 text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleEditNoteTrigger(selectedNote)}
                    className="p-1.5 bg-[#0a0a0a] border border-red-955/40 hover:border-red-900/40 hover:text-slate-100 transition-colors rounded-lg text-slate-400 cursor-pointer"
                    title="Edit Note"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(selectedNote)}
                    className="p-1.5 bg-[#0a0a0a] border border-red-955/40 hover:bg-red-950/20 hover:text-red-400 transition-colors font-semibold text-slate-450 rounded-lg cursor-pointer"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Note body with secure Decrypt/Unlock request */}
              <div className="space-y-3 text-left">
                {decryptedNoteId === selectedNote.id ? (
                  <div className="p-4 bg-[#0a0a0a] border border-red-955/35 rounded-2xl relative group">
                    <button
                      onClick={() => copyNoteContent(decryptedContent)}
                      className="absolute right-3 top-3 p-1.5 text-slate-400 hover:text-red-500 cursor-pointer bg-[#050505] border border-red-955/60 rounded-xl"
                      title="Copy note description content"
                    >
                      {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    
                    <span className="text-[10px] text-red-500/80 font-mono uppercase block mb-3 border-b border-red-955/20 pb-1 w-[90%] font-semibold">
                      DECRYPTED NOTE SECURE DATA (AES-256 SYMMETRIC CIPHER)
                    </span>
                    <p className="text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap select-all font-medium max-h-[220px] overflow-y-auto pr-2">
                      {decryptedContent}
                    </p>
                  </div>
                ) : (
                  <div className="p-8 bg-[#0a0a0a]/50 border border-red-955/30 rounded-2xl text-center space-y-3">
                    <Lock className="w-8 h-8 text-red-500 mx-auto animate-pulse" />
                    <p className="text-xs text-slate-405 max-w-sm mx-auto font-sans">
                      All contents of note <strong className="text-slate-300">{selectedNote.title}</strong> are encrypted symmetrically with your AES-255 cipher key.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRevealNoteContent(selectedNote)}
                      disabled={decrypting}
                      className="px-4 py-2 bg-red-950/20 border border-red-900/30 hover:bg-red-900/10 text-red-500 hover:text-red-400 transition-colors text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                    >
                      {decrypting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <Eye className="w-3.5 h-3.5" />}
                      Unlock Note Card
                    </button>
                  </div>
                )}
                
                {selectedNote.notes && (
                  <div className="text-xs bg-[#0a0a0a] p-3.5 rounded-2xl border border-red-955/30 text-left">
                    <span className="text-[10px] text-slate-500 font-mono block">Additional Metadata Notes:</span>
                    <p className="text-slate-300 whitespace-pre-line leading-relaxed">{selectedNote.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Note metadata footer */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-red-955/20 pt-5 text-left shrink-0">
              <div className="flex gap-1.5 flex-wrap">
                {selectedNote.tags && selectedNote.tags.length > 0 ? (
                  selectedNote.tags.map((t, idx) => (
                    <span key={idx} className="bg-[#0a0a0a] text-red-400 text-[10px] px-2.5 py-0.5 rounded-full border border-red-955/35 font-mono">
                      #{t}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-505 font-mono italic">No tags associated</span>
                )}
              </div>

              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                <Calendar className="w-3 h-3 text-red-500" />
                Updated: {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedNote.creationDate))}
              </span>
            </div>
          </div>
        ) : (
          /* =================================================================
             DEFAULT WELCOME CARD
             ================================================================= */
          <div className="flex flex-col items-center justify-center text-center space-y-3 py-16 my-auto" id="notes-welcome-card">
            <div className="p-3 bg-[#0a0a0a] rounded-2xl border border-red-955/35">
              <FileText className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-1">
              <h5 className="text-sm font-bold text-slate-300 font-display">Secured Notes Vault</h5>
              <p className="text-xs text-slate-500 max-w-sm font-sans mx-auto">Select any private secure note from the directory search, or click &quot;Add Note&quot; to compile database keys, recovery backup pins, notes or files.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
