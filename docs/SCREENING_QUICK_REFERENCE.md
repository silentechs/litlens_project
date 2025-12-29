# Screening Implementation - Quick Reference

## 📊 Current State: 70% Feature Parity

```
Covidence Features: ████████████████████████████████ 45 features
LitLens Has:        █████████████████████░░░░░░░░░░░ 32 features (70%)
LitLens Missing:    ░░░░░░░░░░░░░                     13 critical features
```

---

## 🚨 CRITICAL ISSUES (Fix First)

### 1. **Conflict Resolution BROKEN** ❌
- **What**: Wrong enum, buttons non-functional
- **Impact**: Dual screening doesn't work end-to-end
- **Fix Time**: 2 days
- **Priority**: P0

### 2. **No Dual Screening Visual Feedback** ❌  
- **What**: Users don't know if they're reviewer #1 or #2
- **Impact**: Confusion, users don't understand workflow
- **Fix Time**: 2 days
- **Priority**: P0

### 3. **AI Sorting Not Exposed** ❌
- **What**: Backend has AI relevancy, no UI to use it
- **Impact**: Missing key feature vs Covidence
- **Fix Time**: 2 days
- **Priority**: P0

### 4. **No Eligibility Criteria System** ❌
- **What**: No PICOS framework
- **Impact**: Can't define systematic inclusion rules
- **Fix Time**: 3 days
- **Priority**: P0

### 5. **Analytics Dashboard Missing** ❌
- **What**: Kappa/IRR API exists, no UI
- **Impact**: Can't measure quality
- **Fix Time**: 3 days
- **Priority**: P0

---

## ✅ What You HAVE (Keep These!)

| Feature | Quality | Notes |
|---------|---------|-------|
| Yes/Maybe/No voting | ⭐⭐⭐⭐⭐ | Perfect |
| Confidence slider | ⭐⭐⭐⭐⭐ | **Covidence doesn't have this!** |
| Time tracking | ⭐⭐⭐⭐⭐ | **Covidence doesn't have this!** |
| AI suggestions | ⭐⭐⭐⭐ | Works, just needs sorting |
| Keyboard shortcuts | ⭐⭐⭐⭐⭐ | Better than Covidence |
| Focus mode | ⭐⭐⭐⭐⭐ | **Unique feature** |
| Batch operations | ⭐⭐⭐⭐ | UI exists, needs polish |
| Exclusion reasons | ⭐⭐⭐⭐⭐ | Required, well-implemented |

---

## 📋 4-Week Roadmap

### Week 1: Fix Broken Stuff ⚡
```
Mon-Tue: Fix conflict resolution
Wed-Thu: Add dual screening visual feedback
Fri:     Implement AI sorting
Weekend: Expose keyword highlighting
```

### Week 2: Add Structure 🏗️
```
Mon-Wed: PICOS eligibility criteria
Thu:     Filtering & search UI
Fri:     Study tags system
```

### Week 3: Analytics & Quality 📊
```
Mon-Wed: Analytics dashboard (Kappa, IRR)
Thu:     PRISMA flow diagram
Fri:     Calibration workflow
```

### Week 4: Polish ✨
```
Mon-Tue: Study notes
Wed:     Mobile optimization
Thu:     PDF viewer
Fri:     History & undo
```

---

## 🎯 Quick Wins (Do These First)

1. **Fix Conflicts** (2h)
   - Change enum from `RESOLVED` to proper value
   - Wire up buttons
   - Test

2. **Show Reviewer Status** (3h)
   ```typescript
   {currentStudy.reviewerStatus === "FIRST_REVIEWER" && (
     <Badge>You are reviewer #1 - Awaiting second reviewer</Badge>
   )}
   ```

3. **Add Sort Dropdown** (2h)
   ```typescript
   <Select value={sortBy} onChange={setSortBy}>
     <option value="relevance">Most Relevant (AI) ✨</option>
     <option value="author">Author (A-Z)</option>
     <option value="title">Title (A-Z)</option>
   </Select>
   ```

4. **Turn On Keyword Highlighting** (1h)
   - Add `highlightKeywords` to Project model
   - Add UI in settings to manage keywords
   - Done! Component already exists

---

## 🆚 Covidence Comparison

### You're BETTER at:
✅ Confidence tracking  
✅ Time tracking per study  
✅ AI reasoning transparency  
✅ Focus mode  
✅ Modern UI/UX  

