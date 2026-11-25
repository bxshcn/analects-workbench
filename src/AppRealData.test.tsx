import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import App from "./App";

function readJson(file: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "public", "data", file), "utf8"),
  );
}

const payloads: Record<string, unknown> = {
  "core-graph.json": readJson("core-graph.json"),
  "node-details.json": readJson("node-details.json"),
  "co-edges.json": readJson("co-edges.json"),
  "verses.json": readJson("verses.json"),
};

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as Response;
}

describe("App real data", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const key = Object.keys(payloads).find((name) => url.includes(name));
        return key
          ? jsonResponse(payloads[key])
          : ({ ok: false, status: 404, json: async () => ({}) } as Response);
      }),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    });
    Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("真实规模数据可渲染人物关系弦图", async () => {
    render(<App />);
    expect(await screen.findByText("人物关系有向弦图")).toBeTruthy();
    const personSvg = document.querySelector('svg[aria-label*="人物关系有向弦图"]');
    expect(personSvg).toBeTruthy();
    expect(personSvg?.querySelectorAll("path").length).toBeGreaterThan(100);
    expect(personSvg?.querySelectorAll("text").length).toBeGreaterThan(20);
  });
});
