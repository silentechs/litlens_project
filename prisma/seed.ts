/**
 * Database Seed Script
 * Creates comprehensive test data for development
 * 
 * Run with: npx tsx prisma/seed.ts
 */

import { ProjectWorkStatus, ScreeningPhase, ProtocolStatus, ImportStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { hash } from "bcryptjs";
import "dotenv/config";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.error("   Please set DATABASE_URL in .env.local or .env");
  process.exit(1);
}

// Set up WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ============== CONFIGURATION ==============

const ADMIN_EMAIL = "silentechs@gmail.com";
const ADMIN_PASSWORD = "BeProfessional2025";
const TEST_USER_PASSWORD = "TestUser2025!";

// ============== HELPERS ==============

async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============== SEED DATA ==============

const sampleStudies = [
  {
    title: "Effectiveness of cognitive behavioral therapy for depression: A systematic review",
    abstract: "Background: Cognitive behavioral therapy (CBT) is widely used for treating depression. This systematic review aims to evaluate the effectiveness of CBT compared to other treatments and control conditions. Methods: We searched PubMed, PsycINFO, and Cochrane Library for randomized controlled trials. Results: 45 studies met inclusion criteria. CBT showed significant effects compared to waitlist controls (SMD = 0.85, 95% CI: 0.72-0.98). Conclusions: CBT is an effective treatment for depression.",
    authors: [{ name: "Smith J", affiliation: "Harvard Medical School" }, { name: "Johnson A" }],
    year: 2023,
    journal: "Journal of Clinical Psychology",
    doi: "10.1234/jcp.2023.001",
    pmid: "12345678",
    keywords: ["depression", "CBT", "systematic review", "mental health"],
  },
  {
    title: "Impact of exercise on anxiety disorders: Meta-analysis of randomized trials",
    abstract: "Objective: To quantify the effects of exercise interventions on anxiety symptoms. Design: Meta-analysis of 32 randomized controlled trials. Participants: Adults with diagnosed anxiety disorders. Interventions: Aerobic and resistance exercise programs. Main outcome measures: Standardized anxiety scales. Results: Exercise significantly reduced anxiety symptoms (g = 0.67, p < 0.001). Conclusion: Exercise is a viable adjunct treatment for anxiety.",
    authors: [{ name: "Williams R", affiliation: "Stanford University" }, { name: "Brown K" }, { name: "Davis M" }],
    year: 2023,
    journal: "Sports Medicine",
    doi: "10.1234/sm.2023.042",
    keywords: ["anxiety", "exercise", "meta-analysis", "physical activity"],
  },
  {
    title: "Mindfulness-based interventions for chronic pain management",
    abstract: "This review examines the efficacy of mindfulness-based stress reduction (MBSR) and mindfulness-based cognitive therapy (MBCT) for chronic pain. A comprehensive search identified 28 eligible studies with 2,341 participants. Results indicate moderate effects on pain intensity and substantial improvements in quality of life.",
    authors: [{ name: "Chen L" }, { name: "Wilson E", affiliation: "UCLA" }],
    year: 2022,
    journal: "Pain Medicine",
    doi: "10.1234/pm.2022.089",
    pmid: "23456789",
    keywords: ["mindfulness", "chronic pain", "MBSR", "MBCT"],
  },
  {
    title: "Telehealth interventions during COVID-19: A rapid systematic review",
    abstract: "The COVID-19 pandemic accelerated the adoption of telehealth services. This rapid review synthesizes evidence from 56 studies on telehealth effectiveness across various healthcare domains during the pandemic period. Findings suggest comparable outcomes to in-person care for many conditions.",
    authors: [{ name: "Anderson P" }, { name: "Taylor S" }, { name: "Martin J" }, { name: "Lee H" }],
    year: 2021,
    journal: "Telemedicine and e-Health",
    doi: "10.1234/teh.2021.033",
    keywords: ["telehealth", "COVID-19", "pandemic", "remote care"],
  },
  {
    title: "Nutritional interventions for type 2 diabetes: Umbrella review of systematic reviews",
    abstract: "Objective: To synthesize evidence from systematic reviews on dietary interventions for type 2 diabetes management. Methods: Umbrella review methodology following PRISMA guidelines. Results: 18 systematic reviews included. Mediterranean diet and low-carbohydrate diets showed consistent benefits for glycemic control.",
    authors: [{ name: "Garcia M", affiliation: "Mayo Clinic" }, { name: "Rodriguez A" }],
    year: 2023,
    journal: "Diabetes Care",
    doi: "10.1234/dc.2023.177",
    pmid: "34567890",
    keywords: ["diabetes", "nutrition", "diet", "glycemic control"],
  },
  {
    title: "Effectiveness of school-based mental health programs: Systematic review and meta-analysis",
    abstract: "Background: School-based mental health programs aim to prevent and treat mental health issues in children and adolescents. This systematic review evaluates the effectiveness of universal and targeted interventions. We identified 67 studies with 89,224 participants.",
    authors: [{ name: "Thompson R" }, { name: "White C", affiliation: "Columbia University" }, { name: "Harris D" }],
    year: 2022,
    journal: "Child Development",
    doi: "10.1234/cd.2022.055",
    keywords: ["school-based", "mental health", "children", "adolescents", "prevention"],
  },
  {
    title: "Artificial intelligence in diagnostic imaging: A systematic review of accuracy studies",
    abstract: "This review evaluates the diagnostic accuracy of AI systems compared to human experts across various imaging modalities. Analysis of 82 studies shows AI achieves comparable or superior sensitivity and specificity for detecting abnormalities in radiology, dermatology, and pathology.",
    authors: [{ name: "Kim S" }, { name: "Patel R", affiliation: "MIT" }],
    year: 2023,
    journal: "Radiology",
    doi: "10.1234/rad.2023.201",
    pmid: "45678901",
    keywords: ["artificial intelligence", "diagnostic imaging", "machine learning", "accuracy"],
  },
  {
    title: "Pharmacological treatments for insomnia: Network meta-analysis",
    abstract: "Objective: To compare the efficacy and safety of pharmacological treatments for insomnia. Design: Network meta-analysis of 154 randomized trials. Results: Z-drugs and dual orexin receptor antagonists showed superior efficacy with acceptable safety profiles.",
    authors: [{ name: "Jones B" }, { name: "Miller T" }, { name: "Clark A", affiliation: "Johns Hopkins" }],
    year: 2022,
    journal: "Sleep Medicine Reviews",
    doi: "10.1234/smr.2022.099",
    keywords: ["insomnia", "pharmacotherapy", "network meta-analysis", "sleep disorders"],
  },
  {
    title: "Virtual reality exposure therapy for phobias: Updated systematic review",
    abstract: "Virtual reality exposure therapy (VRET) has emerged as a promising treatment for specific phobias. This updated systematic review includes 48 trials. VRET demonstrates large effect sizes and good maintenance of treatment gains at follow-up.",
    authors: [{ name: "Robinson K", affiliation: "Oxford University" }, { name: "Hall E" }],
    year: 2023,
    journal: "Behaviour Research and Therapy",
    doi: "10.1234/brt.2023.012",
    keywords: ["virtual reality", "exposure therapy", "phobias", "anxiety"],
  },
  {
    title: "Early intervention programs for autism spectrum disorder: Comprehensive review",
    abstract: "This comprehensive review examines early intervention approaches for children with autism spectrum disorder. We analyzed 92 studies evaluating behavioral, developmental, and naturalistic interventions. Results support intensive early intervention, particularly approaches incorporating parent training.",
    authors: [{ name: "Murphy L" }, { name: "Green S" }, { name: "Adams J", affiliation: "Yale" }, { name: "Baker N" }],
    year: 2023,
    journal: "Journal of Autism and Developmental Disorders",
    doi: "10.1234/jadd.2023.088",
    pmid: "56789012",
    keywords: ["autism", "early intervention", "ASD", "developmental disorders"],
  },
];

