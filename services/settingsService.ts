import { storage } from '../lib/storage';
import { AppSettings } from '../types';

export const settingsService = {
  /**
   * Get settings - combines local storage (UI state) with server credentials
   */
  get: async (): Promise<AppSettings> => {
    // 1. Get local settings (UI state like testContact)
    const localSettings = storage.settings.get();

    // 2. Get server credentials
    try {
      const response = await fetch('/api/settings/credentials');
      if (response.ok) {
        const serverData = await response.json();
        if (serverData.isConnected) {
          return {
            ...localSettings,
            phoneNumberId: serverData.phoneNumberId,
            businessAccountId: serverData.businessAccountId,
            displayPhoneNumber: serverData.displayPhoneNumber,
            verifiedName: serverData.verifiedName,
            isConnected: true,
            // Don't expose full token to frontend
            accessToken: serverData.hasToken ? '***configured***' : '',
          };
        }
      }
    } catch (error) {
      console.error('Error fetching server credentials:', error);
    }

    return localSettings;
  },

  /**
   * Save settings - credentials go to server, UI state stays local
   */
  save: async (settings: AppSettings): Promise<AppSettings> => {
    // 1. Save UI state locally (testContact, etc.)
    const uiSettings = {
      ...settings,
      // Don't save credentials locally
      accessToken: '',
    };
    storage.settings.save(uiSettings);

    // 2. If we have real credentials, save to server
    if (settings.accessToken && settings.accessToken !== '***configured***') {
      try {
        const response = await fetch('/api/settings/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumberId: settings.phoneNumberId,
            businessAccountId: settings.businessAccountId,
            accessToken: settings.accessToken,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save credentials');
        }

        const result = await response.json();
        return {
          ...settings,
          displayPhoneNumber: result.displayPhoneNumber,
          verifiedName: result.verifiedName,
          isConnected: true,
        };
      } catch (error) {
        console.error('Error saving credentials to server:', error);
        throw error;
      }
    }

    return settings;
  },

  /**
   * Disconnect - remove credentials from server
   */
  disconnect: async (): Promise<void> => {
    try {
      await fetch('/api/settings/credentials', { method: 'DELETE' });
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  },

  /**
   * Fetch phone details from Meta API
   */
  fetchPhoneDetails: async (credentials: { phoneNumberId: string, accessToken: string }) => {
    const response = await fetch('/api/settings/phone-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!response.ok) throw new Error('Failed to fetch phone details');
    return response.json();
  },

  /**
   * Get system health status
   */
  getHealth: async () => {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Failed to fetch health status');
    return response.json();
  },

  /**
   * Get AI settings
   */
  getAIConfig: async () => {
    const response = await fetch('/api/settings/ai');
    if (!response.ok) throw new Error('Failed to fetch AI settings');
    return response.json();
  },

  /**
   * Save AI settings
   */
  saveAIConfig: async (data: { apiKey?: string; provider?: string; model?: string }) => {
    const response = await fetch('/api/settings/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save AI settings');
    }

    return response.json();
  },

  /**
   * Remove API key for a specific provider
   */
  removeAIKey: async (provider: 'google' | 'openai' | 'anthropic') => {
    const response = await fetch(`/api/settings/ai?provider=${provider}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove AI key');
    }

    return response.json();
  },

  // =============================================================================
  // TEST CONTACT - Persisted in Supabase
  // =============================================================================

  /**
   * Get test contact from Supabase
   */
  getTestContact: async (): Promise<{ name?: string; phone: string } | null> => {
    try {
      const response = await fetch('/api/settings/test-contact');
      if (!response.ok) return null;
      return response.json();
    } catch (error) {
      console.error('Error fetching test contact:', error);
      return null;
    }
  },

  /**
   * Save test contact to Supabase
   */
  saveTestContact: async (contact: { name?: string; phone: string }): Promise<void> => {
    const response = await fetch('/api/settings/test-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save test contact');
    }
  },

  /**
   * Remove test contact from Supabase
   */
  removeTestContact: async (): Promise<void> => {
    const response = await fetch('/api/settings/test-contact', {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove test contact');
    }
  },
};
