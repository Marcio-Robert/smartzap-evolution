import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsService } from '../services/settingsService';
import { AppSettings } from '../types';
import { Database, Zap, MessageSquare } from 'lucide-react';
import React from 'react';
import { SetupStep } from '../components/features/settings/SetupWizardView';

// System health status
interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    redis: {
      status: 'ok' | 'error' | 'not_configured';
      latency?: number;
      message?: string;
    };
    qstash: {
      status: 'ok' | 'error' | 'not_configured';
      message?: string;
    };
    evolution: {
      status: 'ok' | 'error' | 'not_configured';
      instanceName?: string;
      state?: string;
      message?: string;
    };
  };
  vercel?: {
    dashboardUrl: string | null;
    storesUrl: string | null;
    env: string;
  };
  timestamp: string;
}

export const useSettingsController = () => {
  const queryClient = useQueryClient();

  // Local state for form
  const [formSettings, setFormSettings] = useState<AppSettings>({
    evoApiUrl: '',
    evoApiKey: '',
    evoInstanceName: '',
    isConnected: false
  });

  // --- Queries ---
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  });

  // AI Settings Query
  const aiSettingsQuery = useQuery({
    queryKey: ['aiSettings'],
    queryFn: settingsService.getAIConfig,
    staleTime: 60 * 1000,
  });

  // Test Contact Query - persisted in Supabase
  const testContactQuery = useQuery({
    queryKey: ['testContact'],
    queryFn: settingsService.getTestContact,
    staleTime: 60 * 1000,
  });

  // System status query (consolidated: health + usage + vercel info)
  const systemQuery = useQuery({
    queryKey: ['systemStatus'],
    queryFn: async () => {
      const response = await fetch('/api/system');
      if (!response.ok) throw new Error('Failed to fetch system status');
      return response.json();
    },
    staleTime: 60 * 1000, // Cache for 1 minute
  });

  const healthQuery = {
    data: systemQuery.data?.health ? {
      ...systemQuery.data.health,
      vercel: systemQuery.data.vercel,
      timestamp: systemQuery.data.timestamp,
    } as HealthStatus : undefined,
    isLoading: systemQuery.isLoading,
  };

  // Sync form with data when loaded
  useEffect(() => {
    if (settingsQuery.data) {
      setFormSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  // --- Mutations ---
  const saveMutation = useMutation({
    mutationFn: settingsService.save,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      toast.success('Credenciais EVOlution salvas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao conectar à instância EVO.');
    }
  });

  const saveAIMutation = useMutation({
    mutationFn: settingsService.saveAIConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
      toast.success('Configuração de IA salva com sucesso!');
    },
  });

  const removeAIMutation = useMutation({
    mutationFn: settingsService.removeAIKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiSettings'] });
    },
    onError: () => {
      toast.error('Erro ao remover chave de IA.');
    }
  });

  // Test Contact Mutations - Supabase
  const saveTestContactMutation = useMutation({
    mutationFn: settingsService.saveTestContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testContact'] });
      toast.success('Contato de teste salvo!');
    },
    onError: () => {
      toast.error('Erro ao salvar contato de teste.');
    }
  });

  const removeTestContactMutation = useMutation({
    mutationFn: settingsService.removeTestContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testContact'] });
      toast.success('Contato de teste removido!');
    },
    onError: () => {
      toast.error('Erro ao remover contato de teste.');
    }
  });

  const handleSave = async () => {
    saveMutation.mutate(formSettings);
  };

  const handleDisconnect = async () => {
    try {
      await settingsService.disconnect();
      setFormSettings({
        evoApiUrl: '',
        evoApiKey: '',
        evoInstanceName: '',
        isConnected: false
      });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['systemStatus'] });
      toast.success('Desconectado. Atualize as variáveis no Vercel se necessário.');
    } catch (e) {
      toast.error('Erro ao desconectar.');
    }
  };

  // Direct save settings (for test contact, etc.)
  const handleSaveSettings = (settings: AppSettings) => {
    setFormSettings(settings);
    saveMutation.mutate(settings);
  };

  // Build setup wizard steps based on health status
  const setupSteps = useMemo((): SetupStep[] => {
    const health = healthQuery.data;
    const storesUrl = health?.vercel?.storesUrl;
    const fallbackStoresUrl = 'https://vercel.com/dashboard/stores';

    return [
      {
        id: 'redis',
        title: 'Upstash Redis',
        description: 'Banco de dados para armazenar credenciais, estatísticas e cache. Adicione via Vercel Storage.',
        status: health?.services.redis.status === 'ok'
          ? 'configured'
          : health?.services.redis.status === 'error'
            ? 'error'
            : 'pending',
        icon: React.createElement(Database, { size: 20, className: 'text-red-400' }),
        actionLabel: 'Adicionar no Vercel',
        actionUrl: storesUrl || fallbackStoresUrl,
        errorMessage: health?.services.redis.message,
        isRequired: true,
      },
      {
        id: 'qstash',
        title: 'Upstash QStash',
        description: 'Filas de mensagens para processamento assíncrono de campanhas. Adicione via Vercel Storage.',
        status: health?.services.qstash.status === 'ok'
          ? 'configured'
          : health?.services.qstash.status === 'error'
            ? 'error'
            : 'pending',
        icon: React.createElement(Zap, { size: 20, className: 'text-purple-400' }),
        actionLabel: 'Adicionar no Vercel',
        actionUrl: storesUrl || fallbackStoresUrl,
        errorMessage: health?.services.qstash.message,
        isRequired: true,
      },
      {
        id: 'evolution',
        title: 'EVOlution API',
        description: 'Credenciais da sua instância EVO para disparo. Configure após Redis e QStash.',
        status: health?.services.evolution.status === 'ok'
          ? 'configured'
          : health?.services.evolution.status === 'error'
            ? 'error'
            : 'pending',
        icon: React.createElement(MessageSquare, { size: 20, className: 'text-emerald-400' }),
        errorMessage: health?.services.evolution.message,
        isRequired: true,
      },
    ];
  }, [healthQuery.data]);

  // Check if setup is needed
  const needsSetup = useMemo(() => {
    const health = healthQuery.data;
    if (!health) return false;

    return health.services.redis.status !== 'ok' ||
      health.services.qstash.status !== 'ok' ||
      health.services.evolution.status !== 'ok';
  }, [healthQuery.data]);

  // Check if infrastructure is ready (Redis + QStash configured)
  const infrastructureReady = useMemo(() => {
    const health = healthQuery.data;
    if (!health) return false;

    return health.services.redis.status === 'ok' && health.services.qstash.status === 'ok';
  }, [healthQuery.data]);

  const allConfigured = useMemo(() => {
    return setupSteps.every(step => step.status === 'configured');
  }, [setupSteps]);

  return {
    settings: {
      ...formSettings,
      testContact: testContactQuery.data || formSettings.testContact,
    },
    setSettings: setFormSettings,
    isLoading: settingsQuery.isLoading || testContactQuery.isLoading,
    isSaving: saveMutation.isPending,
    onSave: handleSave,
    onSaveSettings: handleSaveSettings,
    onDisconnect: handleDisconnect,
    
    // System health
    systemHealth: healthQuery.data || null,
    systemHealthLoading: healthQuery.isLoading,
    refreshSystemHealth: () => queryClient.invalidateQueries({ queryKey: ['systemStatus'] }),
    
    // Setup wizard
    setupSteps,
    needsSetup,
    infrastructureReady,
    allConfigured,
    
    // AI Settings
    aiSettings: aiSettingsQuery.data,
    aiSettingsLoading: aiSettingsQuery.isLoading,
    saveAIConfig: saveAIMutation.mutateAsync,
    removeAIKey: removeAIMutation.mutateAsync,
    isSavingAI: saveAIMutation.isPending,
    
    // Test Contact
    testContact: testContactQuery.data || null,
    testContactLoading: testContactQuery.isLoading,
    saveTestContact: saveTestContactMutation.mutateAsync,
    removeTestContact: removeTestContactMutation.mutateAsync,
    isSavingTestContact: saveTestContactMutation.isPending,
  };
};
