import { describe, expect, it } from "vitest";

import { BRAND, subdomainHost } from "./site";

describe("site config", () => {
  it("uses the zxcrunet brand", () => {
    expect(BRAND).toBe("zxcrunet");
  });

  it("builds a subdomain host", () => {
    expect(subdomainHost("kulebyakin", "zxc.ru.net")).toBe("kulebyakin.zxc.ru.net");
  });
});
