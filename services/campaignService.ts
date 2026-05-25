import { Campaign, CampaignStatus, Message, MessageStatus } from '../types';

interface CreateCampaignInput {
  name: string;
  campaignText: string;        // Texto livre da campanha
  recipients: number;
  selectedContacts?: { name: string; phone: string }[];
  selectedContactIds?: string[];  // For resume functionality
  scheduledAt?: string;           // ISO timestamp for scheduling
}

interface RealMessageStatus {
  phone: string;
  status: 'sent' | 'failed';
  messageId?: string;
  error?: string;
  timestamp?: string;
  sentAt?: string;
}

interface CampaignStatusResponse {
  campaignId: string;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    total: number;
  };
  messages: RealMessageStatus[];
}

export const campaignService = {
  getAll: async (): Promise<Campaign[]> => {
    const response = await fetch('/api/campaigns');
    if (!response.ok) {
      console.error('Failed to fetch campaigns:', response.statusText);
      return [];
    }
    return response.json();
  },

  getById: async (id: string): Promise<Campaign | undefined> => {
    const response = await fetch(`/api/campaigns/${id}`);
    if (!response.ok) {
      if (response.status === 404) return undefined;
      console.error('Failed to fetch campaign:', response.statusText);
      return undefined;
    }

    const campaign = await response.json();

    // Strategy: Use Redis for real-time stats while campaign is active
    const isActive = campaign.status === 'Enviando' || campaign.status === 'Agendado';

    if (isActive) {
      try {
        const statusResponse = await fetch(`/api/campaign/${id}/status`);
        if (statusResponse.ok) {
          const realStatus: CampaignStatusResponse = await statusResponse.json();
          if (realStatus.stats.sent > 0 || realStatus.stats.failed > 0) {
            return {
              ...campaign,
              sent: realStatus.stats.sent,
              delivered: realStatus.stats.delivered,
              read: realStatus.stats.read,
              failed: realStatus.stats.failed,
            };
          }
        }
      } catch (e) {
        console.warn('Failed to fetch Redis stats, using database:', e);
      }
    }

    return campaign;
  },

  // INSTANT: Get pending messages - returns empty array (real data comes from getMessages)
  getPendingMessages: (_id: string): Message[] => {
    return [];
  },

  // ASYNC: Get real message status from campaign_contacts table (paginated)
  getMessages: async (id: string, options?: { limit?: number; offset?: number; status?: string }): Promise<{
    messages: Message[];
    stats: { total: number; pending: number; sent: number; delivered: number; read: number; failed: number };
    pagination: { limit: number; offset: number; total: number; hasMore: boolean };
  }> => {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.status) params.set('status', options.status);

    const url = `/api/campaigns/${id}/messages${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch messages:', response.statusText);
      return { messages: [], stats: { total: 0, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 }, pagination: { limit: 50, offset: 0, total: 0, hasMore: false } };
    }
    return response.json();
  },

  // Fetch real-time status from Redis
  getRealStatus: async (id: string): Promise<CampaignStatusResponse | null> => {
    try {
      const response = await fetch(`/api/campaign/${id}/status`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch real status:', error);
    }
    return null;
  },

  create: async (input: CreateCampaignInput): Promise<Campaign> => {
    const { name, campaignText, recipients, selectedContacts, selectedContactIds, scheduledAt } = input;

    // 1. Create campaign in Database (source of truth) with contacts
    const response = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        campaignText,
        recipients,
        scheduledAt,
        selectedContactIds,
        contacts: selectedContacts,
        status: scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.SENDING,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create campaign');
    }

    const newCampaign = await response.json();

    // 2. Dispatch to Backend (Execution or Scheduling)
    if (selectedContacts && selectedContacts.length > 0) {
      await campaignService.dispatchToBackend(newCampaign.id, campaignText, selectedContacts, scheduledAt);
    }

    return newCampaign;
  },

  // Internal: dispatch campaign to backend queue
  dispatchToBackend: async (campaignId: string, campaignText: string, contacts?: { name: string; phone: string }[], scheduledAt?: string): Promise<boolean> => {
    try {
      if (!contacts || contacts.length === 0) {
        console.error('No contacts provided for dispatch');
        return false;
      }

      const response = await fetch('/api/campaign/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          campaignText,
          contacts,
          scheduledAt,
        })
      });

      if (!response.ok) {
        console.error('Dispatch failed:', await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to dispatch campaign to backend:', error);
      return false;
    }
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to delete campaign');
    }
  },

  duplicate: async (id: string): Promise<Campaign> => {
    const response = await fetch(`/api/campaigns/${id}/duplicate`, { method: 'POST' });
    if (!response.ok) {
      throw new Error('Failed to duplicate campaign');
    }
    return response.json();
  },

  // Pause a running campaign
  pause: async (id: string): Promise<Campaign | undefined> => {
    const updateResponse = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: CampaignStatus.PAUSED,
        pausedAt: new Date().toISOString(),
      }),
    });

    if (!updateResponse.ok) {
      console.error('Failed to pause campaign in Database');
      return undefined;
    }

    const campaign = await updateResponse.json();

    try {
      await fetch(`/api/campaign/${id}/pause`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to pause campaign on backend:', error);
    }

    return campaign;
  },

  // Resume a paused campaign
  resume: async (id: string): Promise<Campaign | undefined> => {
    const campaign = await campaignService.getById(id);
    if (!campaign) return undefined;

    const updateResponse = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: CampaignStatus.SENDING,
        pausedAt: null,
      }),
    });

    if (!updateResponse.ok) {
      console.error('Failed to resume campaign in Database');
      return undefined;
    }

    const updatedCampaign = await updateResponse.json();

    try {
      await fetch(`/api/campaign/${id}/resume`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to resume campaign on backend:', error);
    }

    return updatedCampaign;
  },

  // Start a scheduled or draft campaign immediately
  start: async (id: string): Promise<Campaign | undefined> => {
    console.log('🚀 Starting campaign:', { id });

    const campaignData = await campaignService.getById(id);
    if (!campaignData) {
      console.error('❌ Campaign not found!');
      return undefined;
    }

    // Get campaign contacts from Database (campaign_contacts table)
    const messagesResponse = await fetch(`/api/campaigns/${id}/messages`);
    let contacts: { name: string; phone: string }[] = [];

    if (messagesResponse.ok) {
      const messages = await messagesResponse.json();
      contacts = messages.map((m: { contactName: string; contactPhone: string }) => ({
        name: m.contactName,
        phone: m.contactPhone,
      }));
    }

    if (contacts.length === 0) {
      console.error('❌ No contacts found for campaign!');
      return undefined;
    }

    console.log('📋 Found contacts:', contacts.length);

    // Update status in Database
    const updateResponse = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: CampaignStatus.SENDING,
        startedAt: new Date().toISOString(),
        scheduledAt: null,
      }),
    });

    if (!updateResponse.ok) {
      console.error('Failed to start campaign in Database');
      return undefined;
    }

    const campaign = await updateResponse.json();

    console.log('📤 Dispatching to backend with contacts:', contacts.length);

    const success = await campaignService.dispatchToBackend(
      id,
      campaign.campaignText || campaignData.campaignText,
      contacts
    );

    console.log('📤 Dispatch result:', success ? '✅ Success' : '❌ Failed');

    return campaign;
  },

  // Update campaign stats from real-time polling
  updateStats: async (id: string): Promise<Campaign | undefined> => {
    const realStatus = await campaignService.getRealStatus(id);

    if (realStatus && realStatus.stats.total > 0) {
      const campaign = await campaignService.getById(id);
      if (!campaign) return undefined;

      const isComplete = realStatus.stats.sent + realStatus.stats.failed >= campaign.recipients;

      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sent: realStatus.stats.sent,
          delivered: realStatus.stats.delivered,
          read: realStatus.stats.read,
          failed: realStatus.stats.failed,
          status: isComplete ? CampaignStatus.COMPLETED : campaign.status,
          completedAt: isComplete ? new Date().toISOString() : undefined,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update campaign stats');
        return campaign;
      }

      return response.json();
    }

    return campaignService.getById(id);
  }
};
