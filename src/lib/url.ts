import { RELATION_ZH, isSymmetricRelation } from "./constants";
import type { Direction, Relation } from "../types/data";

export interface UrlState {
  node?: string;
  target?: string;
  rel?: Relation;
  dir?: Direction;
}

function isRelation(value: string | null): value is Relation {
  return value !== null && value in RELATION_ZH;
}

function isDirection(value: string | null): value is Direction {
  return value === "in" || value === "out";
}

export function parseUrl(search: string): UrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const state: UrlState = {};
  const node = params.get("node");
  if (node) state.node = node;
  const target = params.get("target");
  if (target) state.target = target;
  const rel = params.get("rel");
  if (isRelation(rel)) {
    state.rel = rel;
    const dir = params.get("dir");
    if (isSymmetricRelation(rel)) {
      state.dir = undefined;
    } else if (isDirection(dir)) {
      state.dir = dir;
    }
  }
  return state;
}

export function buildUrlState(state: {
  node: string | null;
  target: string | null;
  relation: Relation | null;
  direction: Direction | null;
}): UrlState {
  const result: UrlState = {};
  if (state.node) result.node = state.node;
  if (state.node && state.target && state.relation) {
    result.target = state.target;
    result.rel = state.relation;
    if (!isSymmetricRelation(state.relation) && state.direction) {
      result.dir = state.direction;
    }
  }
  return result;
}

export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.node) params.set("node", state.node);
  if (state.target) params.set("target", state.target);
  if (state.rel) params.set("rel", state.rel);
  if (state.dir) params.set("dir", state.dir);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function replaceUrl(state: UrlState): void {
  const next = `${window.location.pathname}${serializeUrlState(state)}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
}
