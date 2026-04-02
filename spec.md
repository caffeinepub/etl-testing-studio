# ETL Testing Studio

## Current State
- Each sub-project has exactly one hardcoded Source Dataset and one Target Dataset (IDs stored as `sourceDataset`/`targetDataset` on SubProject)
- UI shows two fixed tabs: "Source Dataset" and "Target Dataset"
- No way to add additional datasets beyond these two
- Backend has no `createDataset` or `getDatasetsForSubProject` API

## Requested Changes (Diff)

### Add
- `createDataset(subProjectId, name, datasetType)` backend function (Admin/Master Admin/ETL Tester only)
- `getDatasetsForSubProject(subProjectId)` backend query returning all Dataset records for a sub-project
- `deleteDataset(datasetId)` backend function -- blocked if connections exist
- `updateDataset(datasetId, name)` backend function for renaming
- Frontend: dynamic dataset tabs -- query all datasets for selected sub-project, render each as a tab
- Frontend: "Add Dataset" button (canEdit only) opens dialog to name and choose type (SOURCE/TARGET)
- Frontend: Each dataset tab shows the DatasetPanel for that dataset's connections
- Comparison tab and Test Cases tab continue to use the first SOURCE and first TARGET dataset

### Modify
- `createSubProject` still auto-creates "Source Dataset" (type #source) and "Target Dataset" (type #target) as before
- SubProjectPage fetches datasets via `getDatasetsForSubProject` instead of using hardcoded sourceDataset/targetDataset
- Tabs are now dynamically generated from the dataset list

### Remove
- Fixed "Source Dataset" / "Target Dataset" tab references replaced by dynamic query

## Implementation Plan
1. Add `createDataset`, `getDatasetsForSubProject`, `deleteDataset`, `updateDataset` to backend
2. Update frontend SubProjectPage to fetch datasets dynamically and render dynamic tabs
3. Add "Add Dataset" dialog with name + type (SOURCE/TARGET) selector
4. Pass correct datasetId to DatasetPanel for each tab
5. Comparison and TestCases still use first source dataset and first target dataset
