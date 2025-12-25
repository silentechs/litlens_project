import { PrismaClient, UserRole, ProjectStatus, ScreeningPhase, ProjectWorkStatus, ActivityType } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configure Neon for Node.js
neonConfig.webSocketConstructor = ws;

// Create Prisma client with Neon adapter
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// ============== CONFIGURATION ==============

const ADMIN_USER = {
  email: "silentechs@gmail.com",
  password: "BeProfessional2025",
  name: "System Administrator",
  role: UserRole.ADMIN,
};

const TEST_USERS = [
  {
    email: "researcher@litlens.test",
    password: "TestUser2025!",
    name: "Dr. Jane Researcher",
    role: UserRole.USER,
    institution: "University of Research",
  },
  {
    email: "reviewer@litlens.test",
    password: "TestUser2025!",
    name: "Dr. John Reviewer",
    role: UserRole.USER,
    institution: "Institute of Evidence Synthesis",
  },
  {
    email: "lead@litlens.test",
    password: "TestUser2025!",
    name: "Dr. Sarah Lead",
    role: UserRole.USER,
    institution: "Systematic Review Center",
  },
];

// ============== SEED FUNCTIONS ==============

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function seedUsers() {
  console.log("🌱 Seeding users...");

  // Create admin user
  const adminPassword = await hashPassword(ADMIN_USER.password);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_USER.email },
    update: {
      name: ADMIN_USER.name,
      role: ADMIN_USER.role,
      password: adminPassword,
    },
    create: {
      email: ADMIN_USER.email,
      name: ADMIN_USER.name,
      role: ADMIN_USER.role,
      password: adminPassword,
      emailVerified: new Date(),
      preferences: {
        create: {},
      },
    },
  });
  console.log(`  ✅ Admin: ${admin.email}`);

  // Create test users
  const users = [];
  for (const userData of TEST_USERS) {
    const hashedPassword = await hashPassword(userData.password);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        role: userData.role,
        password: hashedPassword,
        institution: userData.institution,
      },
      create: {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        password: hashedPassword,
        institution: userData.institution,
        emailVerified: new Date(),
        preferences: {
          create: {},
        },
      },
    });
    users.push(user);
    console.log(`  ✅ User: ${user.email}`);
  }

  return { admin, users };
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

async function seedProjects(adminId: string, userIds: string[]) {
  console.log("🌱 Seeding projects...");

  const projects = [
    {
      title: "COVID-19 Treatment Efficacy",
      description: "Systematic review of COVID-19 treatment efficacy across different interventions",
      status: ProjectStatus.ACTIVE,
      blindScreening: true,
      requireDualScreening: true,
    },
    {
      title: "Mental Health Interventions in Schools",
      description: "Systematic review of mental health interventions effectiveness in school settings",
      status: ProjectStatus.ACTIVE,
      blindScreening: false,
      requireDualScreening: false,
    },
    {
      title: "Climate Change and Agriculture",
      description: "Scoping review of climate change impacts on global agricultural practices",
      status: ProjectStatus.DRAFT,
      blindScreening: true,
      requireDualScreening: true,
    },
  ];

  const createdProjects = [];
  for (const projectData of projects) {
    // Generate unique slug
    const baseSlug = generateSlug(projectData.title);
    const slug = `${baseSlug}-${Date.now()}`;

    const project = await prisma.project.create({
      data: {
        title: projectData.title,
        slug,
        description: projectData.description,
        status: projectData.status,
        blindScreening: projectData.blindScreening,
        requireDualScreening: projectData.requireDualScreening,
        members: {
          create: [
            { userId: adminId, role: "OWNER" },
            ...userIds.slice(0, 2).map((userId) => ({
              userId,
              role: "REVIEWER" as const,
            })),
          ],
        },
      },
    });
    createdProjects.push(project);
    console.log(`  ✅ Project: ${project.title}`);
  }

  return createdProjects;
}

