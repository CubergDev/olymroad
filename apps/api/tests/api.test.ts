import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("API Integration Tests", () => {
  it("should export app instance", () => {
    expect(app).toBeDefined();
  });

  // Tests below require running database (bun run infra:up)
  it.skip("GET /health should return database: up", async () => {
    const request = new Request("http://localhost/health");
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok", database: "up" });
  });

  it.skip("POST /auth/register should create a user and return token", async () => {
    const email = `test-${Date.now()}@example.com`;
    const request = new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email,
        password: "password123",
        role: "student",
      }),
    });

    const response = await app.handle(request);
    expect(response.status).toBe(200);

    const body = await response.json() as any;
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe("student");
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
  });

  it.skip("POST /auth/login should return token for valid credentials", async () => {
    const email = `login-${Date.now()}@example.com`;
    const password = "password123";

    // Register first
    await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Login User",
          email,
          password,
          role: "student",
        }),
      })
    );

    // Login
    const loginRequest = new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const response = await app.handle(loginRequest);
    expect(response.status).toBe(200);

    const body = await response.json() as any;
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(email);
    expect(body.token).toBeDefined();
  });
});
