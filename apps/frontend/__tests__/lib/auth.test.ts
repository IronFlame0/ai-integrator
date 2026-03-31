import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiRegister, apiLogin, saveToken, getToken, getUser, logout } from "@/lib/auth";

describe("auth lib", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  describe("saveToken / getToken / getUser / logout", () => {
    it("saves and retrieves token", () => {
      saveToken("my-token", { id: "1", email: "a@b.com" });
      expect(getToken()).toBe("my-token");
    });

    it("saves and retrieves user", () => {
      saveToken("tok", { id: "42", email: "x@y.com" });
      expect(getUser()).toEqual({ id: "42", email: "x@y.com" });
    });

    it("logout clears storage", () => {
      saveToken("tok", { id: "1", email: "a@b.com" });
      logout();
      expect(getToken()).toBeNull();
      expect(getUser()).toBeNull();
    });

    it("getToken returns null when empty", () => {
      expect(getToken()).toBeNull();
    });

    it("getUser returns null when empty", () => {
      expect(getUser()).toBeNull();
    });
  });

  describe("apiRegister", () => {
    it("returns data on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "tok", user: { id: "1", email: "a@b.com" } }),
      } as any);

      const data = await apiRegister("a@b.com", "password123");
      expect(data.token).toBe("tok");
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws on error response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Email taken" }),
      } as any);

      await expect(apiRegister("taken@b.com", "pass")).rejects.toThrow("Email taken");
    });

    it("throws default message when no detail", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as any);

      await expect(apiRegister("x@b.com", "pass")).rejects.toThrow();
    });
  });

  describe("apiLogin", () => {
    it("returns data on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "tok", user: { id: "1", email: "a@b.com" } }),
      } as any);

      const data = await apiLogin("a@b.com", "pass");
      expect(data.token).toBe("tok");
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws on error response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Invalid credentials" }),
      } as any);

      await expect(apiLogin("a@b.com", "wrong")).rejects.toThrow("Invalid credentials");
    });
  });
});
