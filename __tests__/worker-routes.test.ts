import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the Hono worker app directly using app.request() which
// does not need a running server. We mock the external auth module
// and D1 database binding.

// Mock the @getmocha/users-service/backend module before importing the app
vi.mock("@getmocha/users-service/backend", () => ({
  getOAuthRedirectUrl: vi.fn().mockResolvedValue("https://accounts.google.com/o/oauth2/auth?mock=1"),
  exchangeCodeForSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  authMiddleware: vi.fn((c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", { id: "user-123", email: "test@example.com" });
    return next();
  }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  MOCHA_SESSION_TOKEN_COOKIE_NAME: "mocha_session",
}));

// Import after mocks
const { default: app } = await import("@/worker/index");

// Helper to create a mock D1 database
function createMockDB(prepareResults: Record<string, Record<string, unknown>> = {}) {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({}),
  };

  return {
    prepare: vi.fn((sql: string) => {
      // Return specific results based on SQL query content
      const key = Object.keys(prepareResults).find((k) => sql.includes(k));
      if (key) {
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue(prepareResults[key].all ?? { results: [] }),
          first: vi.fn().mockResolvedValue(prepareResults[key].first ?? null),
          run: vi.fn().mockResolvedValue(prepareResults[key].run ?? {}),
        };
      }
      return mockStatement;
    }),
  };
}

const mockEnv = {
  MOCHA_USERS_SERVICE_API_URL: "https://mock-api.example.com",
  MOCHA_USERS_SERVICE_API_KEY: "mock-key",
};

describe("Worker routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: GET /api/oauth/google/redirect_url ──

  it("returns a google oauth redirect url", async () => {
    const res = await app.request(
      "/api/oauth/google/redirect_url",
      { method: "GET" },
      { ...mockEnv, DB: createMockDB() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.redirectUrl).toContain("google");
  });

  // ── Test 2: POST /api/sessions without code returns 400 ──

  it("returns 400 when creating session without authorization code", async () => {
    const res = await app.request(
      "/api/sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      { ...mockEnv, DB: createMockDB() },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No authorization code provided");
  });

  // ── Test 3: POST /api/sessions with code returns success ──

  it("creates session successfully with valid code", async () => {
    const res = await app.request(
      "/api/sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "valid-auth-code" }),
      },
      { ...mockEnv, DB: createMockDB() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // ── Test 4: GET /api/categories ──

  it("returns categories from database", async () => {
    const db = createMockDB({
      categories: {
        all: {
          results: [
            { id: 1, name: "Food", slug: "food", is_active: 1 },
            { id: 2, name: "Fitness", slug: "fitness", is_active: 1 },
          ],
        },
      },
    });

    const res = await app.request(
      "/api/categories",
      { method: "GET" },
      { ...mockEnv, DB: db },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe("Food");
  });

  // ── Test 5: GET /api/products ──

  it("returns products list", async () => {
    const db = createMockDB({
      products: {
        all: {
          results: [
            { id: 1, name: "Sushi Combo", price: 89.9, category_name: "Food" },
          ],
        },
      },
    });

    const res = await app.request(
      "/api/products",
      { method: "GET" },
      { ...mockEnv, DB: db },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // ── Test 6: POST /api/orders without items returns 400 ──

  it("rejects order creation without items", async () => {
    const db = createMockDB();

    const res = await app.request(
      "/api/orders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
      },
      { ...mockEnv, DB: db },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Items are required");
  });

  // ── Test 7: GET /api/logout clears session ──

  it("logout returns success and clears cookie", async () => {
    const res = await app.request(
      "/api/logout",
      { method: "GET" },
      { ...mockEnv, DB: createMockDB() },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Check that the session cookie is cleared (maxAge=0)
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("Max-Age=0");
  });
});
