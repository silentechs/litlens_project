# litlens_project

LitLens is a comprehensive systematic review and meta-analysis platform built with Next.js, Prisma, and modern web technologies.

## Features

- **Project Management**: Create and manage systematic review projects
- **Screening**: AI-powered abstract and full-text screening with conflict resolution
- **Quality Assessment**: Support for ROB2, ROBINS-I, and other quality assessment tools
- **Data Extraction**: Flexible extraction templates and AI-assisted data extraction
- **Analytics**: Comprehensive analytics and visualization tools
- **Research Graphs**: Citation network visualization
- **Writing Assistant**: AI-powered writing tools for systematic reviews
- **Team Collaboration**: Real-time collaboration with presence indicators
- **Library Management**: Organize and manage research works

## Tech Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Authentication**: NextAuth.js
- **Storage**: Cloudflare R2
- **AI**: OpenAI GPT
- **Real-time**: WebSockets, Server-Sent Events
- **Testing**: Vitest, Playwright

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Cloudflare R2 account (for file storage)
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/silentechs/litlens_project.git
cd litlens_project
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the required environment variables.

4. Run database migrations:
```bash
npm run db:migrate
```

5. Seed the database (optional):
```bash
npm run db:seed
```

6. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:coverage` - Run tests with coverage
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## License

Private - All Rights Reserved

