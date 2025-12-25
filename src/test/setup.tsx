import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => "/",
}));

// Mock NextAuth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: null,
    status: "unauthenticated",
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
      <button {...props}>{children}</button>
    ),
    span: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
}));

