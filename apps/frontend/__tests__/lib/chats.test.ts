import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchChats, createChat, fetchMessages, saveMessage,
  fetchUsage, incrementUsage, fetchModels, updateContextTokens,
  deleteChat, renameChat,
} from "@/lib/chats";

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

  describe("fetchModels", () => {
    it("returns models on success", async () => {
      mockFetch(true, [{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", context_limit: 1048576 }]);
      const models = await fetchModels();
      expect(models).toHaveLength(1);
      expect(models[0].context_limit).toBe(1048576);
    });

    it("returns [] on error", async () => {
      mockFetch(false, {});
      expect(await fetchModels()).toEqual([]);
    });
  });

  describe("fetchChats", () => {
    it("returns list with context_tokens on success", async () => {
      mockFetch(true, [{ id: "1", title: "Chat", context_tokens: 512, created_at: "", updated_at: "" }]);
      const chats = await fetchChats();
      expect(chats).toHaveLength(1);
      expect(chats[0].id).toBe("1");
      expect(chats[0].context_tokens).toBe(512);
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
      mockFetch(true, { used: 1500, limit: 100000, remaining: 98500 });
      const result = await incrementUsage(1500);
      expect(result.used).toBe(1500);
      expect(fetch).toHaveBeenCalledWith(
        "/api/usage/increment",
        expect.objectContaining({ body: JSON.stringify({ tokens: 1500 }) })
      );
    });

    it("throws on 429", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ detail: "Limit exceeded" }),
      } as any);
      await expect(incrementUsage(100)).rejects.toThrow("Limit exceeded");
    });
  });

  describe("updateContextTokens", () => {
    it("sends PATCH with context_tokens", async () => {
      mockFetch(true, { id: "chat-1", context_tokens: 2048 });
      await updateContextTokens("chat-1", 2048);
      expect(fetch).toHaveBeenCalledWith(
        "/api/chats/chat-1/context",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ context_tokens: 2048 }),
        })
      );
    });

    it("throws on error", async () => {
      mockFetch(false, {}, 500);
      await expect(updateContextTokens("chat-1", 100)).rejects.toThrow();
    });
  });

  describe("deleteChat", () => {
    it("sends DELETE request", async () => {
      mockFetch(true, null, 204);
      await deleteChat("chat-1");
      expect(fetch).toHaveBeenCalledWith(
        "/api/chats/chat-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("throws on error", async () => {
      mockFetch(false, {}, 404);
      await expect(deleteChat("chat-1")).rejects.toThrow();
    });
  });

  describe("renameChat", () => {
    it("sends PATCH with title", async () => {
      mockFetch(true, {});
      await renameChat("chat-1", "New Name");
      expect(fetch).toHaveBeenCalledWith(
        "/api/chats/chat-1/title",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "New Name" }),
        })
      );
    });

    it("throws on error", async () => {
      mockFetch(false, {}, 500);
      await expect(renameChat("chat-1", "x")).rejects.toThrow();
    });
  });
});