### You're MISSING:
❌ PICOS criteria  
❌ Kappa dashboard  
❌ Calibration  
❌ PRISMA diagram  
❌ Full-text PDF viewer  

### You're EQUAL:
✔️ Dual screening (once fixed)  
✔️ Conflict resolution (once fixed)  
✔️ Batch operations  
✔️ Phase management  

---

## 💾 Database Changes Needed

```prisma
// Add these 3 models:

model EligibilityCriteria {
  projectId    String
  population   String?
  intervention String?
  // ... PICOS fields
}

model StudyTag {
  projectWorkId String
  name         String
  color        String
}

model StudyNote {
  projectWorkId String
  userId       String
  content      String
}

// Enhance Project:
model Project {
  highlightKeywords String[] @default([])
}

// Enhance ProjectWork:
model ProjectWork {
  fullTextPdf String?
}
```

---

## 📞 API Endpoints to Add

```typescript
// Eligibility (PICOS)
GET/POST /api/projects/[id]/eligibility-criteria

// Tags
GET/POST /api/projects/[id]/tags
POST     /api/projects/[id]/works/[workId]/tags

// Notes
GET/POST /api/projects/[id]/works/[workId]/notes

// Calibration
POST /api/projects/[id]/calibration/rounds
GET  /api/projects/[id]/calibration/rounds/[roundId]/analytics

// Enhanced Queue
GET /api/projects/[id]/screening/queue?sortBy=relevance&search=...
```

---

## 🧪 Test Checklist

Before shipping each sprint:

**Sprint 1:**
- [ ] Create conflict → Resolve → Verify study moved correctly
- [ ] Screen as reviewer 1 → See "Awaiting reviewer 2" badge
- [ ] Sort by "Most Relevant" → Studies ordered by AI confidence
- [ ] Add keyword in settings → See highlighting in screening

**Sprint 2:**
- [ ] Create PICOS criteria → View in screening sidebar
- [ ] Filter by "INCLUDE" → Only see included studies
- [ ] Add tag to study → See tag badge
- [ ] Search "COVID" → Find relevant studies

**Sprint 3:**
- [ ] View analytics → See Kappa score
- [ ] Generate PRISMA → Export to PNG
- [ ] Run calibration → Get low Kappa → See conflicts
- [ ] Discuss conflicts → Re-screen → Get better Kappa

**Sprint 4:**
- [ ] Add note to study → Teammate sees notification
- [ ] Screen on mobile → Swipe left to exclude
- [ ] View PDF → Highlights appear
- [ ] Make decision → Undo → Decision reverted

---

## 🎓 Training Materials Needed

1. **"What is Dual Screening?"** (2-min video)
2. **"Setting Up Eligibility Criteria"** (Guide + template)
3. **"Understanding Kappa Scores"** (Explainer)
4. **"Running a Calibration Round"** (Tutorial)
5. **"Mobile Screening Best Practices"** (Tips)

---

## 📈 Success Metrics

Track these weekly:

```
✅ Conflict resolution success rate: 0% → 100%
✅ AI sort adoption: 0% → 60%+
✅ Projects with PICOS: 0% → 75%+
✅ Analytics views: 0 → 1/project/week
✅ Mobile sessions: 0% → 20%+
```

---

## 🚀 Launch Checklist

**Before Sprint 1:**
- [ ] Set up project board
- [ ] Assign developers
- [ ] Create feature branches
- [ ] Write tickets with acceptance criteria

**Before Each Sprint:**
- [ ] Review previous sprint
- [ ] Demo to stakeholders
- [ ] Gather feedback
- [ ] Adjust priorities if needed

**After Sprint 4:**
- [ ] Full regression testing
- [ ] User acceptance testing with beta users
- [ ] Record demo videos
- [ ] Update documentation
- [ ] Announce features
- [ ] Monitor analytics

---

## 📞 Need Help?

- **Conflict Resolution Code**: `src/app/project/[id]/conflicts/page.tsx`
- **Screening Queue**: `src/features/screening/components/ScreeningQueue.tsx`
- **API Routes**: `src/app/api/projects/[id]/screening/**`
- **Database Schema**: `prisma/schema.prisma`

**Related Docs:**
- Full audit: `SCREENING_AUDIT_AND_IMPLEMENTATION_PLAN.md`
- Covidence features: `COVIDENCE_SCREENING_FEATURES.md`
- Product audit: `PRODUCT_COMPLETENESS_AUDIT.md`

---

*Updated: December 27, 2025*

