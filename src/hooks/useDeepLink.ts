import { useEffect, useRef } from "react";
import { useAnalectsStore } from "../store/analectsStore";
import { parseUrl, replaceUrl, buildUrlState } from "../lib/url";
import { computeCoreNodeIds, findVerseEdge } from "../lib/graph";
import { isSymmetricRelation } from "../lib/constants";
import type { ActiveQuery } from "../store/analectsStore";
import type { CoreGraphPackage, NodeDetailMap } from "../types/data";

function resolveDeepLink(
  parsed: ReturnType<typeof parseUrl>,
  core: CoreGraphPackage,
  details: NodeDetailMap | null,
  coEdges: CoreGraphPackage["edges"] | null,
): {
  nodeId: string | null;
  query: ActiveQuery | null;
  extended: boolean;
  pending: boolean;
} {
  let nodeId: string | null = null;
  let pending = false;

  if (parsed.node) {
    const coreNode = core.nodes.find((node) => node.id === parsed.node);
    if (coreNode) {
      nodeId = coreNode.id;
    } else if (details === null) {
      pending = true;
    } else if (details[parsed.node]) {
      nodeId = parsed.node;
    }
  }

  if (parsed.rel === "CO_OCCURS_WITH" && coEdges === null) {
    pending = true;
  }

  if (pending) {
    return { nodeId: null, query: null, extended: false, pending: true };
  }

  let query: ActiveQuery | null = null;
  if (nodeId && parsed.target && parsed.rel) {
    const direction = isSymmetricRelation(parsed.rel) ? null : (parsed.dir ?? null);
    if (isSymmetricRelation(parsed.rel) || parsed.dir) {
      const edge = findVerseEdge(
        [...core.edges, ...(coEdges ?? [])],
        nodeId,
        parsed.target,
        parsed.rel,
        direction,
      );
      if (edge) {
        query = {
          anchorId: nodeId,
          targetId: parsed.target,
          relation: edge.relation,
          direction,
          verseCodes: edge.share_refs,
          edgeKey: `${edge.source_id}|${edge.relation}|${edge.target_id}`,
          origin: "deepLink",
        };
      }
    }
  }

  const coreIds = computeCoreNodeIds(core.edges);
  return {
    nodeId,
    query,
    extended: nodeId !== null && !coreIds.has(nodeId),
    pending: false,
  };
}

export function useDeepLinkAndHistory(): void {
  const coreStatus = useAnalectsStore((state) => state.data.core.status);
  const detailsStatus = useAnalectsStore((state) => state.data.details.status);
  const coStatus = useAnalectsStore((state) => state.data.coEdges.status);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current || coreStatus !== "ready") return;
    const state = useAnalectsStore.getState();
    const core = state.data.core.data;
    if (!core) return;
    const details =
      state.data.details.status === "ready"
        ? state.data.details.data
        : state.data.details.status === "error"
          ? {}
          : null;
    const coEdges =
      state.data.coEdges.status === "ready"
        ? (state.data.coEdges.data?.edges ?? [])
        : state.data.coEdges.status === "error"
          ? []
          : null;
    const parsed = parseUrl(window.location.search);
    const resolved = resolveDeepLink(parsed, core, details, coEdges);
    if (resolved.pending) return;
    state.applyDeepLink({
      nodeId: resolved.nodeId,
      query: resolved.query,
      extended: resolved.extended,
    });
    state.setHydrated(true);
    appliedRef.current = true;
  }, [coreStatus, detailsStatus, coStatus]);

  useEffect(() => {
    const handlePopState = () => {
      const state = useAnalectsStore.getState();
      const core = state.data.core.data;
      if (!core) return;
      const details =
        state.data.details.status === "ready"
          ? state.data.details.data
          : state.data.details.status === "error"
            ? {}
            : null;
      const parsed = parseUrl(window.location.search);
      const resolved = resolveDeepLink(
        parsed,
        core,
        details,
        state.data.coEdges.status === "ready"
          ? (state.data.coEdges.data?.edges ?? [])
          : state.data.coEdges.status === "error"
            ? []
            : null,
      );
      if (resolved.pending) {
        state.applyDeepLink({
          nodeId: null,
          query: null,
          extended: false,
        });
        return;
      }
      state.applyDeepLink({
        nodeId: resolved.nodeId,
        query: resolved.query,
        extended: resolved.extended,
      });
      state.setHydrated(true);
      appliedRef.current = true;
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const hydrated = useAnalectsStore((state) => state.hydrated);
  const anchorId = useAnalectsStore((state) => state.anchorId);
  const query = useAnalectsStore((state) => state.query);
  const anchorName = useAnalectsStore((state) => {
    if (!state.anchorId) return null;
    return (
      state.data.core.data?.nodes.find((node) => node.id === state.anchorId)
        ?.canonical_name ??
      state.data.details.data?.[state.anchorId]?.canonical_name ??
      null
    );
  });

  useEffect(() => {
    if (!hydrated) return;
    replaceUrl(
      buildUrlState({
        node: anchorId,
        target: query?.targetId ?? null,
        relation: query?.relation ?? null,
        direction: query?.direction ?? null,
      }),
    );
  }, [hydrated, anchorId, query]);

  useEffect(() => {
    document.title = anchorName
      ? `${anchorName} · 《论语》知识图谱`
      : "《论语》知识图谱";
  }, [anchorName]);
}
