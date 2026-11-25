import { create } from "zustand";
import { fetchJson } from "../lib/api";
import { computeCoreNodeIds } from "../lib/graph";
import { TAB1_DEFAULT_RELATIONS } from "../lib/constants";
import type {
  CoEdgePackage,
  CoreEdge,
  CoreGraphPackage,
  Direction,
  NodeDetailMap,
  Relation,
  Verse,
} from "../types/data";

export interface FocusNode {
  kind: "node";
  nodeId: string;
  key: string;
}

export interface FocusEdge {
  kind: "edge";
  edgeKey: string;
  sourceId: string;
  targetId: string;
  relation: Relation;
  key: string;
}

export type FocusState = FocusNode | FocusEdge | null;
export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface PackageState<T> {
  status: LoadStatus;
  data: T | null;
  error: string | null;
}

export interface DatasetState {
  core: PackageState<CoreGraphPackage>;
  details: PackageState<NodeDetailMap>;
  coEdges: PackageState<CoEdgePackage>;
  verses: PackageState<Verse[]>;
}

export interface ActiveQuery {
  anchorId: string;
  targetId: string;
  relation: Relation;
  direction: Direction | null;
  verseCodes: string[];
  edgeKey: string;
  origin: "edge" | "capsule" | "deepLink";
}

export type ToastKind = "anchor" | "notice" | "error";

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface AnalectsState {
  data: DatasetState;
  tab1Relations: Relation[];
  logArc: boolean;
  focus: FocusState;
  hover: FocusState;
  anchorId: string | null;
  history: string[];
  historyIndex: number;
  query: ActiveQuery | null;
  readingCode: string | null;
  extendedExploration: boolean;
  toast: ToastMessage | null;
  hydrated: boolean;
}

export interface AnchorOptions {
  origin: "canvas" | "index" | "deepLink" | "history";
  pushHistory?: boolean;
  toast?: boolean;
}

export interface AnalectsActions {
  loadCore: (force?: boolean) => Promise<void>;
  loadBackground: (force?: boolean) => Promise<void>;
  retryBackground: () => Promise<void>;
  selectTab1Relation: (relation: Relation) => void;
  setLogArc: (value: boolean) => void;
  setHover: (state: FocusState) => void;
  setLocked: (state: FocusState) => void;
  clearFocus: () => void;
  anchorNode: (nodeId: string, options?: Partial<AnchorOptions>) => void;
  anchorEdge: (
    edge: CoreEdge,
    options?: { origin?: "canvas" | "index" | "deepLink" },
  ) => void;
  setQuery: (query: ActiveQuery) => void;
  clearQuery: () => void;
  setReadingCode: (code: string | null) => void;
  selectHistory: (index: number) => void;
  clearHistory: () => void;
  returnToLastCore: () => void;
  showToast: (message: string, kind?: ToastKind) => void;
  dismissToast: () => void;
  dismissExtendedExploration: () => void;
  applyDeepLink: (input: {
    nodeId: string | null;
    query: ActiveQuery | null;
    extended: boolean;
  }) => void;
  setHydrated: (value: boolean) => void;
}

export type AnalectsStore = AnalectsState & AnalectsActions;

const MAX_HISTORY = 50;

export function focusNodeState(nodeId: string): FocusNode {
  return { kind: "node", nodeId, key: `node:${nodeId}` };
}

export function focusEdgeState(edge: CoreEdge): FocusEdge {
  return {
    kind: "edge",
    edgeKey: `${edge.source_id}|${edge.relation}|${edge.target_id}`,
    sourceId: edge.source_id,
    targetId: edge.target_id,
    relation: edge.relation,
    key: `edge:${edge.source_id}|${edge.relation}|${edge.target_id}`,
  };
}

function nodeName(
  state: Pick<AnalectsState, "data">,
  nodeId: string | null | undefined,
): string | null {
  if (!nodeId) return null;
  const fromCore = state.data.core.data?.nodes.find((node) => node.id === nodeId);
  if (fromCore) return fromCore.canonical_name;
  return state.data.details.data?.[nodeId]?.canonical_name ?? null;
}

function coreness(state: Pick<AnalectsState, "data">): Set<string> {
  return computeCoreNodeIds(state.data.core.data?.edges ?? []);
}

