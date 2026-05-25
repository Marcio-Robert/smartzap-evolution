import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';
import { campaignService, contactService } from '../services';
import { settingsService } from '../services/settingsService';

export const useCampaignWizardController = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState('');
  const [campaignText, setCampaignText] = useState(''); // Texto livre da campanha
  const [recipientSource, setRecipientSource] = useState<'all' | 'specific' | 'test' | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Scheduling State
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  // --- Queries ---
  const contactsQuery = useQuery({
    queryKey: ['contacts'],
    queryFn: contactService.getAll,
  });

  // Get settings for test contact
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.get,
  });

  const testContact = settingsQuery.data?.testContact;

  // Initialize name
  useEffect(() => {
    if (!name) {
      const date = new Date().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
      setName(`Campanha ${date}`);
    }
  }, []);

  // Update selected contact IDs when switching to "all"
  useEffect(() => {
    if (recipientSource === 'all' && contactsQuery.data) {
      setSelectedContactIds(contactsQuery.data.map(c => c.id));
    } else if (recipientSource === 'specific') {
      setSelectedContactIds([]);
    } else if (recipientSource === 'test') {
      setSelectedContactIds([]);
    }
  }, [recipientSource, contactsQuery.data]);

  // --- Mutations ---
  const createCampaignMutation = useMutation({
    mutationFn: campaignService.create,
    onMutate: async (input) => {
      const tempId = `temp_${Date.now()}`;

      // Pre-populate cache with pending messages
      const contacts = input.selectedContacts || [];
      const pendingMessages = contacts.map((contact, index) => ({
        id: `msg_${tempId}_${index}`,
        campaignId: tempId,
        contactName: contact.name || contact.phone,
        contactPhone: contact.phone,
        status: 'Pending' as const,
        sentAt: '-',
      }));

      const pendingCampaign = {
        id: tempId,
        name: input.name,
        campaignText: input.campaignText,
        recipients: input.recipients,
        sent: 0,
        status: 'SENDING' as const,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData(['campaign', tempId], pendingCampaign);
      queryClient.setQueryData(['campaignMessages', tempId], pendingMessages);

      // Navigate IMMEDIATELY (before API responds)
      navigate(`/campaigns/${tempId}`);

      return { tempId };
    },
    onSuccess: (campaign, _input, context) => {
      const tempId = context?.tempId;

      if (tempId) {
        const cachedMessages = queryClient.getQueryData(['campaignMessages', tempId]);
        if (cachedMessages) {
          queryClient.setQueryData(['campaignMessages', campaign.id], cachedMessages);
        }
        queryClient.removeQueries({ queryKey: ['campaign', tempId] });
        queryClient.removeQueries({ queryKey: ['campaignMessages', tempId] });
      }

      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate(`/campaigns/${campaign.id}`, { replace: true });

      toast.success('Campanha criada e disparada com sucesso!');
    },
    onError: (_error, _input, context) => {
      if (context?.tempId) {
        queryClient.removeQueries({ queryKey: ['campaign', context.tempId] });
        queryClient.removeQueries({ queryKey: ['campaignMessages', context.tempId] });
      }
      toast.error('Erro ao criar campanha.');
      navigate('/campaigns');
    }
  });

  // --- Logic ---
  const allContacts = contactsQuery.data || [];
  const totalContacts = allContacts.length;
  const selectedContacts = allContacts.filter(c => selectedContactIds.includes(c.id));

  // Calculate recipient count - 1 for test mode, otherwise selected contacts
  const recipientCount = recipientSource === 'test' && testContact ? 1 : selectedContacts.length;

  // Get contacts for sending - test contact or selected contacts
  const contactsForSending = recipientSource === 'test' && testContact
    ? [{ name: testContact.name || testContact.phone, phone: testContact.phone }]
    : selectedContacts.map(c => ({ name: c.name || c.phone, phone: c.phone }));

  const toggleContact = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name) { toast.error('Por favor insira o nome da campanha'); return; }
      if (!campaignText.trim()) { toast.error('Por favor insira o texto da campanha'); return; }
    }
    if (step === 2) {
      if (!recipientSource) { toast.error('Por favor selecione uma fonte de destinatários'); return; }
      if (recipientSource === 'specific' && selectedContactIds.length === 0) {
        toast.error('Por favor selecione pelo menos um contato');
        return;
      }
      if (recipientSource === 'test' && !testContact) {
        toast.error('Contato de teste não configurado. Configure em Ajustes.');
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1));

  // Send campaign
  const handleSend = (scheduleTime?: string) => {
    if (!campaignText.trim()) {
      toast.error('Texto da campanha é obrigatório');
      return;
    }

    createCampaignMutation.mutate({
      name: recipientSource === 'test' ? `[TESTE] ${name}` : name,
      campaignText: campaignText,
      recipients: recipientCount,
      selectedContacts: contactsForSending,
      selectedContactIds: recipientSource === 'test' ? [] : selectedContactIds,
      scheduledAt: scheduleTime || scheduledAt || undefined,
    });
  };

  // Schedule campaign for later
  const handleSchedule = (scheduleTime: string) => {
    setScheduledAt(scheduleTime);
    handleSend(scheduleTime);
  };

  return {
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
    isCreating: createCampaignMutation.isPending,
    isLoading: contactsQuery.isLoading || settingsQuery.isLoading,

    // Test Contact
    testContact,

    // Scheduling
    scheduledAt,
    setScheduledAt,
    isScheduling,
    setIsScheduling,
    handleSchedule,
  };
};
