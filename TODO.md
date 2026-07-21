# Implementation Plan: Admin Dashboard & Features

## Phase 1: Backend API Extensions
- [x] 1.1 Extend `supabase.js` - Add listAllSubmissions, getDashboardStats, getSubmissionsExport, getWaId
- [x] 1.2 Extend `admin.js` - New endpoints: list all, stats, export CSV, send custom message
- [x] 1.3 Update `admin.js` - Add query params (search, status, date range, sort) to list endpoint

## Phase 2: Frontend API Layer
- [x] 2.1 Update `types.ts` - Add Stats, SubmissionFilters, ExportData types
- [x] 2.2 Update `api.ts` - Add new API methods (listAll, getStats, sendMessage, exportCSV)

## Phase 3: Frontend Pages
- [x] 3.1 Create `Dashboard.tsx` - Analytics cards with metrics
- [x] 3.2 Create `AllSubmissions.tsx` - Full list with search, filters, sort, export
- [x] 3.3 Enhance `SubmissionDetails.tsx` - Rejection dropdown, direct message box
- [x] 3.4 Update `PendingSubmissions.tsx` - Adapt for pending-only view
- [x] 3.5 Update `App.tsx` - Navigation tabs (Dashboard, Pending, All Submissions)

## Phase 4: Styling
- [x] 4.1 Update `styles.css` - New styles for dashboard, table, filters, tabs, dropdowns

## Phase 5: WhatsApp Flow Feedback
- [x] 5.1 Update `whatsapp-flow.js` - Navigate to SUCCESS screen after submission

## Phase 6: Testing & Deployment
- [x] 6.1 Test all new API endpoints
- [x] 6.2 Build admin UI and verify
- [x] 6.3 Commit and push to GitHub
