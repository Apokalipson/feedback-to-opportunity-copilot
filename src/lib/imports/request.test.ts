import { describe, expect, it } from "vitest";
import { isTrustedMutationOrigin } from "./request";

describe("isTrustedMutationOrigin", () => {
  it("accepts a same-host browser mutation", () => {
    const request = new Request("http://localhost:3100/api/imports", {
      headers: {
        host: "localhost:3100",
        origin: "http://localhost:3100",
      },
    });

    expect(isTrustedMutationOrigin(request)).toBe(true);
  });

  it("rejects missing, malformed, and cross-host origins", () => {
    const missing = new Request("http://localhost:3100/api/imports", {
      headers: { host: "localhost:3100" },
    });
    const malformed = new Request("http://localhost:3100/api/imports", {
      headers: { host: "localhost:3100", origin: "not a url" },
    });
    const crossHost = new Request("http://localhost:3100/api/imports", {
      headers: {
        host: "localhost:3100",
        origin: "https://attacker.example",
      },
    });

    expect(isTrustedMutationOrigin(missing)).toBe(false);
    expect(isTrustedMutationOrigin(malformed)).toBe(false);
    expect(isTrustedMutationOrigin(crossHost)).toBe(false);
  });

  it("uses the forwarded host when present", () => {
    const request = new Request("https://internal/api/imports", {
      headers: {
        host: "internal",
        "x-forwarded-host": "product.example",
        origin: "https://product.example",
      },
    });

    expect(isTrustedMutationOrigin(request)).toBe(true);
  });
});
