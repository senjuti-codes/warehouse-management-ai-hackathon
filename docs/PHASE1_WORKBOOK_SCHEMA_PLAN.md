# Phase 1: Workbook-to-Schema Validation and Minimal End-to-End Pipeline Design

## 1. Repository assessment

The current repository is a partial implementation rather than a fully wired system:

- The frontend is present and already contains dashboard-style screens and routing in [frontend/app/page.tsx](../frontend/app/page.tsx) and [frontend/components/control-tower-dashboard.tsx](../frontend/components/control-tower-dashboard.tsx).
- The backend described in the project documentation is not present in the workspace yet.
- The project documentation in [README.md](../README.md), [docs/CODEBASE_GUIDE.md](CODEBASE_GUIDE.md), and [docs/DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) already describes an intended Python/FastAPI + Postgres architecture, but we are choosing the simpler Node.js/TypeScript full-stack path for this hackathon.

This is a good fit for a controlled, maintainable implementation. The frontend design already gives us a strong visual language. We will keep the UI direction and replace the missing backend with a clean TypeScript implementation that matches the hackathon logic and the actual workbook.

---

## 2. Workbook validation result

The actual workbook in the provided path was inspected using the Excel application available in this environment. The workbook contains these sheets:

- README
- Material_Master
- Inventory_Stock
- Warehouse_Bin
- Deliveries_Dispatch
- Purchase_Replenish
- Vendor_Master
- Data_Dictionary

This matches the required six core sheets plus the workbook context and the schema dictionary sheet.

Important operational rule for implementation:

- The Data_Dictionary sheet is the authoritative source for final column names and business meaning.
- The README sheet is contextual documentation and should be treated as supporting material.
- The six core sheets are the actual ingestion targets for the POC pipeline.
- We will not hardcode any column names without validating them against the workbook before data ingestion.

---

## 3. Recommended architecture decision

### Preferred path: Node.js/TypeScript full-stack

We choose the Node.js/TypeScript path because it is the better fit for this hackathon:

- Single-language delivery across the frontend and API
- Easier integration with a Next.js frontend and a Postgres database
- Strong enough for deterministic validation, anomaly detection, and workflow logic
- Simpler to demo and maintain within the team
- Enough flexibility to add an LLM wrapper later without forcing a separate Python service

### Why not Python as the primary backend

Python would only become the primary backend if we discovered a specific need for a dedicated data-science stack or a large prebuilt model pipeline. That is not necessary for this project. The required functionality is mostly:

- workbook ingestion
- validation rules
- joins and correlation
- impact scoring
- approval workflow
- audit logging
- UI integration

Those are all practical in TypeScript and easier to keep in one codebase during a demo sprint.

---

## 4. Canonical data model strategy

We will normalize the workbook into a canonical schema that is stable regardless of the exact original workbook header spellings.

### Canonical domain model

Each raw sheet will be ingested into a raw-table mirror, and then mapped into a standardized business model.

#### MaterialMaster
- materialId
- description
- materialType
- materialGroup
- plant
- uom
- reorderPoint
- safetyStock
- leadTime
- lifecycleStatus
- isBlocked
- isHazmat

#### InventoryStock
- materialId
- plant
- storageLocation
- batch
- onHandQty
- blockedQty
- inTransitQty
- expiryDate
- lastMovementDate

#### WarehouseBin
- materialId
- plant
- bin
- storageType
- capacity
- occupancy
- status

#### DeliveriesDispatch
- deliveryId
- materialId
- plant
- quantity
- shipTo
- route
- deliveryDate
- status

#### PurchaseReplenish
- purchaseOrderId
- materialId
- plant
- vendorId
- quantity
- price
- orderDate
- requiredDate
- status

#### VendorMaster
- vendorId
- vendorName
- country
- qualityRating
- onTimePct
- paymentBlock
- procurementStatus

This is the normalized representation we will use internally. The workbook header names will be mapped into these fields by a schema-mapping layer before any rules run.

---

## 5. Workbook-to-schema validation approach

The implementation will validate the workbook in a disciplined sequence:

1. Load workbook and enumerate worksheets.
2. Confirm the six required sheets exist.
3. Read the Data_Dictionary sheet and use it as the field-definition source of truth.
4. For each sheet, map actual columns to the canonical fields.
5. Verify required keys exist for each data model.
6. Normalize nulls, blanks, numeric strings, and date strings.
7. Validate row counts and detect malformed records.
8. Persist a raw-data mirror and a normalized-data model.

### Validation rules for the first pass

