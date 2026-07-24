# TODO: Instant Notifications & Input Formatting

## Steps
- [x] Plan approved by user
- [x] 1. Add input format validation in `server/src/routes/whatsapp-flow.js`
  - [x] Validate national_id format (Zimbabwe format: XX-XXXXXXX-X-XX)
  - [x] Validate plot_number is not empty
  - [x] Validate phone number format
  - [x] Return validation errors to flow screen
- [x] 2. Send instant WhatsApp notification after successful submission
  - [x] Import sendWhatsAppMessage in whatsapp-flow.js
  - [x] Send "Application submitted and pending review" message
- [x] 3. Update SUCCESS screen data with clearer pending review message
- [x] 4. Improve admin panel toast messages in SubmissionDetails.tsx
  - [x] Updated verify toast to show pending review context
  - [x] Updated reject toast to include the rejection reason
