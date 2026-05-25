import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Upload, Users, Smartphone, Check, MessageSquare, AlertCircle, Sparkles, RefreshCw, ShieldAlert, TrendingUp, XCircle, CheckCircle, Circle, Clock, Calendar, Search, X, UserCheck, Zap, Eye } from 'lucide-react';
import { PrefetchLink } from '@/components/ui/PrefetchLink';
import { Contact, TestContact } from '../../../types';
import { WhatsAppPhonePreview } from '@/components/ui/WhatsAppPhonePreview';

interface CampaignWizardViewProps {
  step: number;
  setStep: (step: number) => void;
  name: string;
  setName: (name: string) => void;
  campaignText: string;
  setCampaignText: (text: string) => void;
  recipientSource: 'all' | 'specific' | 'test' | null;
  setRecipientSource: (source: 'all' | 'specific' | 'test' | null) => void;
  totalContacts: number;
  recipientCount: number;
  allContacts: Contact[];
  selectedContacts: Contact[];
  selectedContactIds: string[];
  setSelectedContactIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  toggleContact: (contactId: string) => void;
  handleNext: () => void;
  handleBack: () => void;
  handleSend: (scheduledAt?: string) => void;
  isCreating: boolean;
  isLoading: boolean;
  testContact?: TestContact;
  scheduledAt: string | null;
  setScheduledAt: (date: string | null) => void;
  isScheduling: boolean;
  setIsScheduling: (isScheduling: boolean) => void;
  handleSchedule: (date: string) => void;
}

