import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, ensureAuth } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Trash2, Play, Edit3, History, Save, Lock } from 'lucide-react';
import { cn } from '../lib/utils';

const generateId = () => Math.random().toString(36).substring(2, 8);

export default function Dashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('oneq_admin_auth') === '1004');
    const [passwordInput, setPasswordInput] = useState('');
    const [title, setTitle] = useState('');
    const [options, setOptions] = useState([{ id: generateId(), text: '' }, { id: generateId(), text: '' }]);
    const [loading, setLoading] = useState(false);
    const [myQuestions, setMyQuestions] = useState<any[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [fetchingList, setFetchingList] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMyQuestions = async () => {
            try {
                await ensureAuth();
                const ids: string[] = JSON.parse(localStorage.getItem('oneq_my_questions') || '[]');
                const qList = [];
                // Fetch in reverse order (newest first)
                for (let i = ids.length - 1; i >= 0; i--) {
                    const snap = await getDoc(doc(db, 'questions', ids[i]));
                    if (snap.exists()) {
                        qList.push({ id: ids[i], ...snap.data() });
                    }
                }
                setMyQuestions(qList);
            } catch (err) {
                console.error("Failed to fetch past questions", err);
            } finally {
                setFetchingList(false);
            }
        };
        fetchMyQuestions();
    }, []);

    const loadQuestionForEdit = (q: any) => {
        setTitle(q.title);
        // Ensure options have valid structure just in case
        setOptions(q.options || [{ id: generateId(), text: '' }, { id: generateId(), text: '' }]);
        setEditingId(q.id);
    };

    const handleClearForm = () => {
        setTitle('');
        setOptions([{ id: generateId(), text: '' }, { id: generateId(), text: '' }]);
        setEditingId(null);
    };

    const handleRemoveQuestion = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent triggering other clicks if we change layout
        if (!confirm('Are you sure you want to permanently delete this question?')) return;

        try {
            await ensureAuth();

            // Remove from Firebase (both question and stats)
            await deleteDoc(doc(db, 'questions', id));
            await deleteDoc(doc(db, 'stats', id));
            await deleteDoc(doc(db, 'streams', id));

            // Remove from local storage history
            const ids: string[] = JSON.parse(localStorage.getItem('oneq_my_questions') || '[]');
            const newIds = ids.filter(qId => qId !== id);
            localStorage.setItem('oneq_my_questions', JSON.stringify(newIds));

            // Remove from UI state
            setMyQuestions(prev => prev.filter(q => q.id !== id));

            // If deleting the currently edited question, clear the form
            if (editingId === id) {
                handleClearForm();
            }
        } catch (error) {
            console.error('Failed to delete question', error);
            alert('Error deleting question. Please check permissions.');
        }
    };

    const handleAddOption = () => {
        if (options.length < 6) {
            setOptions([...options, { id: generateId(), text: '' }]);
        }
    };

    const handleRemoveOption = (id: string) => {
        if (options.length > 2) {
            setOptions(options.filter(o => o.id !== id));
        }
    };

    const handleOptionChange = (id: string, text: string) => {
        setOptions(options.map(o => o.id === id ? { ...o, text } : o));
    };

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || options.some(o => !o.text.trim())) return;

        setLoading(true);
        const questionId = editingId || generateId();

        try {
            await ensureAuth();

            if (editingId) {
                // Update existing
                await updateDoc(doc(db, 'questions', questionId), {
                    title,
                    options,
                    // keep status and createdAt intact
                });
            } else {
                // Create new
                await setDoc(doc(db, 'questions', questionId), {
                    title,
                    options,
                    status: 'active',
                    createdAt: Date.now()
                });

                // Initialize stats
                const initialStats: Record<string, number> = {};
                options.forEach(o => initialStats[o.id] = 0);
                await setDoc(doc(db, 'stats', questionId), {
                    counts: initialStats,
                    total: 0
                });

                // Save to local storage history
                const ids: string[] = JSON.parse(localStorage.getItem('oneq_my_questions') || '[]');
                if (!ids.includes(questionId)) {
                    ids.push(questionId);
                    localStorage.setItem('oneq_my_questions', JSON.stringify(ids));
                }
            }

            navigate(`/present/${questionId}`);
        } catch (error: any) {
            console.error('Failed to save question', error);
            alert(`Error saving question: ${error.message}\n\nPlease ensure Anonymous Authentication is enabled in the Firebase Console.`);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-transparent relative z-10">
                <div className="glass-panel p-10 max-w-sm w-full text-center flex flex-col items-center animate-slide-up">
                    <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mb-6 shadow-inner border border-white/5 text-slate-400">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-200 mb-2">Teacher Login</h1>
                    <p className="text-slate-500 mb-8 text-sm">Please enter the security PIN to access the dashboard.</p>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (passwordInput === '1004') {
                            sessionStorage.setItem('oneq_admin_auth', '1004');
                            setIsAuthenticated(true);
                        } else {
                            alert('Incorrect PIN');
                            setPasswordInput('');
                        }
                    }} className="w-full flex gap-3">
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="glass-input flex-1 text-center text-xl tracking-widest"
                            placeholder="••••"
                            autoFocus
                        />
                        <button type="submit" className="px-6 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold hover:bg-indigo-500/30 transition-colors border border-indigo-500/20 hover:border-indigo-500/40">
                            Enter
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-transparent">

            <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl animate-slide-up">

                {/* Master Form Area */}
                <div className="glass-panel flex-1 p-8 md:p-12 relative overflow-hidden">
                    {editingId && (
                        <div className="absolute top-0 inset-x-0 h-1 bg-amber-500 animate-pulse" />
                    )}

                    <div className="mb-10 text-center relative">
                        {editingId && (
                            <button
                                type="button"
                                onClick={handleClearForm}
                                className="absolute left-0 top-1/2 -translate-y-1/2 px-4 py-2 text-sm font-medium text-slate-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            >
                                Cancel Edit
                            </button>
                        )}
                        <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-5xl md:text-6xl font-black text-transparent mb-4 tracking-tight">
                            OneQ
                        </h1>
                        <p className="text-slate-400 text-lg">Single Question Interactive Polling</p>
                    </div>

                    <form onSubmit={handleCreateOrUpdate} className="space-y-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">The Question</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. What's our next tech stack?"
                                className="glass-input w-full text-xl py-4"
                                required
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-slate-300">Options</label>
                                <span className="text-xs text-slate-500 font-mono">{options.length} / 6 MAX</span>
                            </div>

                            {options.map((opt, idx) => (
                                <div key={opt.id} className="flex gap-3 relative group">
                                    <div className="flex items-center justify-center w-10 h-10 my-auto rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold shrink-0">
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <input
                                        type="text"
                                        value={opt.text}
                                        onChange={e => handleOptionChange(opt.id, e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                        className="glass-input flex-1 transition-all focus:-translate-y-0.5"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(opt.id)}
                                        className={cn(
                                            "p-3 rounded-xl transition-all h-full my-auto",
                                            options.length <= 2
                                                ? "text-slate-600 cursor-not-allowed opacity-50"
                                                : "text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                                        )}
                                        disabled={options.length <= 2}
                                        title="Remove Option"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ))}

                            {options.length < 6 && (
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="w-full py-4 mt-2 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 font-medium"
                                >
                                    <Plus size={18} /> Add Option
                                </button>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 py-4 text-xl mt-8 shadow-xl relative overflow-hidden rounded-xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
                                editingId
                                    ? "bg-gradient-to-r from-amber-500 to-orange-600 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                                    : "bg-gradient-to-r from-indigo-500 to-purple-600 shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)]"
                            )}
                        >
                            {loading ? (
                                <span className="animate-pulse">{editingId ? 'Saving...' : 'Creating...'}</span>
                            ) : (
                                <>
                                    {editingId ? 'Save Changes & Play' : 'Launch Interactive Poll'}
                                    {editingId ? <Save size={20} className="ml-2" /> : <Play fill="currentColor" size={20} className="ml-2" />}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Sidebar Question Database */}
                <div className="glass-panel w-full md:w-80 flex flex-col p-6 h-[80vh] md:h-auto overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10 text-slate-300">
                        <History size={20} className="text-indigo-400" />
                        <h2 className="font-bold text-lg">My Questions</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {fetchingList ? (
                            <p className="text-slate-500 text-sm animate-pulse text-center mt-10">Loading history...</p>
                        ) : myQuestions.length === 0 ? (
                            <div className="text-center mt-10 text-slate-500 text-sm">
                                <p>No previous questions found.</p>
                                <p className="mt-2 text-xs opacity-70">Questions you build here will be saved to your dashboard.</p>
                            </div>
                        ) : (
                            myQuestions.map(q => (
                                <div
                                    key={q.id}
                                    className={cn(
                                        "bg-white/5 border rounded-xl p-4 transition-all group",
                                        editingId === q.id
                                            ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-amber-500/5"
                                            : "border-white/5 hover:border-indigo-500/30 hover:bg-white/10"
                                    )}
                                >
                                    <h3 className="font-bold text-slate-200 line-clamp-2 leading-tight mb-2">
                                        {q.title}
                                    </h3>
                                    <div className="flex justify-between items-center mt-3">
                                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                            <span className={cn(
                                                "w-2 h-2 rounded-full",
                                                q.status === 'active' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500"
                                            )} />
                                            {q.status}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => loadQuestionForEdit(q)}
                                                className="p-1.5 text-slate-400 hover:text-amber-400 bg-black/20 hover:bg-amber-500/20 rounded-lg transition-colors"
                                                title="Edit Question"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => navigate(`/present/${q.id}`)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-400 bg-black/20 hover:bg-indigo-500/20 rounded-lg transition-colors"
                                                title="Present"
                                            >
                                                <Play fill="currentColor" size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleRemoveQuestion(q.id, e)}
                                                className="p-1.5 text-slate-400 hover:text-rose-400 bg-black/20 hover:bg-rose-500/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
