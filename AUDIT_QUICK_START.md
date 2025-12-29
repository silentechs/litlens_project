# 🔍 LITLENS AUDIT - QUICK START GUIDE

## 🚀 5-Minute Setup

### Step 1: Run the Audit
```bash
npm run audit:all
```

This will:
- ✅ Analyze your Prisma schema (44 tables)
- ✅ Extract all API routes (66 endpoints)
- ✅ Scan frontend routes (29 pages)
- ✅ Generate network graph data
- ✅ Create a comprehensive report

**Output Location**: `audit-output/`

---

### Step 2: View Results
```bash
# Read the executive summary
cat audit-output/AUDIT_REPORT.md

# Or view the interactive graph (not yet created)
npm run dev
# Navigate to http://localhost:3000/audit
```

---

## 📊 What You'll Discover

### 1. Orphaned Features
- Database tables with no API or UI
- API endpoints never called by frontend
- Unused components

### 2. Coverage Gaps
- Routes missing authentication
- Routes missing validation
- Pages missing loading states
- Pages missing error handling

### 3. Technical Debt
- High complexity routes (>200 lines)
- Code duplication patterns
- Missing documentation

---

## 📁 Output Files

After running `npm run audit:all`, you'll have:

```
audit-output/
├── schema-analysis.json       # Database schema breakdown
├── api-routes-analysis.json   # API endpoint inventory
├── frontend-routes-analysis.json  # UI route catalog
├── graph-data.json            # Network graph data
└── AUDIT_REPORT.md            # Executive summary
```

---

## 🎯 Critical Findings (Expected)

Based on the existing `PRODUCT_COMPLETENESS_AUDIT.md`, you should find:

### Orphaned Entities (~13 tables)
- `CalibrationRound`, `CalibrationDecision` - No implementation
- `ReviewProtocol`, `ProtocolVersion`, `ProtocolMilestone` - No implementation
- `LivingReviewConfig`, `LivingReviewUpdate` - No implementation
- `ExtractionDiscrepancy` - API exists, no UI
- `ApiKey`, `ApiKeyUsage` - API exists, no UI
- `Webhook`, `WebhookDelivery` - API exists, no UI
- `Activity` - Backend logging only
- `AuditLog` - API exists, no UI
- `Job` - No implementation

### Orphaned API Endpoints (~18 routes)
- `/api/projects/[id]/screening/analytics` - No UI
- `/api/projects/[id]/screening/batch` - No UI
- `/api/projects/[id]/synthesis` - No UI
- `/api/projects/[id]/export` - No UI
- And more...

---

## 🛠️ Next Actions (Top 5)

### Action 1: Fix Conflict Resolution UI (2 hours)
**Priority**: 🔴 P0 Blocker
**File**: `src/features/screening/components/ConflictAdjudicator.tsx`
**Issue**: Wrong enum, buttons not wired

### Action 2: Add Phase Progression Controls (6 hours)
**Priority**: 🔴 P0 Blocker
**File**: `src/features/screening/components/PhaseManager.tsx`
**Issue**: No way to advance from Title/Abstract to Full Text

### Action 3: Add Export Functionality (3 hours)
**Priority**: 🔴 P0 Blocker
**File**: Create `src/features/projects/components/ExportMenu.tsx`
**Issue**: Users can't extract their data

### Action 4: Screening Analytics Dashboard (12 hours)
**Priority**: 🟡 P1 High
**File**: Create `/src/app/(app)/project/[id]/screening-analytics/page.tsx`
**Impact**: Shows Kappa scores, IRR metrics (industry standard)

### Action 5: Lead Batch Operations Panel (10 hours)
**Priority**: 🟡 P1 High
**File**: Create `src/features/screening/components/LeadTools.tsx`
**Impact**: Bulk assign, AI apply, batch operations

---

## 📈 Market Readiness Score

Based on the audit, you'll likely see:

| Dimension | Expected Score | Status |
|-----------|----------------|--------|
| Business Logic | 4.5/5 | ✅ Excellent |
| UI/UX | 2.5/5 | ⚠️ Needs Work |
| Accessibility | 2/5 | ❌ Poor |
| Performance | 3.5/5 | ⚠️ Good |
| Security | 4/5 | ✅ Good |
| Features | 3/5 | ⚠️ Partial |

**Overall**: **3.2/5 (65%)** - Beta-ready, not production-ready

---

## 🗺️ Roadmap

### Phase 1: Beta Launch (3-4 weeks)
- Fix P0 blockers (conflict UI, phase progression, export)
- Add screening analytics
- Add batch operations panel
- Basic documentation

### Phase 2: Production (4-6 weeks)
- Data extraction workflow
- Quality assessment workflow
- PRISMA flow diagram
- Accessibility fixes
- Performance optimization

### Phase 3: Differentiation (6-8 weeks)
- AI theme discussion (major feature)
- Enhanced citation graphs
- Mobile swipe interface
- Living reviews
- Meta-analysis

---

## 💡 Pro Tips

### Viewing the Graph (Future)
Once you create `/src/app/(app)/audit/page.tsx`:
- **Click** nodes to highlight connections
- **Scroll** to zoom
- **Drag** to pan
- **Export** as PNG for presentations

### Understanding Coverage Colors
- 🟢 **Green**: Full coverage (DB → API → UI)
- 🟡 **Yellow**: Partial (API exists, no UI)
- 🔴 **Red**: Orphaned (no connections)

### Interpreting Orphaned Entities
Ask yourself:
1. **Delete**: Is this feature needed?
2. **Implement**: Build the missing UI?
3. **Defer**: Add to roadmap for later?

---

## 📚 Documentation Reference

1. **PRODUCT_AUDIT_FRAMEWORK.md** - Complete audit methodology (100+ pages)
2. **AUDIT_IMPLEMENTATION_GUIDE.md** - Executable scripts and visualizations
3. **AUDIT_SUMMARY.md** - Executive summary and roadmap
4. **PRODUCT_COMPLETENESS_AUDIT.md** - Existing detailed audit (already completed)

---

## 🆘 Troubleshooting

### Error: "Cannot find module"
**Solution**: Install dependencies
```bash
npm install
```

### Error: "audit-output directory not found"
**Solution**: Run schema analysis first
```bash
npm run audit:schema
npm run audit:api
npm run audit:frontend
npm run audit:graph
```

### Graph data looks wrong
**Solution**: Re-run all scripts in order
```bash
npm run audit:all
```

### Want to see graph visualization?
**Solution**: Create the audit page component (see `AUDIT_IMPLEMENTATION_GUIDE.md` for code)

---

## 🎯 Success Criteria

You'll know the audit is successful when:
- [ ] All 5 scripts run without errors
- [ ] `audit-output/` contains 5 files
- [ ] Orphaned entities identified (~13 DB tables, ~18 API endpoints)
- [ ] Markdown report readable and actionable
- [ ] You have a clear priority list (P0, P1, P2)

---

## 🚀 Ready to Execute?

```bash
# Run the audit
npm run audit:all

# Review results
cat audit-output/AUDIT_REPORT.md

# Start fixing P0 blockers
# 1. Fix conflict resolution UI (2 hours)
# 2. Add phase progression (6 hours)
# 3. Add export (3 hours)
```

**Total time to Beta**: 3-4 weeks (1 engineer, ~50 hours)

---

**Need help?** Refer to:
- `PRODUCT_AUDIT_FRAMEWORK.md` for methodology
- `AUDIT_IMPLEMENTATION_GUIDE.md` for code samples
- `AUDIT_SUMMARY.md` for roadmap details

**Let's ship!** 🚀