async function seedWorks(projectIds: string[]) {
  console.log("🌱 Seeding works (studies)...");

  const sampleWorks = [
    {
      title: "Effectiveness of Remdesivir in Hospitalized COVID-19 Patients: A Randomized Controlled Trial",
      abstract: "Background: Remdesivir has shown antiviral activity against SARS-CoV-2. We conducted a randomized controlled trial to evaluate its effectiveness. Methods: 1062 patients were randomized to receive remdesivir or placebo. Results: Remdesivir shortened recovery time significantly. Conclusion: Remdesivir was superior to placebo.",
      authors: ["Smith, J.", "Johnson, M.", "Williams, K."],
      year: 2023,
      journal: "New England Journal of Medicine",
      doi: "10.1056/nejmoa2007764",
      keywords: ["COVID-19", "remdesivir", "randomized controlled trial", "antiviral"],
    },
    {
      title: "Dexamethasone in Hospitalized Patients with Covid-19 — Preliminary Report",
      abstract: "Coronavirus disease 2019 (Covid-19) is associated with diffuse lung damage. Glucocorticoids may modulate inflammation-mediated lung injury. The RECOVERY trial showed dexamethasone reduced 28-day mortality.",
      authors: ["Brown, A.", "Davis, R.", "Miller, S."],
      year: 2023,
      journal: "Nature Medicine",
      doi: "10.1038/s41591-020-0941-1",
      keywords: ["COVID-19", "dexamethasone", "glucocorticoids", "mortality"],
    },
    {
      title: "Tocilizumab in Patients Hospitalized with Covid-19 Pneumonia",
      abstract: "Tocilizumab, an interleukin-6 receptor antagonist, might benefit patients with severe Covid-19 pneumonia. This randomized trial evaluated tocilizumab efficacy.",
      authors: ["Garcia, L.", "Martinez, P.", "Lopez, R."],
      year: 2022,
      journal: "JAMA Internal Medicine",
      doi: "10.1001/jamainternmed.2020.6820",
      keywords: ["COVID-19", "tocilizumab", "interleukin-6", "pneumonia"],
    },
    {
      title: "School-Based Mental Health Programs: A Meta-Analysis of Effectiveness",
      abstract: "This meta-analysis examined 127 studies on school-based mental health interventions. Results indicate moderate effectiveness for anxiety and depression prevention.",
      authors: ["Anderson, K.", "Thompson, E.", "White, J."],
      year: 2023,
      journal: "Journal of School Psychology",
      doi: "10.1016/j.jsp.2023.01.003",
      keywords: ["mental health", "schools", "meta-analysis", "adolescents"],
    },
    {
      title: "Cognitive Behavioral Therapy in Schools: Implementation and Outcomes",
      abstract: "This study evaluated CBT implementation in secondary schools across 50 institutions. Findings suggest significant improvements in student well-being.",
      authors: ["Chen, W.", "Park, S.", "Kim, H."],
      year: 2022,
      journal: "Child Development",
      doi: "10.1111/cdev.13845",
      keywords: ["CBT", "schools", "implementation", "well-being"],
    },
    {
      title: "Climate Change Effects on Crop Yields: A Global Assessment",
      abstract: "Using data from 32 countries, this study assessed climate change impacts on major crop yields. Results show significant regional variations.",
      authors: ["Patel, R.", "Singh, A.", "Kumar, V."],
      year: 2023,
      journal: "Nature Climate Change",
      doi: "10.1038/s41558-023-01697-5",
      keywords: ["climate change", "agriculture", "crop yields", "food security"],
    },
  ];

  const createdWorks = [];
  for (const workData of sampleWorks) {
    // Use upsert to handle re-runs of seed
    const work = await prisma.work.upsert({
      where: { doi: workData.doi ?? "" },
      update: {
        title: workData.title,
        abstract: workData.abstract,
        authors: workData.authors,
        year: workData.year,
        journal: workData.journal,
        keywords: workData.keywords,
      },
      create: {
        ...workData,
        source: "seed",
      },
    });
    createdWorks.push(work);
    console.log(`  ✅ Work: ${work.title.substring(0, 50)}...`);
  }

  // Link works to projects
  console.log("🌱 Linking works to projects...");
  
  // First project gets COVID works
  const covidWorks = createdWorks.filter((w) => 
    w.keywords?.some((k) => k.toLowerCase().includes("covid"))
  );
  for (const work of covidWorks) {
    await prisma.projectWork.upsert({
      where: { projectId_workId: { projectId: projectIds[0], workId: work.id } },
      update: {},
      create: {
        projectId: projectIds[0],
        workId: work.id,
        status: ProjectWorkStatus.PENDING,
        phase: ScreeningPhase.TITLE_ABSTRACT,
      },
    });
  }

  // Second project gets mental health works
  const mentalHealthWorks = createdWorks.filter((w) =>
    w.keywords?.some((k) => k.toLowerCase().includes("mental") || k.toLowerCase().includes("cbt"))
  );
  for (const work of mentalHealthWorks) {
    await prisma.projectWork.upsert({
      where: { projectId_workId: { projectId: projectIds[1], workId: work.id } },
      update: {},
      create: {
        projectId: projectIds[1],
        workId: work.id,
        status: ProjectWorkStatus.PENDING,
        phase: ScreeningPhase.TITLE_ABSTRACT,
      },
    });
  }

  // Third project gets climate works
  const climateWorks = createdWorks.filter((w) =>
    w.keywords?.some((k) => k.toLowerCase().includes("climate"))
  );
  for (const work of climateWorks) {
    await prisma.projectWork.upsert({
      where: { projectId_workId: { projectId: projectIds[2], workId: work.id } },
      update: {},
      create: {
        projectId: projectIds[2],
        workId: work.id,
        status: ProjectWorkStatus.PENDING,
        phase: ScreeningPhase.TITLE_ABSTRACT,
      },
    });
  }

  return createdWorks;
}

