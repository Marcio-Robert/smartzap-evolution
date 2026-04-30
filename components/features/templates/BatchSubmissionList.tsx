import React from 'react';
import { BatchSubmission } from '../../../types';
import { ChevronRight, Trash2, Clock, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

interface BatchSubmissionListProps {
    submissions: BatchSubmission[];
    onSelectSubmission: (id: string) => void;
    onDeleteSubmission: (id: string) => void;
    isLoading?: boolean;
    hourlyCount: number; // New prop
}

export function BatchSubmissionList({
    submissions,
    onSelectSubmission,
    onDeleteSubmission,
    isLoading,
    hourlyCount
}: BatchSubmissionListProps) {
    // ... logic ...

    // Reuse the empty state if no submissions, but maybe show the limit there too?
    // Let's add the indicator above the table if submissions exist.

    // Actually, user wants it on "main screen".
    // I will add a header section above the table.

    if (isLoading && submissions.length === 0) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (submissions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-zinc-900/30 border border-zinc-800 rounded-xl border-dashed">
                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8 text-zinc-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Nenhuma submissão ainda</h3>
                <p className="text-zinc-400 text-center max-w-md mb-6">
                    Gere sua primeira levas de templates para começar a fábrica.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Rate Limit Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">Cota por Hora</p>
                        <h3 className={`text-2xl font-bold ${hourlyCount >= 100 ? 'text-red-500' : 'text-white'}`}>
                            {hourlyCount}<span className="text-zinc-600 text-base">/100</span>
                        </h3>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Clock className={`w-5 h-5 ${hourlyCount >= 80 ? 'text-amber-500' : 'text-emerald-500'}`} />
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/50">
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Progresso</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-center">Gerados</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-center">Utility</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-center">Mkt</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Criado Em</th>
                                <th className="px-6 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {submissions.map((submission) => {
                                const isProcessing = submission.status === 'processing';

                                // Progress Bar Logic
                                const total = submission.stats.total;
                                const utilityPercent = (submission.stats.utility / total) * 100;
                                const marketingPercent = (submission.stats.marketing / total) * 100;
                                const rejectedPercent = (submission.stats.rejected / total) * 100;
                                const pendingPercent = (submission.stats.pending / total) * 100;

                                return (
                                    <tr
                                        key={submission.id}
                                        className="group hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                        onClick={() => onSelectSubmission(submission.id)}
                                    >
                                        <td className="px-6 py-4 max-w-[300px]">
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0">
                                                    <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors truncate max-w-[280px]" title={submission.name}>
                                                        {submission.name}
                                                    </h3>
                                                    <span className="text-xs text-zinc-500">
                                                        {isProcessing ? 'Processando...' : 'Concluído'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 w-48">
                                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                                                <div style={{ width: `${utilityPercent}%` }} className="bg-emerald-500 transition-all duration-500" />
                                                <div style={{ width: `${marketingPercent}%` }} className="bg-yellow-500 transition-all duration-500" />
                                                <div style={{ width: `${rejectedPercent}%` }} className="bg-red-500 transition-all duration-500" />
                                                <div style={{ width: `${pendingPercent}%` }} className="bg-zinc-700 animate-pulse" />
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <span className="text-sm text-zinc-300 font-medium">{submission.stats.total}</span>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            {submission.stats.utility > 0 ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    {submission.stats.utility}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-zinc-500">-</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            {submission.stats.marketing > 0 ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                    {submission.stats.marketing}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-zinc-500">-</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-sm text-zinc-400 whitespace-nowrap">
                                            {new Date(submission.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteSubmission(submission.id);
                                                }}
                                                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Excluir submissão"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