- required sheet presence
- required key columns presence
- no duplicate business keys where duplicates are invalid
- consistent null handling
- numeric and date conversions
- material + plant integrity checks
- vendor relationship integrity checks

These validations are deterministic and should happen before anomaly detection.

---

## 6. Minimal end-to-end pipeline design

We will design the first working vertical slice around a minimal but complete workflow:

1. Workbook upload or local file selection
2. Ingestion and schema validation
3. Raw load into Postgres
4. Normalized data model creation
5. Deterministic anomaly detection
6. Correlation by material + plant + vendor
7. Root-cause grouping with evidence
8. Impact scoring
9. Recommendation generation
10. Human approval or rejection
11. Simulated write-back only after approval
12. Audit logging
13. Dashboard display of the final incident state

### Minimal demo flow

The first demo should confirm these business outcomes:

- at least one master-data issue detected
- at least one inventory or process anomaly detected
- at least one cross-system correlation evidenced across two sheets
- at least one recommendation created
- at least one approval decision recorded
- at least one audit event generated

This is enough to demonstrate the full idea without building every optional feature at once.

---

## 7. Anomaly-rule catalog for Phase 1

The actual rules should be implemented only after confirming the workbook data. The initial catalog will be:

### Master-data validation
- missing material master values
- invalid or missing UOM
- invalid reorder point / safety stock relationships
- duplicate master record candidates
- blocked or obsolete material usage

### Inventory and process anomalies
- negative or impossible stock
- expired batch with stock remaining
- warehouse-bin over-allocation
- dispatch quantity exceeding available stock
- missing route or route mismatch
- overdue deliveries
- replenishment anomalies based on open PO and stock condition

### Correlation patterns
- same material + same plant across stock, bin, and dispatch sheets
- same vendor across purchase replenishment and vendor master
- root-cause chain where master-data issue leads to stock or dispatch issue

The deterministic engine will create evidence objects for each rule with:

- issue type
- severity
- affected record ids
- source sheet
- evidence text
- confidence
- rule code

---

## 8. Minimal software structure for implementation

The project should be organized as follows:

```text
warehouse-management-ai-hackathon/
  backend/
    src/
      app/
        config/
        db/
        modules/
          ingestion/
          validation/
          anomalies/
          correlation/
          impact/
          recommendations/
          approval/
          audit/
        routes/
        services/
        types/
        utils/
      tests/
        unit/
        integration/
  frontend/
    app/
    components/
    lib/
```

We will keep the backend modular and separate by responsibility, without making the structure too enterprise-heavy. The important part is clarity and demo reliability.

---

## 9. Phase 1 deliverables

Before moving to the full implementation, Phase 1 must produce:

- workbook schema validation process
- canonical data model mapping
- ingestion contract for all six sheets
- validation checklist for required keys and columns
- explicit business-key strategy
- minimal end-to-end workflow design
- list of deterministic rules to implement first
- list of AI-assisted steps to keep optional or mocked

---

## 10. Implementation plan for the next step

### Step A: create the backend skeleton
- TypeScript project setup
- Postgres configuration
- environment variable schema
- health check route

### Step B: implement workbook ingestion
- read workbook from disk
- enumerate sheets
- map raw headers to canonical fields
- validate required sheets and columns
- persist raw mirror rows

### Step C: implement normalized domain tables
- material master
- inventory stock
- warehouse bin
- deliveries dispatch
- purchase replenish
- vendor master

### Step D: implement rule engine
- single-sheet validation rules
- cross-sheet anomalies
- evidence generation
- severity assignment

### Step E: implement flow orchestration
- process workbook -> ingest -> validate -> detect -> correlate -> impact -> recommend

### Step F: implement approval and audit
- approval state machine
- simulated write-back only after approval
- audit record append-only trail

### Step G: integrate with frontend dashboard
- show summary metrics
- show incident queue
- show approval panel
- show audit trail

---

## 11. Risk and assumptions

- The workbook is the source of truth. The Data_Dictionary sheet must be treated as authoritative for field definitions.
- We should avoid blindly implementing every theoretical anomaly rule. We will implement only rules that can be defended with actual workbook data and valid business logic.
- The AI layer should remain optional and structured; the system must remain fully functional in deterministic, mock mode.
- The approval layer must be explicit and safe; no real ERP or WMS mutation is allowed.

---

## 12. Decision gate

This is the point where we move from analysis into implementation.

The next implementation step is to build the backend skeleton and the workbook ingestion + schema validation layer in TypeScript, using the workbook sheet map above as the source of truth and the Data_Dictionary sheet as the final field-definition authority.