// ============== MAIN SEED FUNCTION ==============

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ---------- Clean existing data ----------
  console.log("🧹 Cleaning existing data...");
  await prisma.screeningDecisionRecord.deleteMany();
  await prisma.conflict.deleteMany();
  await prisma.projectWork.deleteMany();
  await prisma.work.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.apiKeyUsage.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  // ---------- Create Users ----------
  console.log("👤 Creating users...");

  const adminPassword = await hashPassword(ADMIN_PASSWORD);
  const testPassword = await hashPassword(TEST_USER_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: ADMIN_EMAIL,
      password: adminPassword,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ Admin: ${admin.email}`);

  const researcher1 = await prisma.user.create({
    data: {
      name: "Dr. Sarah Chen",
      email: "sarah.chen@example.com",
      password: testPassword,
      role: "USER",
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ Researcher: ${researcher1.email}`);

  const researcher2 = await prisma.user.create({
    data: {
      name: "Prof. James Wilson",
      email: "james.wilson@example.com",
      password: testPassword,
      role: "USER",
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ Researcher: ${researcher2.email}`);

  const reviewer1 = await prisma.user.create({
    data: {
      name: "Maria Garcia",
      email: "maria.garcia@example.com",
      password: testPassword,
      role: "USER",
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ Reviewer: ${reviewer1.email}`);

  const reviewer2 = await prisma.user.create({
    data: {
      name: "David Kim",
      email: "david.kim@example.com",
      password: testPassword,
      role: "USER",
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ Reviewer: ${reviewer2.email}`);

  // ---------- Create Organization ----------
  console.log("\n🏢 Creating organization...");

  const org = await prisma.organization.create({
    data: {
      name: "Research Institute",
      slug: "research-institute",
      primaryColor: "#4F46E5",
      tier: "TEAM",
      maxProjects: 20,
      maxMembers: 50,
      maxStudiesPerProject: 5000,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: researcher1.id, role: "ADMIN" },
          { userId: researcher2.id, role: "MEMBER" },
          { userId: reviewer1.id, role: "MEMBER" },
          { userId: reviewer2.id, role: "MEMBER" },
        ],
      },
    },
  });
  console.log(`   ✓ Organization: ${org.name} (${org.slug})`);

  // ---------- Create Projects ----------
  console.log("\n📁 Creating projects...");

  const project1 = await prisma.project.create({
    data: {
      title: "Mental Health Interventions Systematic Review",
      description: "A comprehensive systematic review examining the effectiveness of various mental health interventions including CBT, mindfulness, and exercise.",
      slug: "mental-health-interventions-sr",
      status: "ACTIVE",
      population: "Adults with diagnosed mental health conditions",
      intervention: "CBT, mindfulness-based interventions, exercise programs",
      comparison: "Standard care, waitlist control, placebo",
      outcome: "Symptom reduction, quality of life, functioning",
      isPublic: false,
      requireDualScreening: true,
      organizationId: org.id,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: researcher1.id, role: "LEAD" },
          { userId: reviewer1.id, role: "REVIEWER" },
          { userId: reviewer2.id, role: "REVIEWER" },
        ],
      },
    },
  });
  console.log(`   ✓ Project: ${project1.title}`);

  const project2 = await prisma.project.create({
    data: {
      title: "Digital Health Technologies Review",
      description: "Review of telehealth and AI-based diagnostic tools effectiveness.",
      slug: "digital-health-tech-review",
      status: "ACTIVE",
      population: "Healthcare recipients using digital health technologies",
      intervention: "Telehealth, AI diagnostics, mobile health apps",
      comparison: "Traditional in-person care",
      outcome: "Diagnostic accuracy, patient outcomes, satisfaction",
      isPublic: true,
      requireDualScreening: false,
      organizationId: org.id,
      members: {
        create: [
          { userId: researcher2.id, role: "OWNER" },
          { userId: researcher1.id, role: "REVIEWER" },
        ],
      },
    },
  });
  console.log(`   ✓ Project: ${project2.title}`);

  // ---------- Create Works and ProjectWorks ----------
  console.log("\n📚 Creating studies...");

  const statuses: ProjectWorkStatus[] = ["PENDING", "INCLUDED", "EXCLUDED", "MAYBE", "SCREENING"];
  const phases: ScreeningPhase[] = ["TITLE_ABSTRACT", "FULL_TEXT"];
  const decisions = ["INCLUDE", "EXCLUDE", "MAYBE"] as const;

  for (let i = 0; i < sampleStudies.length; i++) {
    const study = sampleStudies[i];
    
    const work = await prisma.work.create({
      data: {
        title: study.title,
        abstract: study.abstract,
        authors: study.authors,
        year: study.year,
        journal: study.journal,
        doi: study.doi,
        pmid: study.pmid,
        keywords: study.keywords,
        citationCount: Math.floor(Math.random() * 500),
      },
    });

    // Add to project 1
    const status: ProjectWorkStatus = statuses[i % statuses.length];
    const phase: ScreeningPhase = i < 5 ? "TITLE_ABSTRACT" : "FULL_TEXT";
    
    const projectWork = await prisma.projectWork.create({
      data: {
        projectId: project1.id,
        workId: work.id,
        status: status,
        phase: phase,
        importSource: "PubMed",
        finalDecision: status === "INCLUDED" ? "INCLUDE" : status === "EXCLUDED" ? "EXCLUDE" : null,
      },
    });

    // Create screening decisions for some studies
    if (status === "INCLUDED" || status === "EXCLUDED") {
      const decision = status === "INCLUDED" ? "INCLUDE" : "EXCLUDE";
      
      await prisma.screeningDecisionRecord.create({
        data: {
          projectWorkId: projectWork.id,
          reviewerId: reviewer1.id,
          phase: "TITLE_ABSTRACT",
          decision: decision,
          reasoning: `Study ${decision.toLowerCase()}d based on relevance to research question.`,
          timeSpentMs: Math.floor(Math.random() * 180000) + 30000,
        },
      });

      await prisma.screeningDecisionRecord.create({
        data: {
          projectWorkId: projectWork.id,
          reviewerId: reviewer2.id,
          phase: "TITLE_ABSTRACT",
          decision: decision,
          reasoning: `Agreed with ${decision.toLowerCase()} decision.`,
          timeSpentMs: Math.floor(Math.random() * 180000) + 30000,
        },
      });
    }

    // Add some studies to project 2
    if (i >= 3 && i <= 7) {
      await prisma.projectWork.create({
        data: {
          projectId: project2.id,
          workId: work.id,
          status: "PENDING",
          phase: "TITLE_ABSTRACT",
          importSource: "Web of Science",
        },
      });
    }

    console.log(`   ✓ Study ${i + 1}/${sampleStudies.length}: ${study.title.substring(0, 50)}...`);
  }

  // ---------- Create a Conflict ----------
  console.log("\n⚠️ Creating sample conflict...");

  const conflictStudy = await prisma.work.create({
    data: {
      title: "Controversial treatment efficacy study",
      abstract: "A study with mixed results that could lead to different interpretations among reviewers.",
      authors: [{ name: "Author A" }, { name: "Author B" }],
      year: 2023,
      journal: "Controversial Journal",
    },
  });

  const conflictProjectWork = await prisma.projectWork.create({
    data: {
      projectId: project1.id,
      workId: conflictStudy.id,
      status: "CONFLICT",
      phase: "TITLE_ABSTRACT",
      importSource: "Manual",
    },
  });

  await prisma.screeningDecisionRecord.createMany({
    data: [
      {
        projectWorkId: conflictProjectWork.id,
        reviewerId: reviewer1.id,
        phase: "TITLE_ABSTRACT",
        decision: "INCLUDE",
        reasoning: "Relevant to our research question despite methodological concerns.",
      },
      {
        projectWorkId: conflictProjectWork.id,
        reviewerId: reviewer2.id,
        phase: "TITLE_ABSTRACT",
        decision: "EXCLUDE",
        reasoning: "Methodological quality is too low for inclusion.",
      },
    ],
  });

  await prisma.conflict.create({
    data: {
      projectId: project1.id,
      projectWorkId: conflictProjectWork.id,
      phase: "TITLE_ABSTRACT",
      status: "PENDING",
      decisions: [
        { reviewerId: reviewer1.id, decision: "INCLUDE", reasoning: "Relevant to our research question despite methodological concerns." },
        { reviewerId: reviewer2.id, decision: "EXCLUDE", reasoning: "Methodological quality is too low for inclusion." },
      ],
    },
  });
  console.log("   ✓ Conflict created for resolution");

  // ---------- Create Review Protocol ----------
  console.log("\n📋 Creating review protocol...");

  await prisma.reviewProtocol.create({
    data: {
      projectId: project1.id,
      title: "Mental Health Interventions Review Protocol",
      version: 1,
      status: "APPROVED" as ProtocolStatus,
      content: {
        inclusionCriteria: {
          studyTypes: ["RCT", "Systematic Review", "Meta-analysis"],
          population: "Adults 18+ with diagnosed mental health conditions",
          intervention: "Any psychological or behavioral intervention",
          comparator: "Standard care, placebo, or waitlist",
          outcomes: "Primary: symptom reduction; Secondary: quality of life",
        },
        exclusionCriteria: {
          studyTypes: ["Case reports", "Opinion pieces"],
          population: "Children, adolescents, animal studies",
          other: "Non-English language, conference abstracts only",
        },
        picoFramework: {
          population: "Adults with diagnosed mental health conditions",
          intervention: "CBT, mindfulness, exercise",
          comparison: "Standard care, waitlist",
          outcome: "Symptom reduction, quality of life",
        },
        studyTypes: ["RCT", "Systematic Review"],
      },
    },
  });
  console.log("   ✓ Review protocol created");

  // ---------- Create Activities ----------
  console.log("\n📝 Creating activity log...");

  const activities = [
    { type: "PROJECT_UPDATED", description: "Project settings updated", userId: admin.id },
    { type: "STUDY_IMPORTED", description: "Imported 10 studies from PubMed", userId: researcher1.id },
    { type: "SCREENING_DECISION", description: "Made screening decision", userId: reviewer1.id },
    { type: "TEAM_MEMBER_ADDED", description: "Added new team member", userId: admin.id },
  ];

  for (const activity of activities) {
    await prisma.activity.create({
      data: {
        userId: activity.userId,
        projectId: project1.id,
        type: activity.type as "PROJECT_UPDATED" | "STUDY_IMPORTED" | "SCREENING_DECISION" | "TEAM_MEMBER_ADDED",
        description: activity.description,
        metadata: {},
      },
    });
  }
  console.log(`   ✓ Created ${activities.length} activity entries`);

  // ---------- Create Import Batch ----------
  console.log("\n📥 Creating import batch...");

  await prisma.importBatch.create({
    data: {
      projectId: project1.id,
      filename: "pubmed_export_2024.ris",
      fileType: "RIS",
      fileSize: 102400, // ~100KB
      status: "COMPLETED" as ImportStatus,
      totalRecords: sampleStudies.length,
      processedRecords: sampleStudies.length,
      duplicatesFound: 2,
      errorsCount: 0,
    },
  });
  console.log("   ✓ Import batch created");

  // ---------- Summary ----------
  console.log("\n" + "=".repeat(50));
  console.log("✅ Database seeded successfully!\n");
  console.log("📊 Summary:");
  console.log(`   - Users: 5`);
  console.log(`   - Organizations: 1`);
  console.log(`   - Projects: 2`);
  console.log(`   - Studies: ${sampleStudies.length + 1}`);
  console.log(`   - Conflicts: 1`);
  console.log("\n🔐 Login credentials:");
  console.log(`   Admin:      ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   Test users: [email]@example.com / ${TEST_USER_PASSWORD}`);
  console.log("=".repeat(50) + "\n");
}

// ============== RUN ==============

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
