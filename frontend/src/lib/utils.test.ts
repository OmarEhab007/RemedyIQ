import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("utils", () => {
  describe("cn", () => {
    it("merges class names correctly", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("handles conditional classes", () => {
      expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    });

    it("handles undefined and null", () => {
      expect(cn("foo", undefined, "bar", null)).toBe("foo bar");
    });

    it("merges tailwind classes correctly", () => {
      // twMerge should handle conflicting tailwind classes
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    });

    it("handles arrays of classes", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    it("handles objects with boolean values", () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
    });

    it("combines multiple inputs", () => {
      expect(cn("base", { active: true, disabled: false }, ["extra"])).toBe(
        "base active extra"
      );
    });

    it("returns empty string for no arguments", () => {
      expect(cn()).toBe("");
    });

    it("returns empty string for all falsy values", () => {
      expect(cn(false, null, undefined, "")).toBe("");
    });

    it("handles complex tailwind merge scenarios", () => {
      // Later classes should override earlier ones
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
      expect(cn("text-sm", "text-lg")).toBe("text-lg");
    });
  });
});
