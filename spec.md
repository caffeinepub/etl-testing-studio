# ETL Testing Studio

## Current State
- SubProject type has: id, projectId, name, description, sourceDataset, targetDataset, createdAt, updatedAt
- No `isActive` flag on sub-projects
- Any registered user can create sub-projects
- No edit functionality (rename/update description)
- No active/inactive badge shown in the sub-project list
- SubProjectPage has a create dialog but no edit or status toggle

## Requested Changes (Diff)

### Add
- `isActive: Bool` field to `SubProject` type in backend
- `toggleSubProjectActive(subProjectId, isActive)` backend function
- `updateSubProject(subProjectId, name, description)` backend function
- Role restriction: only `masterAdmin`, `admin`, or `etlTester` can call `createSubProject`; view roles cannot
- Active/inactive status badge on each sub-project card in the UI
- Activate/deactivate toggle button on each sub-project card (Admin/Master Admin only)
- Edit button on each sub-project card (opens dialog to rename and update description)

### Modify
- `createSubProject`: add role check (block viewEtlTester, viewApiTester, apiTester)
- `SubProject` type: add `isActive` field
- SubProjectPage UI: show active/inactive badge, add edit and toggle buttons per card

### Remove
- Nothing removed

## Implementation Plan
1. Update `SubProject` type in main.mo to include `isActive: Bool`
2. Update `createSubProject` to set `isActive = true` and add role check
3. Add `toggleSubProjectActive` function
4. Add `updateSubProject` function
5. Update SubProjectPage.tsx to show active/inactive badge, edit dialog, and toggle button
6. Restrict create button visibility to Admin/Master Admin/ETL Tester in the UI
