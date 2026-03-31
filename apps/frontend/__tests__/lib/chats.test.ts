import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchChats, createChat, fetchMessages, saveMessage, fetchUsage, incrementUsage } from "@/lib/chats";

vi.mock("@/lib/auth", () => ({
  getToken: vi.fn().mockReturnValue("mock-token"),
}));

function mockFetch(ok: boolean, data: unknown, status = ok ? 200 : 400) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  } as any);
}

describe("chats lib", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchChats", () => {
    it("returns list on success", async () => {
      mockFetch(true, [{ id: "1", title: "Chat", created_at: "", updated_at: "" }]);
      const chats = await fetchChats();
      expect(chats).toHaveLength(1);
      expect(chats[0].id).toBe("1");
    });

    it("returns [] on error", async () => {
      mockFetch(false, {});
      expect(await fetchChats()).toEqual([]);
    });
  });

  describe("createChat", () => {
    it("returns created chat", async () => {
      mockFetch(true, { id: "2", title: "New chat", created_at: "", updated_at: "" });
      const chat = await createChat();
      expect(chat.id).toBe("2");
      expect(fetch).toHaveBeenCalledWith(
        "/api/chats",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("fetchMessages", () => {
    it("returns messages on success", async () => {
      mockFetch(true, [{ id: "m1", role: "user", content: "Hi" }]);
      const msgs = await fetchMessages("chat-1");
      expect(msgs[0].content).toBe("Hi");
    });

    it("returns [] on error", async () => {
      mockFetch(false, {});
      expect(await fetchMessages("chat-1")).toEqual([]);
    });
  });

  describe("saveMessage", () => {
    it("posts to correct endpoint", async () => {
      mockFetch(true, {});
      await saveMessage("chat-1", { role: "user", content: "Hello" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/chats/chat-1/messages",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("fetchUsage", () => {
    it("returns usage on success", async () => {
      mockFetch(true, { used: 5, limit: 50, remaining: 45 });
      const usage = await fetchUsage();
      expect(usage?.remaining).toBe(45);
    });

    it("returns null on error", async () => {
      mockFetch(false, {});
      expect(await fetchUsage()).toBeNull();
    });
  });

  describe("incrementUsage", () => {
    it("returns usage on success", async () => {
      mockFetch(true, { used: 6, limit: 50, remaining: 44 });
      const result = await incrementUsage();
      expect(result.used).toBe(6);
    });

    it("throws on 429", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ detail: "Limit exceeded" }),
      } as any);
      await expect(incrementUsage()).rejects.toThrow("Limit exceeded");
    });
  });
});
