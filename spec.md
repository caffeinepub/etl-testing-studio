# ETL Testing Studio

## Current State
New project with no existing application logic.

## Requested Changes (Diff)

### Add
- Internet Identity login/logout
- Projects: authenticated users can create, view, delete their own projects
- Sub-Projects: each project can have multiple sub-projects
- Source Dataset module per sub-project (only 1 allowed)
- Target Dataset module per sub-project (only 1 allowed)
- Connections within each dataset module (multiple connections allowed):
  - Database connection: type (DB2, SQL Server, Postgres, MySQL, Databricks), host, port, database name, username, password, table name
  - File connection: type (CSV, Fixed Width, Parquet, JSON, XML), source location (Local, Network, Azure Blob), file path/URL
- Data viewer: after adding a connection, user can view the data (mocked/simulated rows)
- Join builder: when a dataset has 2+ connections, configure join (join type, join keys)
- Field selector: select which fields/columns to include
- Data format transformer: change output format (CSV, JSON, Parquet, XML)
- Comparison engine: compare Source final data vs Target final data and generate a report:
  - Total matched rows count
  - Total mismatched rows count
  - Duplicate rows count (in source and target separately)
  - Field-by-field validation: for each field, show match/mismatch breakdown
- Test case generation: generate test cases in a standard format (test case ID, description, source value, target value, status: Pass/Fail)

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Backend (Motoko):
   - User identity tied to ICP principal
   - CRUD for Projects, Sub-Projects, Datasets, Connections
   - Join config, field selection, output format storage per dataset
   - Mock data generation per connection
   - Comparison logic: compare source vs target mock data, compute matched/mismatched/duplicate counts and field-level stats
   - Test case generation: produce structured test cases from comparison results

2. Frontend:
   - Login screen with Internet Identity
   - Header with logout
   - Projects dashboard
   - Project detail with sub-projects
   - Sub-project detail: Source and Target dataset panels
   - Dataset panel: connections list, add connection form, data viewer, join builder, field selector, format selector
   - Comparison panel: run comparison button, summary stats (matched/mismatched/duplicate), field-by-field table
   - Test Cases panel: table of generated test cases with export option
