import { describe, it, expect } from "vitest";
import {
  createProjectSchema,
  submitDecisionSchema,
  screeningDecisionSchema,
  addToLibrarySchema,
  createFolderSchema,
} from "../validators";

describe("Validators", () => {
  describe("createProjectSchema", () => {
    it("should validate a valid project", () => {
      const validProject = {
        title: "Test Project",
        description: "A test project description",
      };

      const result = createProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it("should reject project without title", () => {
      const invalidProject = {
        description: "A test project description",
      };

      const result = createProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });

    it("should reject project with too short title", () => {
      const invalidProject = {
        title: "AB",
        description: "A test project description",
      };

      const result = createProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe("screeningDecisionSchema", () => {
    it("should validate valid decision values", () => {
      expect(screeningDecisionSchema.safeParse("INCLUDE").success).toBe(true);
      expect(screeningDecisionSchema.safeParse("EXCLUDE").success).toBe(true);
      expect(screeningDecisionSchema.safeParse("MAYBE").success).toBe(true);
    });

    it("should reject invalid decision value", () => {
      expect(screeningDecisionSchema.safeParse("INVALID").success).toBe(false);
    });
  });

  describe("submitDecisionSchema", () => {
    it("should validate a valid decision submission", () => {
      const validDecision = {
        projectWorkId: "clx123456789012345678901", // cuid format
        phase: "TITLE_ABSTRACT",
        decision: "INCLUDE",
        reasoning: "Relevant to research question",
      };

      const result = submitDecisionSchema.safeParse(validDecision);
      expect(result.success).toBe(true);
    });

    it("should reject invalid phase value", () => {
      const invalidDecision = {
        projectWorkId: "clx123456789012345678901",
        phase: "INVALID_PHASE",
        decision: "INCLUDE",
      };

      const result = submitDecisionSchema.safeParse(invalidDecision);
      expect(result.success).toBe(false);
    });
  });

  describe("addToLibrarySchema", () => {
    it("should validate a valid library item", () => {
      const validItem = {
        workId: "clx123456789012345678901",
        folderId: "clx456789012345678901234",
        notes: "Important paper",
      };

      const result = addToLibrarySchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should accept library item without optional fields", () => {
      const minimalItem = {
        workId: "clx123456789012345678901",
      };

      const result = addToLibrarySchema.safeParse(minimalItem);
      expect(result.success).toBe(true);
    });

    it("should reject item with invalid workId", () => {
      const invalidItem = {
        workId: "invalid-id",
      };

      const result = addToLibrarySchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe("createFolderSchema", () => {
    it("should validate a valid folder", () => {
      const validFolder = {
        name: "My Papers",
        color: "#FF5733",
        icon: "folder",
      };

      const result = createFolderSchema.safeParse(validFolder);
      expect(result.success).toBe(true);
    });

    it("should reject folder with invalid color format", () => {
      const invalidFolder = {
        name: "My Papers",
        color: "red", // Invalid - should be hex
      };

      const result = createFolderSchema.safeParse(invalidFolder);
      expect(result.success).toBe(false);
    });

    it("should use default values when not provided", () => {
      const minimalFolder = {
        name: "My Papers",
      };

      const result = createFolderSchema.safeParse(minimalFolder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#3B82F6");
        expect(result.data.icon).toBe("folder");
      }
    });

    it("should reject folder without name", () => {
      const invalidFolder = {
        color: "#FF5733",
      };

      const result = createFolderSchema.safeParse(invalidFolder);
      expect(result.success).toBe(false);
    });
  });
});
