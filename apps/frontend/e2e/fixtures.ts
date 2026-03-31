import { Page } from "@playwright/test";

export const MOCK_TOKEN = "mock-jwt-token";
export const MOCK_USER = { id: "user-1", email: "test@example.com" };
export const MOCK_CHAT = { id: "chat-1", title: "Test chat", created_at: "2024-01-01", updated_at: "2024-01-01" };

export async function mockAuthRoutes(page: Page) {
  await page.route("/api/auth/login", (route) => {
    const body = route.request().postDataJSON();
    if (body.email === "test@example.com" && body.password === "password123") {
      route.fulfill({ json: { token: MOCK_TOKEN, user: MOCK_USER } });
    } else {
      route.fulfill({ status: 401, json: { detail: "Invalid credentials" } });
    }
  });

  await page.route("/api/auth/register", (route) => {
    route.fulfill({ json: { token: MOCK_TOKEN, user: MOCK_USER } });
  });
}

export async function mockChatRoutes(page: Page) {
  await page.route("/api/chats", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: [MOCK_CHAT] });
    } else {
      route.fulfill({ status: 201, json: MOCK_CHAT });
    }
  });

  await page.route("/api/chats/*/messages", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: [] });
    } else {
      route.fulfill({ status: 201, json: { id: "msg-1", role: "user", content: "Hi" } });
    }
  });

  await page.route("/api/usage/today", (route) => {
    route.fulfill({ json: { used: 5, limit: 50, remaining: 45 } });
  });

  await page.route("/api/usage/increment", (route) => {
    route.fulfill({ json: { used: 6, limit: 50, remaining: 44 } });
  });

  await page.route("/api/chats/*/title", (route) => {
    route.fulfill({ json: { id: "chat-1", title: "Updated" } });
  });
}

export async function setAuthState(page: Page) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  }, { token: MOCK_TOKEN, user: MOCK_USER });
}
