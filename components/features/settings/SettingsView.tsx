import React, { useState } from 'react';
import { AlertTriangle, HelpCircle, Save, RefreshCw, Wifi, Edit2, UserCheck, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { AppSettings } from '../../../types';
import { AISettings } from './AISettings';

interface SettingsViewProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onSaveSettings: (settings: AppSettings) => void;
  onDisconnect: () => void;
  hideHeader?: boolean;

  // AI Settings
  aiSettings?: any;
  aiSettingsLoading?: boolean;
  saveAIConfig?: (data: { apiKey?: string; provider?: string; model?: string }) => Promise<void>;
  removeAIKey?: (provider: 'google' | 'openai' | 'anthropic') => Promise<void>;
  isSavingAI?: boolean;
  
  // Test Contact
  testContact?: { name?: string; phone: string } | null;
  saveTestContact?: (contact: { name?: string; phone: string }) => Promise<void>;
  removeTestContact?: () => Promise<void>;
  isSavingTestContact?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  setSettings,
  isLoading,
  isSaving,
  onSave,
  onDisconnect,
  hideHeader,
  
  // AI Props
  aiSettings,
  aiSettingsLoading,
  saveAIConfig,
  removeAIKey,
  isSavingAI,
  
  // Test Contact Props
  testContact,
  saveTestContact,
  removeTestContact,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Test contact editing
  const [isEditingTestContact, setIsEditingTestContact] = useState(false);
  const [testContactName, setTestContactName] = useState(testContact?.name || '');
  const [testContactPhone, setTestContactPhone] = useState(testContact?.phone || '');

  const handleSaveTestContact = async () => {
    if (!testContactPhone.trim()) {
      toast.error('Preencha o telefone do contato de teste');
      return;
    }

    if (!saveTestContact) return;

    try {
      await saveTestContact({
        name: testContactName.trim(),
        phone: testContactPhone.trim().replace(/\D/g, ''),
      });
      setIsEditingTestContact(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRemoveTestContact = async () => {
    if (!removeTestContact) return;

    try {
      await removeTestContact();
      setTestContactName('');
      setTestContactPhone('');
    } catch {
      // Error handled by mutation
    }
  };

  if (isLoading) return <div className="text-white">Carregando configurações...</div>;

  return (
    <div>
      {!hideHeader && (
        <>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Configurações</h1>
          <p className="text-gray-400 mb-10">Gerencie sua conexão com a EVOlution API</p>
        </>
      )}

      <div className="space-y-8">
        {/* Status Card */}
        <div className={`glass-panel rounded-2xl p-8 flex items-start gap-6 border transition-all duration-500 ${settings.isConnected ? 'border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]'}`}>
          <div className={`p-4 rounded-2xl ${settings.isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {settings.isConnected ? <Wifi size={32} /> : <AlertTriangle size={32} />}
          </div>
          <div className="flex-1">
            <h3 className={`text-xl font-bold ${settings.isConnected ? 'text-white' : 'text-white'}`}>
              {settings.isConnected ? 'Instância EVOlution Conectada' : 'Desconectado'}
            </h3>

            <div className={`text-sm mt-3 space-y-1.5 ${settings.isConnected ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
              {settings.isConnected ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="opacity-70">Instância:</span>
                    <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">{settings.evoInstanceName}</span>
                  </div>
                  {settings.verifiedName && (
                    <div className="flex items-center gap-2">
                      <span className="opacity-70">Estado:</span>
                      <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {settings.verifiedName}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Para trocar as credenciais, atualize as variáveis de ambiente (EVO_API_URL, EVO_API_KEY, EVO_INSTANCE_NAME) no painel da Vercel.
                  </p>
                </>
              ) : (
                <p>Configuração EVO ausente ou inválida. Preencha os campos abaixo para validar ou configure no seu `.env`.</p>
              )}
            </div>
          </div>

          {settings.isConnected && (
            <div className="flex flex-col gap-3 min-w-[140px]">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`group relative overflow-hidden rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2
                  ${isEditing
                    ? 'bg-white text-black shadow-lg hover:bg-gray-100'
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:border-white/20'
                  }`}
              >
                <Edit2 size={14} className={`transition-transform duration-500 ${isEditing ? 'rotate-45' : 'group-hover:scale-110'}`} />
                {isEditing ? 'Cancelar' : 'Editar Env Vars'}
              </button>

              <button
                onClick={onDisconnect}
                className="text-xs font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/5 px-4 py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>

        {/* AI Settings Section */}
        {settings.isConnected && saveAIConfig && (
          <AISettings
            settings={aiSettings}
            isLoading={!!aiSettingsLoading}
            onSave={saveAIConfig}
            onRemoveKey={removeAIKey}
            isSaving={!!isSavingAI}
          />
        )}

        {/* Form - Only visible if disconnected OR editing */}
        {(!settings.isConnected || isEditing) && (
          <div className="glass-panel rounded-2xl p-8 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-semibold text-white mb-8 flex items-center gap-2">
              <span className="w-1 h-6 bg-primary-500 rounded-full"></span>
              Configuração da EVOlution API
            </h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL da API (EVO_API_URL) <span className="text-primary-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="url"
                    value={settings.evoApiUrl || ''}
                    onChange={(e) => setSettings({ ...settings, evoApiUrl: e.target.value })}
                    placeholder="ex: https://api.sua-evo.com"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none font-mono text-sm text-white transition-all group-hover:border-white/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome da Instância (EVO_INSTANCE_NAME) <span className="text-primary-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={settings.evoInstanceName || ''}
                    onChange={(e) => setSettings({ ...settings, evoInstanceName: e.target.value })}
                    placeholder="ex: smartzap-evo"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none font-mono text-sm text-white transition-all group-hover:border-white/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Global API Key (EVO_API_KEY) <span className="text-primary-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    value={settings.evoApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, evoApiKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 outline-none font-mono text-sm text-white transition-all group-hover:border-white/20 tracking-widest"
                  />
                  <div className="absolute right-4 top-3.5 text-gray-600 cursor-help hover:text-white transition-colors" title="Sua chave global da EVO API">
                    <HelpCircle size={16} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 font-mono">As credenciais serão validadas e recomendadas para armazenamento em variáveis de ambiente.</p>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-white/5 flex justify-end gap-4">
              <button
                className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                onClick={() => {
                  onSave();
                  setIsEditing(false);
                }}
                disabled={isSaving}
              >
                <Save size={18} /> {isSaving ? 'Validando...' : 'Validar Configuração'}
              </button>
            </div>
          </div>
        )}

        {/* Test Contact Section */}
        {settings.isConnected && (
          <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-amber-500 rounded-full"></span>
              Contato de Teste
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Configure um número para testar suas campanhas antes de enviar para todos os contatos.
            </p>

            {testContact && !isEditingTestContact ? (
              // Show saved test contact
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <UserCheck size={24} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{testContact.name || 'Contato de Teste'}</p>
                    <p className="text-sm text-amber-400 font-mono">+{testContact.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTestContactName(testContact?.name || '');
                      setTestContactPhone(testContact?.phone || '');
                      setIsEditingTestContact(true);
                    }}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleRemoveTestContact}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              // Form to add/edit test contact
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={testContactName}
                      onChange={(e) => setTestContactName(e.target.value)}
                      placeholder="Ex: Meu Teste"
                      className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none text-sm text-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Telefone (com código do país)
                    </label>
                    <input
                      type="tel"
                      value={testContactPhone}
                      onChange={(e) => setTestContactPhone(e.target.value)}
                      placeholder="Ex: 5511999999999"
                      className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none text-sm text-white font-mono transition-all"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  {isEditingTestContact && (
                    <button
                      onClick={() => {
                        setIsEditingTestContact(false);
                        setTestContactName(testContact?.name || '');
                        setTestContactPhone(testContact?.phone || '');
                      }}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={handleSaveTestContact}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Smartphone size={16} />
                    Salvar Contato de Teste
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
