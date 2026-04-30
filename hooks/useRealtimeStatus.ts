/**
 * Real-time Campaign Status Hook
 * 
 * Provides automatic polling for campaign status updates.
 * Polls every 2 seconds while campaign is SENDING, stops when complete.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignService } from '../services';
import { Campaign, CampaignStatus } from '../types';

interface UseRealtimeStatusOptions {
  /** Polling interval in milliseconds (default: 2000) */
  interval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
}

/**
 * Hook for real-time campaign status updates
 * 
 * @param campaignId - The campaign ID to monitor
 * @param options - Configuration options
 * @returns Campaign data and status
 */
export const useRealtimeStatus = (
  campaignId: string | undefined,
  options: UseRealtimeStatusOptions = {}
) => {
  const { interval = 2000, enabled = true } = options;
  const queryClient = useQueryClient();
  const pollCountRef = useRef(0);

  // Main campaign query
  const {
    data: campaign,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => campaignService.getById(campaignId!),
    enabled: !!campaignId && enabled && !campaignId.startsWith('temp_'), // Don't fetch temp campaigns from API
    staleTime: 1000, // Consider data stale after 1 second
    refetchOnMount: 'always', // Always fetch fresh data when component mounts
  });
  
  // For temp campaigns, use cached data directly
  const cachedCampaign = queryClient.getQueryData<Campaign>(['campaign', campaignId]);

  // Determine if we should be polling
  const shouldPoll = useCallback(() => {
    if (!campaign || !enabled) return false;
    
    // NEVER poll completed campaigns
    if (campaign.status === CampaignStatus.COMPLETED) return false;
    
    // NEVER poll failed campaigns
    if (campaign.status === CampaignStatus.FAILED) return false;
    
    // NEVER poll paused campaigns
    if (campaign.status === CampaignStatus.PAUSED) return false;
    
    // NEVER poll draft campaigns
    if (campaign.status === CampaignStatus.DRAFT) return false;
    
    // Check if all messages have been processed (sent + failed >= recipients)
    const totalProcessed = (campaign.sent || 0) + (campaign.failed || 0);
    const isComplete = totalProcessed >= (campaign.recipients || 0);
    
    // If all processed, don't poll (even if status hasn't updated yet)
    if (isComplete && campaign.recipients > 0) return false;
    
    // Only poll for active sending campaigns
    return campaign.status === CampaignStatus.SENDING;
  }, [campaign, enabled]);

  // Update stats from backend
  const updateStats = useCallback(async () => {
    if (!campaignId) return;
    
    try {
      // Update local storage with real stats from Redis
      await campaignService.updateStats(campaignId);
      
      // Invalidate queries to reflect new data
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      
      pollCountRef.current++;
    } catch (error) {
      console.error('Failed to update campaign stats:', error);
    }
  }, [campaignId, queryClient]);

  // Polling effect
  useEffect(() => {
    if (!shouldPoll()) return;

    const intervalId = setInterval(() => {
      updateStats();
    }, interval);

    // Initial update
    updateStats();

    return () => clearInterval(intervalId);
  }, [shouldPoll, updateStats, interval]);

  // Check scheduled campaigns
  useEffect(() => {
    if (!campaign || campaign.status !== CampaignStatus.SCHEDULED) return;
    if (!campaign.scheduledAt) return;

    const scheduledTime = new Date(campaign.scheduledAt).getTime();
    const now = Date.now();
    
    // If scheduled time has passed, start the campaign
    if (scheduledTime <= now) {
      campaignService.start(campaign.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      });
    } else {
      // Schedule auto-start
      const timeout = setTimeout(() => {
        campaignService.start(campaign.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
          queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        });
      }, scheduledTime - now);
      
      return () => clearTimeout(timeout);
    }
  }, [campaign, queryClient]);

  return {
    campaign: campaign || cachedCampaign, // Use cached if API hasn't responded yet
    isLoading: campaignId?.startsWith('temp_') ? false : isLoading, // Temp campaigns are never "loading"
    error,
    refetch,
    isPolling: shouldPoll(),
    pollCount: pollCountRef.current,
  };
};

/**
 * Hook for monitoring multiple campaigns (dashboard use case)
 */
export const useRealtimeCampaigns = (options: UseRealtimeStatusOptions = {}) => {
  const { interval = 5000, enabled = true } = options;
  const queryClient = useQueryClient();

  const {
    data: campaigns,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignService.getAll,
    enabled,
    staleTime: 2000,
  });

  // Find active campaigns that need polling
  const activeCampaigns = campaigns?.filter(c => 
    c.status === CampaignStatus.SENDING || c.status === CampaignStatus.SCHEDULED
  ) || [];

  // Poll active campaigns
  useEffect(() => {
    if (!enabled || activeCampaigns.length === 0) return;

    const intervalId = setInterval(async () => {
      // Update stats for each active campaign
      for (const campaign of activeCampaigns) {
        await campaignService.updateStats(campaign.id);
      }
      
      // Invalidate to refresh UI
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }, interval);

    return () => clearInterval(intervalId);
  }, [activeCampaigns.length, enabled, interval, queryClient]);

  // Check scheduled campaigns that need to start
  useEffect(() => {
    if (!campaigns) return;
    
    const scheduledCampaigns = campaigns.filter(c => 
      c.status === CampaignStatus.SCHEDULED && c.scheduledAt
    );

    for (const campaign of scheduledCampaigns) {
      const scheduledTime = new Date(campaign.scheduledAt!).getTime();
      const now = Date.now();
      
      if (scheduledTime <= now) {
        // Start immediately
        campaignService.start(campaign.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        });
      }
    }
  }, [campaigns, queryClient]);

  return {
    campaigns: campaigns || [],
    activeCampaigns,
    isLoading,
    error,
    refetch,
  };
};
