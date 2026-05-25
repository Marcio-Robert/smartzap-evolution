'use client'

import { useCampaignWizardController } from '@/hooks/useCampaignWizard'
import { CampaignWizardView } from '@/components/features/campaigns/CampaignWizardView'

export default function NewCampaignPage() {
  const controller = useCampaignWizardController()

  return (
    <CampaignWizardView
      step={controller.step}
      setStep={controller.setStep}
      name={controller.name}
      setName={controller.setName}
      campaignText={controller.campaignText}
      setCampaignText={controller.setCampaignText}
      recipientSource={controller.recipientSource}
      setRecipientSource={controller.setRecipientSource}
      totalContacts={controller.totalContacts}
      recipientCount={controller.recipientCount}
      allContacts={controller.allContacts}
      selectedContacts={controller.selectedContacts}
      selectedContactIds={controller.selectedContactIds}
      setSelectedContactIds={controller.setSelectedContactIds}
      toggleContact={controller.toggleContact}
      handleNext={controller.handleNext}
      handleBack={controller.handleBack}
      handleSend={controller.handleSend}
      isCreating={controller.isCreating}
      isLoading={controller.isLoading}
      testContact={controller.testContact}
      scheduledAt={controller.scheduledAt}
      setScheduledAt={controller.setScheduledAt}
      isScheduling={controller.isScheduling}
      setIsScheduling={controller.setIsScheduling}
      handleSchedule={controller.handleSchedule}
    />
  )
}
