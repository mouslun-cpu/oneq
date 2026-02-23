import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, ensureAuth } from '../lib/firebase';
import { doc, onSnapshot, setDoc, runTransaction } from 'firebase/firestore';
import { CheckCircle } from 'lucide-react';

export default function StudentView() {
    const { questionId } = useParams<{ questionId: string }>();
    const [question, setQuestion] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [votedId, setVotedId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!questionId) return;

        // Check local storage for previous vote
        const savedVote = localStorage.getItem(`oneq_vote_${questionId}`);
        if (savedVote) setVotedId(savedVote);

        const setup = async () => {
            try {
                await ensureAuth();
                const qRef = doc(db, 'questions', questionId);
                const unsubscribe = onSnapshot(qRef, (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.data();

                        // Check for reset
                        if (data.lastResetAt) {
                            const localReset = localStorage.getItem(`oneq_reset_${questionId}`);
                            if (localReset !== data.lastResetAt.toString()) {
                                // A reset happened!
                                localStorage.removeItem(`oneq_vote_${questionId}`);
                                localStorage.setItem(`oneq_reset_${questionId}`, data.lastResetAt.toString());
                                setVotedId(null); // Clear local vote state
                            }
                        }

                        setQuestion(data);
                    } else {
                        setQuestion(null);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Firestore read error:", error);
                    setLoading(false);
                });
                return unsubscribe;
            } catch (error) {
                console.error("Auth error:", error);
                setLoading(false);
            }
        };

        let unsubFunc: (() => void) | undefined;
        setup().then(unsub => { unsubFunc = unsub; });

        return () => {
            if (unsubFunc) unsubFunc();
        };
    }, [questionId]);

    const handleVote = async (optionId: string) => {
        if (!questionId || votedId || question?.status !== 'active') return;

        setSubmitting(true);
        try {
            await ensureAuth();
            // 1. Transaction to gracefully increment count
            const statsRef = doc(db, 'stats', questionId);
            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(statsRef);
                if (!sfDoc.exists()) throw "Document does not exist!";

                const currentData = sfDoc.data() as any;
                if (!currentData.counts) currentData.counts = {};
                currentData.counts[optionId] = (currentData.counts[optionId] || 0) + 1;
                currentData.total = (currentData.total || 0) + 1;

                transaction.update(statsRef, currentData);
            });

            // 2. Log answer anonymously to trigger specific D3 node animation per-user (optional but helpful)
            const userId = localStorage.getItem('oneq_uid') || Math.random().toString(36).substring(2, 12);
            localStorage.setItem('oneq_uid', userId);
            // We push a unique event entry into 'streams' for the particle animation engine to easily catch
            const eventRef = doc(db, 'streams', questionId, 'events', userId);
            await setDoc(eventRef, {
                optionId,
                timestamp: Date.now()
            });

            // 3. Mark locally
            localStorage.setItem(`oneq_vote_${questionId}`, optionId);
            if (question?.lastResetAt) {
                localStorage.setItem(`oneq_reset_${questionId}`, question.lastResetAt.toString());
            }
            setVotedId(optionId);
        } catch (err) {
            console.error('Vote failed', err);
            alert('Failed to submit vote. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center p-6"><p className="animate-pulse text-slate-400">Loading...</p></div>;
    if (!question) return <div className="flex min-h-screen items-center justify-center p-6"><p className="text-rose-400 text-xl font-bold">Question not found.</p></div>;

    return (
        <div className="flex flex-col min-h-screen p-6 max-w-md mx-auto relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-slate-950 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.2),rgba(255,255,255,0))]" />

            <div className="mt-8 mb-10 text-center animate-fade-in">
                <h2 className="text-3xl font-black tracking-tight leading-snug">{question.title}</h2>
                {question.status === 'ended' && (
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/20 text-rose-300 text-sm font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                        Voting Ended
                    </div>
                )}
            </div>

            {votedId ? (
                <div className="flex-1 flex flex-col items-center justify-center animate-slide-up text-center">
                    <div className="w-28 h-28 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                        <CheckCircle size={56} />
                    </div>
                    <h3 className="text-3xl font-black mb-3 text-white">Vote Submitted</h3>
                    <p className="text-slate-400 text-lg">Look at the big screen to see the results.</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-4 animate-slide-up">
                    {question.options.map((opt: any, idx: number) => (
                        <button
                            key={opt.id}
                            onClick={() => handleVote(opt.id)}
                            disabled={submitting || question.status !== 'active'}
                            className="glass-panel w-full p-6 text-left relative overflow-hidden group hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(99,102,241,0.2)] hover:border-indigo-500/50 transition-all duration-300"
                        >
                            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 text-slate-300 font-bold shrink-0 shadow-inner group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span className="text-xl font-bold group-hover:text-white transition-colors text-slate-100">{opt.text}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