function nextHistory(
  state: AnalectsState,
  nodeId: string,
): { history: string[]; historyIndex: number } {
  if (state.anchorId === nodeId && state.history.length > 0) {
    return { history: state.history, historyIndex: state.historyIndex };
  }
  const base = state.history.slice(0, state.historyIndex + 1);
  base.push(nodeId);
  const history =
    base.length > MAX_HISTORY ? base.slice(base.length - MAX_HISTORY) : base;
  return { history, historyIndex: history.length - 1 };
}

let toastCounter = 0;

const initialState: AnalectsState = {
  data: {
    core: { status: "idle", data: null, error: null },
    details: { status: "idle", data: null, error: null },
    coEdges: { status: "idle", data: null, error: null },
    verses: { status: "idle", data: null, error: null },
  },
  tab1Relations: [...TAB1_DEFAULT_RELATIONS],
  logArc: true,
  focus: null,
  hover: null,
  anchorId: null,
  history: [],
  historyIndex: -1,
  query: null,
  readingCode: null,
  extendedExploration: false,
  toast: null,
  hydrated: false,
};


export const useAnalectsStore = create<AnalectsStore>((set, get) => {
  const loadCore = async (force = false) => {
    const current = get().data.core;
    if (current.status === "loading") return;
    if (current.status === "ready" && !force) return;
    set((state) => ({
      data: {
        ...state.data,
        core: { status: "loading", data: state.data.core.data, error: null },
      },
    }));
    try {
      const data = await fetchJson<CoreGraphPackage>("core-graph.json");
      set((state) => ({
        data: { ...state.data, core: { status: "ready", data, error: null } },
      }));
    } catch (error) {
      set((state) => ({
        data: {
          ...state.data,
          core: {
            status: "error",
            data: state.data.core.data,
            error: error instanceof Error ? error.message : "核心数据加载失败",
          },
        },
      }));
    }
  };

  const loadOne = async (
    name: "details" | "coEdges" | "verses",
    file: string,
    force: boolean,
  ) => {
    const current = get().data[name];
    if (current.status === "loading") return;
    if (current.status === "ready" && !force) return;
    set((state) => ({
      data: {
        ...state.data,
        [name]: { status: "loading", data: current.data, error: null },
      },
    }));
    try {
      if (name === "details") {
        const data = await fetchJson<NodeDetailMap>(file);
        set((state) => ({
          data: { ...state.data, details: { status: "ready", data, error: null } },
        }));
      } else if (name === "coEdges") {
        const data = await fetchJson<CoEdgePackage>(file);
        set((state) => ({
          data: { ...state.data, coEdges: { status: "ready", data, error: null } },
        }));
      } else {
        const data = await fetchJson<Verse[]>(file);
        set((state) => ({
          data: { ...state.data, verses: { status: "ready", data, error: null } },
        }));
      }
    } catch (error) {
      set((state) => ({
        data: {
          ...state.data,
          [name]: {
            status: "error",
            data: current.data,
            error: error instanceof Error ? error.message : "数据加载失败",
          },
        },
      }));
    }
  };

  return {
    ...initialState,

    loadCore,

    loadBackground: async (force = false) => {
      await Promise.all([
        loadOne("details", "node-details.json", force),
        loadOne("coEdges", "co-edges.json", force),
        loadOne("verses", "verses.json", force),
      ]);
    },

    retryBackground: async () => {
      const parts: Array<Promise<void>> = [];
      const data = get().data;
      if (data.details.status !== "ready") {
        parts.push(loadOne("details", "node-details.json", true));
      }
      if (data.coEdges.status !== "ready") {
        parts.push(loadOne("coEdges", "co-edges.json", true));
      }
      if (data.verses.status !== "ready") {
        parts.push(loadOne("verses", "verses.json", true));
      }
      await Promise.all(parts);
    },

    selectTab1Relation: (relation) => set({ tab1Relations: [relation] }),

    setLogArc: (value) => set({ logArc: value }),

    setHover: (value) => set({ hover: value }),

    setLocked: (value) => set({ focus: value }),

    clearFocus: () =>
      set({
        focus: null,
        hover: null,
        query: null,
        readingCode: null,
      }),

    anchorNode: (nodeId, options = {}) => {
      const state = get();
      const origin = options.origin ?? "index";
      const shouldPush = options.pushHistory ?? origin !== "deepLink";
      const historyState = shouldPush
        ? nextHistory(state, nodeId)
        : { history: state.history, historyIndex: state.historyIndex };
      const isCore = coreness(state).has(nodeId);
      const name = nodeName(state, nodeId) ?? nodeId;

      set({
        anchorId: nodeId,
        history: shouldPush ? historyState.history : state.history,
        historyIndex: shouldPush ? historyState.historyIndex : state.historyIndex,
        query: null,
        readingCode: null,
        focus: focusNodeState(nodeId),
        hover: null,
        extendedExploration: origin === "index" && !isCore,
        toast:
          options.toast === true || origin === "canvas"
            ? {
                id: ++toastCounter,
                kind: "anchor",
                message: `已锚定 ${name} · 按 j 查看索引详情`,
              }
            : state.toast,
      });
    },

    anchorEdge: (edge, options = {}) => {
      const state = get();
      const origin = options.origin ?? "canvas";
      const sourceId = edge.source_id;
      const targetId = edge.target_id;
      const historyState = nextHistory(state, sourceId);
      const symmetric =
        edge.relation === "CONTRASTS_WITH" || edge.relation === "CO_OCCURS_WITH";

      set({
        anchorId: sourceId,
        history: historyState.history,
        historyIndex: historyState.historyIndex,
        focus: focusEdgeState(edge),
        hover: null,
        toast: null,
        query: {
          anchorId: sourceId,
          targetId,
          relation: edge.relation,
          direction: symmetric ? null : "out",
          verseCodes: edge.share_refs,
          edgeKey: `${edge.source_id}|${edge.relation}|${edge.target_id}`,
          origin: origin === "index" ? "capsule" : "edge",
        },
        readingCode: null,
        extendedExploration: false,
      });
    },

    setQuery: (query) => set({ query, readingCode: null }),

    clearQuery: () => set({ query: null }),

    setReadingCode: (code) => set({ readingCode: code }),


    selectHistory: (index) => {
      const state = get();
      if (index < 0 || index >= state.history.length) return;
      const nodeId = state.history[index];
      const isCore = coreness(state).has(nodeId);
      set({
        anchorId: nodeId,
        history: state.history.slice(0, index + 1),
        historyIndex: index,
        query: null,
        readingCode: null,
        focus: focusNodeState(nodeId),
        hover: null,
        extendedExploration: !isCore,
        toast: null,
      });
    },

    clearHistory: () => {
      const state = get();
      if (!state.anchorId) {
        set({ history: [], historyIndex: -1 });
        return;
      }
      set({ history: [state.anchorId], historyIndex: 0 });
    },

    returnToLastCore: () => {
      const state = get();
      const coreIds = coreness(state);
      for (let index = state.historyIndex - 1; index >= 0; index -= 1) {
        if (coreIds.has(state.history[index])) {
          get().selectHistory(index);
          return;
        }
      }
    },

    showToast: (message, kind = "notice") =>
      set({ toast: { id: ++toastCounter, kind, message } }),

    dismissToast: () => set({ toast: null }),

    dismissExtendedExploration: () => set({ extendedExploration: false }),

    applyDeepLink: ({ nodeId, query, extended }) => {
      const state = get();
      if (!nodeId) {
        set({
          anchorId: null,
          history: [],
          historyIndex: -1,
          focus: null,
          hover: null,
          query: null,
          readingCode: null,
          extendedExploration: false,
          toast: null,
        });
        return;
      }
      let focus: FocusState = focusNodeState(nodeId);
      const coreEdges = state.data.core.data?.edges ?? [];
      if (query) {
        const edge = coreEdges.find(
          (item) =>
            `${item.source_id}|${item.relation}|${item.target_id}` === query.edgeKey,
        );
        if (
          edge &&
          ["PRAISES", "CRITICIZES", "TEACHES"].includes(query.relation)
        ) {
          focus = focusEdgeState(edge);
        }
      }
      set({
        anchorId: nodeId,
        history: [nodeId],
        historyIndex: 0,
        query,
        readingCode: null,
        focus,
        hover: null,
        extendedExploration: extended,
        toast: null,
      });
    },

    setHydrated: (value) => set({ hydrated: value }),

  };
});

