# Covidence Screening Features - Comprehensive Overview

This document summarizes the screening features available in Covidence, a leading systematic review management platform.

## Table of Contents
1. [Title and Abstract Screening](#title-and-abstract-screening)
2. [Full-Text Screening](#full-text-screening)
3. [Dual Screening and Blinding](#dual-screening-and-blinding)
4. [AI and Machine Learning Integration](#ai-and-machine-learning-integration)
5. [Eligibility Criteria Management](#eligibility-criteria-management)
6. [Conflict Resolution](#conflict-resolution)
7. [Sorting and Filtering Options](#sorting-and-filtering-options)
8. [Additional Helper Features](#additional-helper-features)
9. [Reporting and Export](#reporting-and-export)

---

## Title and Abstract Screening

### Core Functionality
- **Quick Assessment**: Reviewers can rapidly evaluate studies by reviewing titles and abstracts
- **Three-Option Voting**: Each reference can be voted on using **Yes**, **Maybe**, or **No** buttons
- **Efficient Navigation**: Users can navigate through references quickly to maintain screening momentum

### Reference Display
- **Customizable Display**: Default setting shows 25 references per page, but this can be increased
- **Reference Information**: Each reference displays:
  - Title
  - Authors
  - Abstract
  - Publication details
  - Source database

### Access Points
- Click 'Continue' under title and abstract screening from the Review Summary page
- Direct access to specific reference lists (e.g., "Awaiting other reviewer")

---

## Full-Text Screening

### Document Management
- **PDF Upload**: Users can upload and manage full-text PDFs for comprehensive evaluation
- **In-Platform Review**: Full-text articles can be reviewed directly within Covidence
- **Comprehensive Evaluation**: Ensures that included studies meet ALL eligibility criteria

### Exclusion Documentation
- **Mandatory Exclusion Reasons**: When excluding a study during full-text screening, reviewers must provide a specific reason
- **Predefined Reasons**: Common exclusion reasons can be set up in advance
- **Custom Reasons**: Reviewers can add new exclusion reasons as needed
- **PRISMA Integration**: Exclusion reasons are automatically recorded and displayed in the PRISMA flow diagram

---

## Dual Screening and Blinding

### Dual Reviewer System
- **Default Configuration**: New reviews are set up in dual screening mode by default
- **Independent Assessment**: Each citation requires votes from **two independent reviewers**
- **Different Reviewers Required**: The two votes must be cast by different team members

### Blinded Voting
- **Complete Blinding**: All voting is blinded, meaning reviewers cannot see each other's votes until both have voted
- **Prevents Bias**: Ensures unbiased assessments and maintains objectivity
- **Voting History**: Remains concealed until consensus is reached or conflict resolution is complete

### Vote Progression
- **First Vote**: If you're the first person voting on a reference, the citation moves to your 'Awaiting other reviewer' list
- **Second Vote**: When the second person votes, the reference moves forward based on the combination of votes
- **Vote Logic**: Clear flowchart determines where references move based on vote combinations

---

## AI and Machine Learning Integration

### Active Learning
- **Relevancy Prediction**: Covidence employs machine learning algorithms to predict study relevance
- **Intelligent Prioritization**: Allows reviewers to focus on studies most likely to be relevant
- **Activation Threshold**: Feature becomes available after at least 25 studies have been screened with clear inclusion or exclusion decisions

### Benefits
- **Time Savings**: Reduces the time and effort required for screening large datasets
- **Efficiency Boost**: Helps reviewers prioritize their screening workflow
- **Continuous Learning**: The algorithm improves as more studies are screened

---

## Eligibility Criteria Management

### PICOS Framework Support
Covidence supports the **PICOS framework** for defining eligibility criteria:
- **P**opulation
- **I**ntervention
- **C**omparison
- **O**utcomes
- **S**tudy Characteristics

### Structured Criteria
- **Clear Definition**: Eligibility criteria can be structured and clearly defined before screening begins
- **In-Process Reference**: Reviewers can view eligibility criteria during screening
- **Consistency**: Ensures decisions align with the predefined protocol
- **Conflict Reduction**: Structured criteria help reduce disagreements between reviewers

### Benefits
- Maintains clarity and consistency throughout the screening process
- Ensures all team members are aligned on inclusion/exclusion criteria
- Facilitates transparent and reproducible decision-making

---

## Conflict Resolution

### Conflict Mechanism
- **Automatic Detection**: System automatically identifies when reviewers disagree on study inclusion
- **Third Reviewer**: A third reviewer can be assigned to resolve conflicts
- **Consensus-Based**: Ensures all decisions reach consensus
- **Blinded History**: Voting history remains concealed during conflict resolution

### Workflow
1. Two reviewers cast conflicting votes (e.g., one "Yes" and one "No")
2. Study is flagged as a conflict
3. Designated third reviewer (or team lead) reviews the study
4. Final decision is made to resolve the conflict
5. Study moves to appropriate stage based on resolution

---

## Sorting and Filtering Options

### Available Sort Options
1. **Most Relevant** (AI-powered)
   - Uses machine learning (active learning) relevancy predictions
   - Shows studies predicted to be most relevant
   - Helps prioritize screening efforts

2. **Author**
   - Alphabetical sorting by author name
   - Useful for systematic organization

3. **Title**
   - Alphabetical sorting by study title
   - Easy reference lookup

4. **Most Recent**
   - Displays references most recently acted upon within the review project
   - Shows recent activity, not publication date

### Display Customization
- Adjustable number of references per page
- Options menu at the top right of the screening list
- Customizable to match reviewer preferences

---

## Additional Helper Features

### Keyword Highlighting
- **Create Highlights**: Users can create and manage keyword highlights
- **Quick Identification**: Quickly identify relevant terms during screening
- **Inclusion/Exclusion Indicators**: Highlight keywords that indicate whether a study should be included or excluded
- **Visual Cues**: Makes screening faster and more accurate

### Study Tags and Notes
- **Tagging System**: Reviewers can add tags to studies for organization
- **Notes Feature**: Add notes to studies for:
  - Team communication
  - Recording important observations
  - Flagging studies for special attention
- **Collaboration**: Facilitates organization and communication among review team members

### Bulk Operations
- **Bulk Upload**: Import references from various citation managers and databases
- **Batch Management**: Manage large datasets efficiently
- **Integration Support**: Works with EndNote, Zotero, Mendeley, and other reference managers

---

## Reporting and Export

### PRISMA Flow Diagram
- **Automatic Generation**: Covidence automatically generates a PRISMA flow diagram
- **Visual Representation**: Provides a clear visual representation of the study selection process
- **Transparency**: Enhances transparency and reproducibility
- **Publication Ready**: Meets PRISMA reporting standards for systematic reviews

### Export Capabilities
- **Reference Export**: Export references at any stage of screening
- **Data Export**: Export screening decisions and metadata
- **Integration**: Seamless export to common formats and reference managers

---

## Key Differentiators

### What Makes Covidence Screening Special

1. **Workflow Automation**
   - Automated routing of references based on screening decisions
   - Automatic tracking of progress and statistics
   - Built-in PRISMA diagram generation

2. **Collaboration Tools**
   - Real-time team collaboration
   - Blinded dual screening
   - Integrated conflict resolution
   - Notes and tagging for communication

3. **Quality Assurance**
   - Mandatory dual screening (configurable)
   - Blinded voting to prevent bias
   - Structured eligibility criteria
   - Comprehensive audit trail

4. **Efficiency Features**
   - AI-powered relevancy prediction
   - Customizable sorting and filtering
   - Keyword highlighting
   - Bulk operations

5. **Standards Compliance**
   - PRISMA flow diagram support
   - Structured methodology
   - Transparent decision tracking
   - Publication-ready outputs

---

## Screening Workflow Summary

```
1. Import References
   ↓
2. Title & Abstract Screening
   - Dual reviewers vote independently (Yes/Maybe/No)
   - Votes are blinded
   - AI helps prioritize most relevant studies
   ↓
3. Conflict Resolution (if needed)
   - Third reviewer resolves disagreements
   ↓
4. Full-Text Screening
   - Upload PDFs
   - Detailed evaluation
   - Must provide exclusion reasons if excluding
   ↓
5. Final Inclusion Set
   - Move to data extraction phase
   ↓
6. PRISMA Diagram
   - Automatically generated
   - Shows full screening process
```

---

## Best Practices for Screening in Covidence

1. **Set Up Eligibility Criteria First**: Define clear, structured eligibility criteria using the PICOS framework before starting screening

2. **Use Keyword Highlighting**: Create keyword highlights early to speed up screening

3. **Enable Dual Screening**: Utilize the dual screening feature for reliability and quality

4. **Leverage AI Sorting**: Once you've screened 25+ studies, use the "Most Relevant" sort to prioritize

5. **Resolve Conflicts Promptly**: Address conflicts as they arise to maintain momentum

6. **Add Notes for Edge Cases**: Use the notes feature to document uncertainty or special considerations

7. **Regular Team Communication**: Use tags and notes to communicate with team members about specific studies

8. **Track Progress**: Monitor screening statistics to ensure balanced workload across reviewers

---

## Comparison Points for LitLens Project

### Features to Consider Implementing:
- ✅ Dual screening with blinding
- ✅ AI-powered relevancy sorting
- ✅ Structured eligibility criteria (PICOS)
- ✅ Conflict resolution workflow
- ✅ Keyword highlighting
- ✅ Study tags and notes
- ✅ PRISMA flow diagram generation
- ✅ Multiple sorting options
- ✅ Exclusion reasons tracking
- ✅ Progress tracking and statistics

### Potential Differentiators for LitLens:
- More advanced AI/ML features
- Real-time collaboration features
- Mobile-friendly screening interface
- Advanced filtering and search capabilities
- Integration with more data sources
- Customizable screening workflows
- Enhanced visualization tools
- API access for automation

---

## Sources
- Covidence Support Documentation: https://support.covidence.org
- Covidence Blog: https://www.covidence.org/blog
- User guides and tutorials from systematic review libraries
- Web research on Covidence features and capabilities

---

*Document created: December 27, 2025*
*Purpose: Competitive analysis for LitLens screening features*