export const CampaignWizardView: React.FC<CampaignWizardViewProps> = ({
  step,
  setStep,
  name,
  setName,
  campaignText,
  setCampaignText,
  recipientSource,
  setRecipientSource,
  totalContacts,
  recipientCount,
  allContacts,
  selectedContacts,
  selectedContactIds,
  setSelectedContactIds,
  toggleContact,
  handleNext,
  handleBack,
  handleSend,
  isCreating,
  isLoading,
  testContact,
  scheduledAt,
  setScheduledAt,
  isScheduling,
  setIsScheduling,
  handleSchedule,
}) => {
  // State for scheduling
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Tag Filtering for Specific Contacts
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    allContacts.forEach(c => c.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [allContacts]);

  const filteredSpecificContacts = useMemo(() => {
    if (tagFilter === 'ALL') return allContacts;
    return allContacts.filter(c => c.tags?.includes(tagFilter));
  }, [allContacts, tagFilter]);

  if (isLoading) return <div className="text-white">Carregando assistente...</div>;

  const steps = [
    { number: 1, title: 'Configuração & Mensagem' },
    { number: 2, title: 'Público' },
    { number: 3, title: 'Revisão & Lançamento' },
  ];

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredSpecificContacts.map(c => c.id);
    setSelectedContactIds(prev => {
      const newSet = new Set(prev);
      filteredIds.forEach(id => newSet.add(id));
      return Array.from(newSet);
    });
  };

  const handleClearFiltered = () => {
    const filteredIds = new Set(filteredSpecificContacts.map(c => c.id));
    setSelectedContactIds(prev => prev.filter(id => !filteredIds.has(id)));
  };

  const isAllFilteredSelected = filteredSpecificContacts.length > 0 &&
    filteredSpecificContacts.every(c => selectedContactIds.includes(c.id));

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 lg:px-10 py-4">
      {/* Header Navigation */}
      <div className="shrink-0 mb-4">
        <PrefetchLink href="/campaigns" className="text-xs text-gray-500 hover:text-white inline-flex items-center gap-1 transition-colors">
          <ChevronLeft size={12} /> Voltar para Campanhas
        </PrefetchLink>
      </div>

      {/* Main Bar: Title, Stepper */}
      <div className="flex items-center justify-between shrink-0 mb-8 gap-8">
        <div className="shrink-0">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Criar Campanha <span className="text-sm font-normal text-gray-500 bg-zinc-900 px-3 py-1 rounded-full border border-white/10">Rascunho</span>
          </h1>
        </div>

        {/* Centralized Stepper */}
        <div className="hidden lg:block flex-1 max-w-2xl px-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-4 transform -translate-y-1/2 w-full h-0.5 bg-zinc-800 -z-10" aria-hidden="true">
              <div
                className="h-full bg-primary-600 transition-all duration-500 ease-out"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              ></div>
            </div>
            {steps.map((s) => (
              <button
                type="button"
                key={s.number}
                className="flex flex-col items-center group"
                onClick={() => step > s.number && setStep(s.number)}
                disabled={step <= s.number}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all duration-300 border-2 ${step >= s.number
                    ? 'bg-zinc-950 text-primary-400 border-primary-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-110'
                    : 'bg-zinc-950 text-gray-600 border-zinc-800 group-hover:border-zinc-700'
                    }`}
                >
                  {step > s.number ? <Check size={14} strokeWidth={3} /> : s.number}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${step >= s.number ? 'text-white' : 'text-gray-600'}`}>
                  {s.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Content - Form Area */}
        <div className="flex flex-col min-h-0 lg:col-span-8 xl:col-span-9">
          <div className="glass-panel rounded-2xl flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {/* Step 1: Configuração & Mensagem */}
            {step === 1 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto p-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Nome da Campanha</label>
                  <input
                    type="text"
                    className="w-full px-5 py-4 bg-zinc-900 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white placeholder-gray-600 text-lg font-medium"
                    placeholder="ex: Promoção de Verão"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="flex-1 flex flex-col min-h-[300px]">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Texto da Mensagem</label>
                  <textarea
                    className="w-full flex-1 p-5 bg-zinc-900 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white placeholder-gray-600 resize-none custom-scrollbar"
                    placeholder="Olá! Temos uma novidade incrível para você..."
                    value={campaignText}
                    onChange={(e) => setCampaignText(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-2 ml-1">
                    Suporta formatação padrão do WhatsApp: *negrito*, _itálico_, ~tachado~.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Público */}
            {step === 2 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto p-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Opções de Envio</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      className={`relative border rounded-xl p-5 text-left transition-all duration-300 group overflow-hidden ${recipientSource === 'all'
                        ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900'
                        }`}
                      onClick={() => setRecipientSource('all')}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${recipientSource === 'all' ? 'bg-primary-500 text-white' : 'bg-zinc-800 text-gray-400 group-hover:text-white'}`}>
                        <Users size={20} />
                      </div>
                      <h4 className={`font-semibold mb-1 ${recipientSource === 'all' ? 'text-white' : 'text-gray-300'}`}>Todos os Contatos</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">Enviar para toda sua base ({totalContacts} contatos)</p>
                    </button>

                    <button
                      className={`relative border rounded-xl p-5 text-left transition-all duration-300 group overflow-hidden ${recipientSource === 'specific'
                        ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900'
                        }`}
                      onClick={() => setRecipientSource('specific')}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${recipientSource === 'specific' ? 'bg-primary-500 text-white' : 'bg-zinc-800 text-gray-400 group-hover:text-white'}`}>
                        <CheckCircle size={20} />
                      </div>
                      <h4 className={`font-semibold mb-1 ${recipientSource === 'specific' ? 'text-white' : 'text-gray-300'}`}>Específicos</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">Selecione contatos ou filtre por tags</p>
                    </button>

                    <button
                      className={`relative border rounded-xl p-5 text-left transition-all duration-300 group overflow-hidden ${recipientSource === 'test'
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900'
                        }`}
                      onClick={() => setRecipientSource('test')}
                    >
                      {recipientSource === 'test' && (
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                      )}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors ${recipientSource === 'test' ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-800 text-gray-400 group-hover:text-white'}`}>
                        <Smartphone size={20} />
                      </div>
                      <h4 className={`font-semibold mb-1 ${recipientSource === 'test' ? 'text-white' : 'text-gray-300'}`}>Teste Interno</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">Enviar apenas para o seu número configurado</p>
                    </button>
                  </div>
                </div>

                {recipientSource === 'test' && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300 mt-6">
                    <div className="p-5 border border-amber-500/30 bg-amber-500/10 rounded-xl relative overflow-hidden">
                      <div className="flex items-start gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                          <UserCheck size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white mb-1">Modo de Teste Ativo</h4>
                          {testContact ? (
                            <p className="text-sm text-amber-200/80">
                              A campanha será enviada apenas para: <br />
                              <span className="font-bold text-white mt-1 block">{testContact.name || 'Contato'} ({testContact.phone})</span>
                            </p>
                          ) : (
                            <p className="text-sm text-red-400">
                              Nenhum contato de teste configurado. Acesse as Configurações para adicionar.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {recipientSource === 'specific' && (
                  <div className="flex-1 min-h-0 flex flex-col animate-in fade-in slide-in-from-top-4 duration-300 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Selecione os Contatos ({selectedContactIds.length} selecionados)</label>

                      {/* Tag Filter */}
                      {availableTags.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Filtrar por Tag:</span>
                          <select
                            value={tagFilter}
                            onChange={(e) => setTagFilter(e.target.value)}
                            className="bg-zinc-800 border border-white/10 text-white text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary-500"
                          >
                            <option value="ALL">Todas as Tags</option>
                            {availableTags.map(tag => (
                              <option key={tag} value={tag}>{tag}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Bulk Actions for Filtered View */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={handleSelectAllFiltered}
                        className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-white/5"
                      >
                        {tagFilter === 'ALL' ? 'Selecionar Todos' : `Selecionar Todos (${filteredSpecificContacts.length})`}
                      </button>
                      {selectedContactIds.length > 0 && (
                        <button
                          onClick={handleClearFiltered}
                          className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-gray-400 hover:text-white rounded-lg transition-colors border border-white/5"
                        >
                          Limpar Seleção
                        </button>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                      {filteredSpecificContacts.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => toggleContact(c.id)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedContactIds.includes(c.id)
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-white/5 bg-zinc-900 hover:border-white/10 hover:bg-zinc-800'
                            }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">{c.name || c.phone}</span>
                            <span className="text-xs text-gray-500">{c.phone}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {c.tags && c.tags.length > 0 && (
                              <div className="flex gap-1">
                                {c.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-gray-400 border border-white/5">
                                    {tag}
                                  </span>
                                ))}
                                {c.tags.length > 2 && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-gray-400 border border-white/5">
                                    +{c.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${selectedContactIds.includes(c.id)
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : 'border-white/20 text-transparent'
                              }`}>
                              <Check size={14} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredSpecificContacts.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-white/10 rounded-xl">
                          Nenhum contato encontrado com este filtro.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Revisão & Lançamento */}
            {step === 3 && (
              <div className="flex-1 min-h-0 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto p-6">
                <div className="bg-primary-500/5 border border-primary-500/20 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                  <h3 className="text-lg font-bold text-white mb-2 relative z-10 flex items-center gap-2">
                    <Sparkles className="text-primary-400" size={20} />
                    Pronto para Lançar
                  </h3>
                  <p className="text-sm text-gray-400 relative z-10">Revise os detalhes antes de iniciar o envio.</p>

                  <div className="grid grid-cols-2 gap-6 mt-8 relative z-10">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Destinatários</p>
                      <p className="text-2xl font-bold text-white">
                        {recipientCount.toLocaleString('pt-BR')}
                        {recipientSource === 'test' && <span className="text-sm text-amber-400 ml-2 font-normal">(Modo Teste)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Plataforma</p>
                      <p className="text-2xl font-bold text-white">EVOlution API</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock size={16} className="text-primary-400" />
                    Agendamento
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      className={`relative border rounded-xl p-4 text-left transition-all duration-300 group overflow-hidden ${scheduleMode === 'now'
                        ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900'
                        }`}
                      onClick={() => {
                        setScheduleMode('now');
                        setScheduledAt(null);
                      }}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${scheduleMode === 'now' ? 'bg-primary-500 text-white' : 'bg-zinc-800 text-gray-400 group-hover:text-white'}`}>
                        <Zap size={16} />
                      </div>
                      <h4 className={`font-semibold text-sm mb-1 ${scheduleMode === 'now' ? 'text-white' : 'text-gray-300'}`}>Enviar Agora</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">A campanha iniciará imediatamente após aprovação</p>
                    </button>

                    <button
                      className={`relative border rounded-xl p-4 text-left transition-all duration-300 group overflow-hidden ${scheduleMode === 'scheduled'
                        ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900'
                        }`}
                      onClick={() => setScheduleMode('scheduled')}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${scheduleMode === 'scheduled' ? 'bg-primary-500 text-white' : 'bg-zinc-800 text-gray-400 group-hover:text-white'}`}>
                        <Calendar size={16} />
                      </div>
                      <h4 className={`font-semibold text-sm mb-1 ${scheduleMode === 'scheduled' ? 'text-white' : 'text-gray-300'}`}>Agendar Envio</h4>
                      <p className="text-xs text-gray-500 leading-relaxed">A campanha iniciará na data e hora selecionadas</p>
                    </button>
                  </div>

                  {scheduleMode === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Data</label>
                        <input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Horário</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none transition-all text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Navigation Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-900/80 flex justify-between shrink-0">
              <button
                className={`px-6 py-3 rounded-xl font-medium transition-colors ${step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}
                onClick={handleBack}
              >
                Anterior
              </button>

              {step < 3 ? (
                <button
                  className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  onClick={handleNext}
                >
                  Próximo <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  className={`px-8 py-3 font-bold rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-colors ${isCreating
                    ? 'bg-primary-600/50 text-white cursor-wait'
                    : 'bg-primary-600 text-white hover:bg-primary-500'
                    }`}
                  onClick={() => {
                    if (scheduleMode === 'scheduled') {
                      if (!scheduledDate || !scheduledTime) {
                        return; // Handle error elsewhere
                      }
                      const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
                      handleSchedule(scheduleDateTime);
                    } else {
                      handleSend();
                    }
                  }}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>Processando...</>
                  ) : scheduleMode === 'scheduled' ? (
                    <><Calendar size={18} /> Agendar Campanha</>
                  ) : (
                    <><Upload size={18} /> Iniciar Disparo</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Content - Preview */}
        <div className="hidden lg:flex flex-col lg:col-span-4 xl:col-span-3">
          <div className="sticky top-6">
            <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
              <Eye size={16} className="text-gray-400" /> Preview
            </h3>
            <WhatsAppPhonePreview
              fallbackContent={campaignText || 'Sua mensagem aparecerá aqui...'}
              businessName={recipientSource === 'test' && testContact?.name ? testContact.name : "Nome do Contato"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