async function seedLibraryItems(userId: string, workIds: string[]) {
  console.log("🌱 Seeding library items...");

  // Create a folder (check first, then create if needed)
  let folder = await prisma.libraryFolder.findFirst({
    where: {
      userId,
      name: "Favorite Papers",
      parentId: null,
    },
  });

  if (!folder) {
    folder = await prisma.libraryFolder.create({
      data: {
        userId,
        name: "Favorite Papers",
        color: "#3B82F6",
        icon: "star",
      },
    });
  }
  console.log(`  ✅ Folder: ${folder.name}`);

  // Add some works to library
  let addedCount = 0;
  for (const workId of workIds.slice(0, 3)) {
    await prisma.libraryItem.upsert({
      where: { userId_workId: { userId, workId } },
      update: {
        folderId: folder.id,
        tags: ["important", "to-read"],
      },
      create: {
        userId,
        workId,
        folderId: folder.id,
        tags: ["important", "to-read"],
        readingStatus: "TO_READ",
      },
    });
    addedCount++;
  }
  console.log(`  ✅ Added ${addedCount} items to library`);
}

async function seedActivities(userId: string, projectId: string) {
  console.log("🌱 Seeding activities...");

  const activities = [
    {
      type: ActivityType.PROJECT_CREATED,
      description: "Created project: COVID-19 Treatment Efficacy",
    },
    {
      type: ActivityType.STUDY_IMPORTED,
      description: "Imported 3 studies from PubMed search",
    },
    {
      type: ActivityType.PROJECT_UPDATED,
      description: "Started title/abstract screening phase",
    },
  ];

  for (const activity of activities) {
    await prisma.activity.create({
      data: {
        userId,
        projectId,
        type: activity.type,
        description: activity.description,
      },
    });
  }
  console.log(`  ✅ Created ${activities.length} activity records`);
}

// ============== MAIN SEED FUNCTION ==============

async function main() {
  console.log("\n🚀 Starting database seed...\n");

  try {
    // Seed users
    const { admin, users } = await seedUsers();

    // Seed projects
    const projects = await seedProjects(
      admin.id,
      users.map((u) => u.id)
    );

    // Seed works
    const works = await seedWorks(projects.map((p) => p.id));

    // Seed library items for admin
    await seedLibraryItems(admin.id, works.map((w) => w.id));

    // Seed activities
    await seedActivities(admin.id, projects[0].id);

    console.log("\n✨ Database seeded successfully!\n");
    console.log("📋 Test Accounts:");
    console.log("────────────────────────────────────────");
    console.log(`  Admin:      ${ADMIN_USER.email}`);
    console.log(`  Password:   ${ADMIN_USER.password}`);
    console.log("────────────────────────────────────────");
    for (const user of TEST_USERS) {
      console.log(`  User:       ${user.email}`);
      console.log(`  Password:   ${user.password}`);
      console.log("────────────────────────────────────────");
    }
    console.log("");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

