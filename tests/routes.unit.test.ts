import { describe, expect, it } from "vitest";
import {
  normalizeSiteRoute,
  routeDefinition,
  routeFromSlug,
  siteRouteDefinitions,
  siteRoutes,
} from "../app/site/routes";

describe("public route contract", () => {
  it("defines every supported public route exactly once", () => {
    expect(siteRoutes).toEqual([
      "/",
      "/sobre",
      "/trajetoria",
      "/projetos",
      "/caderno",
      "/formacao",
      "/contato",
    ]);
    expect(new Set(siteRouteDefinitions.map(({ route }) => route)).size).toBe(siteRoutes.length);
  });

  it.each(siteRouteDefinitions)("gives $route route-specific metadata", (definition) => {
    expect(routeDefinition(definition.route)).toEqual(definition);
    expect(definition.title).toMatch(/Mikael/);
    expect(definition.description.trim().length).toBeGreaterThan(20);
    if (definition.route !== "/") {
      expect(definition.title).not.toBe(routeDefinition("/").title);
    }
  });

  it.each([
    [["sobre"], "/sobre"],
    [["trajetoria"], "/trajetoria"],
    [["projetos"], "/projetos"],
    [["caderno"], "/caderno"],
    [["formacao"], "/formacao"],
    [["contato"], "/contato"],
    [undefined, "/"],
  ] as const)("maps slug %j to %s", (slug, expected) => {
    expect(routeFromSlug(slug)).toBe(expected);
  });

  it.each([
    "/nao-existe",
    "/projetos/item",
    "/edit",
    "/api/content",
  ])("does not silently normalize unsupported path %s to the home", (pathname) => {
    expect(normalizeSiteRoute(pathname)).toBeNull();
    expect(routeFromSlug(pathname.slice(1).split("/"))).toBeNull();
  });

  it("accepts trailing slashes but rejects malformed percent escapes", () => {
    expect(normalizeSiteRoute("/contato/")).toBe("/contato");
    expect(routeFromSlug(["%E0%A4%A"])).toBeNull();
  });
});
