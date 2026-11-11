import { describe, expect, it } from "vitest";

import { safeNext } from "./next";
import { credentialsSchema, errorText, loginSchema } from "./schemas";

describe("safeNext", () => {
  it.each([
    ["/app", "/app"],
    ["/app/sites?x=1", "/app/sites?x=1"],
  ])("keeps relative path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "app"])(
    "falls back for %s",
    (input) => {
      expect(safeNext(input)).toBe("/app");
    },
  );
});

describe("auth schemas", () => {
  it("trims email and accepts a valid pair", () => {
    const parsed = credentialsSchema.parse({ email: " anna@example.com ", password: "12345678" });

    expect(parsed.email).toBe("anna@example.com");
  });

  it("rejects a short password on registration with a Russian message", () => {
    const result = credentialsSchema.safeParse({ email: "anna@example.com", password: "123" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Пароль должен быть не короче 8 символов");
  });

  it("does not apply password rules on login", () => {
    expect(loginSchema.safeParse({ email: "anna@example.com", password: "x" }).success).toBe(true);
  });
});

describe("errorText", () => {
  it("maps known codes and falls back for unknown ones", () => {
    expect(errorText("email_taken")).toMatch(/уже зарегистрирована/);
    expect(errorText("something_new")).toBe("Что-то пошло не так. Попробуйте ещё раз.");
  });
});
