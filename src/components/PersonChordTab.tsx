import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { arc as d3Arc, ribbon as d3Ribbon } from "d3";
import { Checkbox } from "./Checkbox";
import { ChartTooltip, TooltipLine } from "./ChartTooltip";
import { useElementSize, useTweenedAngles } from "../hooks/useElementSize";
import { computePersonChord, type PersonArc, type ChordRibbon } from "../lib/chord";
import { edgeKey } from "../lib/graph";
import {
  NODE_TYPE_LABEL,
  RELATION_ZH,
  TAB1_RELATIONS,
  personColor,
} from "../lib/constants";
import { useAnalectsStore, type FocusState } from "../store/analectsStore";
import type { CoreEdge, CoreNode } from "../types/data";

interface TipState {
  x: number;
  y: number;
  kind: "node" | "edge";
  key: string;
}

function edgeOpacityMap(
  focus: FocusState | null,
  persons: PersonArc[],
  ribbons: ChordRibbon[],
): {
  nodeOpacity: Map<string, number>;
  edgeOpacity: Map<string, number>;
  highlight: string | null;
} {
  const nodeOpacity = new Map<string, number>();
  const edgeOpacity = new Map<string, number>();
  const incident = new Map<string, Set<string>>();
  const neighbors = new Map<string, Set<string>>();

  for (const person of persons) {
    nodeOpacity.set(person.node.id, 1);
    incident.set(person.node.id, new Set());
    neighbors.set(person.node.id, new Set());
  }
  for (const ribbon of ribbons) {
    const key = edgeKey(ribbon.edge);
    edgeOpacity.set(key, 0.18);
    incident.get(ribbon.source.node.id)?.add(key);
    incident.get(ribbon.target.node.id)?.add(key);
    neighbors.get(ribbon.source.node.id)?.add(ribbon.target.node.id);
    neighbors.get(ribbon.target.node.id)?.add(ribbon.source.node.id);
  }

  if (!focus) return { nodeOpacity, edgeOpacity, highlight: null };

  if (focus.kind === "node") {
    const keep = new Set<string>([
      focus.nodeId,
      ...(neighbors.get(focus.nodeId) ?? []),
    ]);
    for (const person of persons) {
      nodeOpacity.set(person.node.id, keep.has(person.node.id) ? 1 : 0.03);
    }
    for (const ribbon of ribbons) {
      const key = edgeKey(ribbon.edge);
      edgeOpacity.set(key, incident.get(focus.nodeId)?.has(key) ? 0.85 : 0.03);
    }
    return { nodeOpacity, edgeOpacity, highlight: null };
  }

  const endpoints = new Set<string>([focus.sourceId, focus.targetId]);
  const secondaryEdges = new Set<string>();
  for (const nodeId of endpoints) {
    for (const key of incident.get(nodeId) ?? []) {
      if (key !== focus.edgeKey) secondaryEdges.add(key);
    }
  }
  const secondaryNodes = new Set<string>(endpoints);
  for (const ribbon of ribbons) {
    if (secondaryEdges.has(edgeKey(ribbon.edge))) {
      secondaryNodes.add(ribbon.source.node.id);
      secondaryNodes.add(ribbon.target.node.id);
    }
  }
  for (const person of persons) {
    nodeOpacity.set(person.node.id, secondaryNodes.has(person.node.id) ? 0.3 : 0.03);
  }
  for (const nodeId of endpoints) nodeOpacity.set(nodeId, 1);
  for (const ribbon of ribbons) {
    const key = edgeKey(ribbon.edge);
    if (key === focus.edgeKey) edgeOpacity.set(key, 1);
    else if (secondaryEdges.has(key)) edgeOpacity.set(key, 0.3);
    else edgeOpacity.set(key, 0.03);
  }
  return { nodeOpacity, edgeOpacity, highlight: focus.edgeKey };
}


export function PersonChordTab() {
  const core = useAnalectsStore((state) => state.data.core.data);
  const relations = useAnalectsStore((state) => state.tab1Relations);
  const logArc = useAnalectsStore((state) => state.logArc);
  const locked = useAnalectsStore((state) => state.focus);
  const hovered = useAnalectsStore((state) => state.hover);
  const setHover = useAnalectsStore((state) => state.setHover);
  const setLocked = useAnalectsStore((state) => state.setLocked);
  const anchorNode = useAnalectsStore((state) => state.anchorNode);
  const anchorEdge = useAnalectsStore((state) => state.anchorEdge);
  const clearFocus = useAnalectsStore((state) => state.clearFocus);

  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);

  const geometry = useMemo(
    () =>
      computePersonChord({
        nodes: core?.nodes ?? [],
        edges: core?.edges ?? [],
        relations,
        logArc,
      }),
    [core, relations, logArc],
  );

  const personById = useMemo(
    () => new Map(geometry.persons.map((person) => [person.node.id, person])),
    [geometry],
  );
  const ribbonByKey = useMemo(
    () => new Map(geometry.ribbons.map((ribbon) => [edgeKey(ribbon.edge), ribbon])),
    [geometry],
  );

  const targets = useMemo(
    () => [
      ...geometry.persons.map((person) => ({
        key: `p:${person.node.id}`,
        values: [person.startAngle, person.endAngle],
      })),
      ...geometry.persons.flatMap((person) =>
        [...person.outgoing, ...person.incoming].map((slice) => ({
          key: `s:${person.node.id}:${slice.end}:${edgeKey(slice.edge)}`,
          values: [slice.startAngle, slice.endAngle],
        })),
      ),
      ...geometry.ribbons.map((ribbon) => ({
        key: `r:${edgeKey(ribbon.edge)}`,
        values: [
          ribbon.sourceStartAngle,
          ribbon.sourceEndAngle,
          ribbon.targetStartAngle,
          ribbon.targetEndAngle,
        ],
      })),
    ],
    [geometry],
  );
  const tweened = useTweenedAngles(targets, true);
  const angleByKey = useMemo(
    () => new Map(tweened.map((item) => [item.key, item.values])),
    [tweened],
  );

  const effectiveFocus = useMemo(() => {
    const candidate = locked ?? hovered;
    if (!candidate) return null;
    if (candidate.kind === "node") {
      return personById.has(candidate.nodeId) ? candidate : null;
    }
    return ribbonByKey.has(candidate.edgeKey) ? candidate : null;
  }, [hovered, locked, personById, ribbonByKey]);

  const { nodeOpacity, edgeOpacity, highlight } = useMemo(
    () => edgeOpacityMap(effectiveFocus, geometry.persons, geometry.ribbons),
    [effectiveFocus, geometry],
  );

  const width = size.width || 800;
  const height = size.height || 600;
  const minSide = Math.min(width, height);
  const margin = Math.min(96, Math.max(58, minSide * 0.15));
  const radius = Math.max(36, minSide / 2 - margin);
  const cx = width / 2;
  const cy = height / 2;

  const outerArc = useMemo(
    () =>
      d3Arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(Math.max(1, radius - 14))
        .outerRadius(radius),
    [radius],
  );
  const innerArc = useMemo(
    () =>
      d3Arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(Math.max(1, radius - 20))
        .outerRadius(Math.max(2, radius - 6)),
    [radius],
  );
  const hitArc = useMemo(
    () =>
      d3Arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(radius)
        .outerRadius(radius + 15),
    [radius],
  );
  const ribbonPath = useMemo(() => d3Ribbon(), []);

  const setTipFromEvent = (
    event: ReactMouseEvent,
    kind: "node" | "edge",
    key: string,
  ) => {
    setTip({ x: event.clientX, y: event.clientY, kind, key });
  };

  const handleNodeEnter = (event: ReactMouseEvent, node: CoreNode) => {
    if (locked) return;
    setHover({ kind: "node", nodeId: node.id, key: `node:${node.id}` });
    setTipFromEvent(event, "node", node.id);
  };

  const handleNodeMove = (event: ReactMouseEvent, node: CoreNode) => {
    if (locked) return;
    setTipFromEvent(event, "node", node.id);
  };

  const handleEdgeEnter = (event: ReactMouseEvent, edge: CoreEdge) => {
    if (locked) return;
    const key = edgeKey(edge);
    setHover({
      kind: "edge",
      edgeKey: key,
      sourceId: edge.source_id,
      targetId: edge.target_id,
      relation: edge.relation,
      key: `edge:${key}`,
    });
    setTipFromEvent(event, "edge", key);
  };

  const handleEdgeMove = (event: ReactMouseEvent, edge: CoreEdge) => {
    if (locked) return;
    setTipFromEvent(event, "edge", edgeKey(edge));
  };

  const handleClickNode = (node: CoreNode) => {
    anchorNode(node.id, {
      origin: "canvas",
      toast: true,
    });
    setLocked({
      kind: "node",
      nodeId: node.id,
      key: `node:${node.id}`,
    });
    setTip(null);
  };

  const handleClickEdge = (edge: CoreEdge) => {
    anchorEdge(edge, { origin: "canvas" });
    setTip(null);
  };

  const clearBlank = () => {
    clearFocus();
    setTip(null);
  };

  const tipNode = tip?.kind === "node" ? personById.get(tip.key) : undefined;
  const tipEdge = tip?.kind === "edge" ? ribbonByKey.get(tip.key) : undefined;

  useEffect(() => {
    if (locked) setTip(null);
  }, [locked]);

  useEffect(() => {
    if (!locked) return;
    const valid =
      locked.kind === "node"
        ? personById.has(locked.nodeId)
        : ribbonByKey.has(locked.edgeKey);
    if (!valid) {
      setLocked(null);
      setHover(null);
    }
  }, [locked, personById, ribbonByKey, setLocked, setHover]);


  return (
    <div
      ref={containerRef}
      id="tabpanel-person"
      role="tabpanel"
      aria-labelledby="tab-person"
      className="paper-texture relative h-full w-full"
      onClick={clearBlank}
    >
      {relations.length === 0 ? (
        <div className="grid h-full place-items-center px-6">
          <div className="max-w-sm rounded-lg border border-dashed border-ink/20 bg-paper/70 px-8 py-10 text-center">
            <p className="text-base tracking-[0.12em] text-ink-soft">
              请选择一类关系
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              在左下角筛选卡中选择赞美、批评或品评，弦图将即刻重建。
            </p>
          </div>
        </div>
      ) : geometry.persons.length === 0 ? (
        <div className="grid h-full place-items-center px-6 text-sm text-ink-faint">
          当前筛选暂无人物关联记录
        </div>
      ) : (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block h-full w-full"
          role="group"
          aria-label={`人物关系有向弦图，${geometry.persons.length} 位人物，${geometry.edgeCount} 条关系`}
          onClick={(event) => {
            event.stopPropagation();
            clearBlank();
          }}
        >
          <g transform={`translate(${cx},${cy})`}>
            {geometry.ribbons.map((ribbon) => {
              const key = edgeKey(ribbon.edge);
              const angles = angleByKey.get(`r:${key}`) ?? [
                ribbon.sourceStartAngle,
                ribbon.sourceEndAngle,
                ribbon.targetStartAngle,
                ribbon.targetEndAngle,
              ];
              const path =
                ribbonPath({
                  source: {
                    startAngle: angles[0],
                    endAngle: angles[1],
                    radius,
                    index: 0,
                  },
                  target: {
                    startAngle: angles[2],
                    endAngle: angles[3],
                    radius: Math.max(2, radius - 6),
                    index: 0,
                  },
                } as unknown as Parameters<typeof ribbonPath>[0]) ?? "";
              const opacity = edgeOpacity.get(key) ?? 0.18;
              const isHighlight = highlight === key;
              const sourceColor = personColor(ribbon.source.node.id);
              const label = `${ribbon.source.node.canonical_name} ${RELATION_ZH[ribbon.relation]} ${ribbon.target.node.canonical_name}，权重 ${ribbon.edge.weight}`;
              return (
                <g key={key}>
                  <path
                    d={path}
                    fill={sourceColor}
                    fillOpacity={isHighlight ? 0.8 : opacity}
                    stroke={isHighlight ? sourceColor : "none"}
                    strokeWidth={isHighlight ? 1.6 : 0}
                    style={{
                      transition: "fill-opacity 180ms ease, stroke-width 180ms ease",
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={label}
                    onMouseEnter={(event) => handleEdgeEnter(event, ribbon.edge)}
                    onMouseMove={(event) => handleEdgeMove(event, ribbon.edge)}
                    onMouseLeave={() => {
                      setHover(null);
                      setTip(null);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClickEdge(ribbon.edge);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        handleClickEdge(ribbon.edge);
                      }
                    }}
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={10}
                    style={{ pointerEvents: "stroke" }}
                    onMouseEnter={(event) => handleEdgeEnter(event, ribbon.edge)}
                    onMouseMove={(event) => handleEdgeMove(event, ribbon.edge)}
                    onMouseLeave={() => {
                      setHover(null);
                      setTip(null);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClickEdge(ribbon.edge);
                    }}
                  />
                </g>
              );
            })}


            {geometry.persons.map((person, index) => {
              const angles = angleByKey.get(`p:${person.node.id}`) ?? [
                person.startAngle,
                person.endAngle,
              ];
              const startAngle = angles[0];
              const endAngle = angles[1];
              const opacity = nodeOpacity.get(person.node.id) ?? 1;
              const personFill = personColor(person.node.id);
              const mid = (startAngle + endAngle) / 2;
              // D3 弧角从 12 点方向起算，x 用 sin、y 用 -cos；
              // 文字沿切线方向书写，与径向严格垂直。
              const flip = mid > Math.PI / 2 && mid < (Math.PI * 3) / 2;
              const rotation = (mid * 180) / Math.PI + (flip ? 180 : 0);
              const labelRadius = radius + (index % 2 === 0 ? 14 : 28);
              const lx = Math.sin(mid) * labelRadius;
              const ly = -Math.cos(mid) * labelRadius;
              const sliceAngles = (slice: PersonArc["outgoing"][number]) =>
                angleByKey.get(
                  `s:${person.node.id}:${slice.end}:${edgeKey(slice.edge)}`,
                ) ?? [slice.startAngle, slice.endAngle];

              return (
                <g
                  key={person.node.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${person.node.canonical_name}，${NODE_TYPE_LABEL[person.node.type]}，原始权重 ${person.rawTotal}，当前弧长 ${person.arcValue.toFixed(2)}`}
                  onMouseEnter={(event) => handleNodeEnter(event, person.node)}
                  onMouseMove={(event) => handleNodeMove(event, person.node)}
                  onMouseLeave={() => {
                    setHover(null);
                    setTip(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleClickNode(person.node);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      handleClickNode(person.node);
                    }
                  }}
                  style={{ opacity, transition: "opacity 180ms ease" }}
                >
                  {person.outgoing.map((slice) => {
                    const [sliceStart, sliceEnd] = sliceAngles(slice);
                    return (
                      <path
                        key={`out-${edgeKey(slice.edge)}`}
                        className="node-arc"
                        d={outerArc({ startAngle: sliceStart, endAngle: sliceEnd }) ?? ""}
                        fill={personFill}
                        stroke="#FAF8F5"
                        strokeWidth={0.6}
                      />
                    );
                  })}
                  {person.incoming.map((slice) => {
                    const [sliceStart, sliceEnd] = sliceAngles(slice);
                    return (
                      <path
                        key={`in-${edgeKey(slice.edge)}`}
                        className="node-arc"
                        d={innerArc({ startAngle: sliceStart, endAngle: sliceEnd }) ?? ""}
                        fill={personFill}
                        stroke="#FAF8F5"
                        strokeWidth={0.6}
                      />
                    );
                  })}
                  <path
                    d={hitArc({ startAngle, endAngle }) ?? ""}
                    fill="transparent"
                    aria-hidden
                  />
                  <line
                    x1={Math.sin(mid) * (radius + 2)}
                    y1={-Math.cos(mid) * (radius + 2)}
                    x2={Math.sin(mid) * (labelRadius - 3)}
                    y2={-Math.cos(mid) * (labelRadius - 3)}
                    stroke={personFill}
                    strokeOpacity={0.5}
                    strokeWidth={0.8}
                    aria-hidden
                  />
                  <text
                    transform={`translate(${lx},${ly}) rotate(${rotation})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={person.node.canonical_name.length > 3 ? 8.5 : 9.5}
                    fill="#2B2B2B"
                    className="svg-label"
                    style={{ userSelect: "none" }}
                  >
                    {person.node.canonical_name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}


      <div className="pointer-events-none absolute left-5 top-4 select-none">
        <p className="text-[11px] tracking-[0.22em] text-ink-faint">
          人物关系有向弦图
        </p>
        <p className="mt-1 text-[10px] text-ink-faint">
          {geometry.persons.length} 位人物 · {geometry.edgeCount} 条关系 · 外圈为主动端
        </p>
      </div>

      <RelationFilter />

      {tip && tipNode ? (
        <ChartTooltip x={tip.x} y={tip.y}>
          <p className="mb-1 text-xs font-semibold text-ink">
            {tipNode.node.canonical_name}
            <span className="ml-2 text-[10px] font-normal text-ink-faint">
              {NODE_TYPE_LABEL[tipNode.node.type]}
            </span>
          </p>
          {tipNode.node.alias?.length ? (
            <p className="mb-1 text-[10px] text-ink-faint">
              别名：{tipNode.node.alias.join("、")}
            </p>
          ) : null}
          <TooltipLine label="原始权重" value={tipNode.rawTotal} />
          <TooltipLine
            label={logArc ? "当前弧长（对数）" : "当前弧长"}
            value={tipNode.arcValue.toFixed(2)}
          />
        </ChartTooltip>
      ) : null}

      {tip && tipEdge ? (
        <ChartTooltip x={tip.x} y={tip.y}>
          <p className="mb-1 text-xs font-semibold text-ink">
            {RELATION_ZH[tipEdge.relation]} · {tipEdge.edge.weight}
          </p>
          <p className="mb-1 text-[10px] text-ink-soft">
            {tipEdge.source.node.canonical_name} ·{" "}
            {tipEdge.target.node.canonical_name}
          </p>
          <TooltipLine label="关联章句" value={tipEdge.edge.share_refs.length} />
          <TooltipLine
            label="两端原始权重"
            value={`${tipEdge.source.rawTotal} / ${tipEdge.target.rawTotal}`}
          />
        </ChartTooltip>
      ) : null}
    </div>
  );
}

function RelationFilter() {
  const relations = useAnalectsStore((state) => state.tab1Relations);
  const logArc = useAnalectsStore((state) => state.logArc);
  const selectRelation = useAnalectsStore((state) => state.selectTab1Relation);
  const setLogArc = useAnalectsStore((state) => state.setLogArc);

  return (
    <div
      className="filter-card absolute bottom-4 left-4 z-20 w-[218px] rounded-lg p-3 text-ink"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <p className="mb-2 text-[10px] tracking-[0.22em] text-ink-faint">关系筛选</p>
      <div className="space-y-0.5" role="radiogroup" aria-label="关系筛选">
        {TAB1_RELATIONS.map((relation) => (
          <Checkbox
            key={relation}
            checked={relations.includes(relation)}
            onChange={() => selectRelation(relation)}
            label={RELATION_ZH[relation]}
            variant="radio"
            name="tab1-relation"
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-2">
        <span className="text-xs text-ink-soft">对数弧长</span>
        <button
          type="button"
          role="switch"
          aria-checked={logArc}
          aria-label="对数弧长"
          onClick={() => setLogArc(!logArc)}
          className={`relative h-5 w-9 rounded-full border transition-colors after:absolute after:-inset-3 after:content-[''] ${
            logArc ? "border-vermilion bg-vermilion" : "border-ink/20 bg-ink/10"
          }`}
        >
          <span
            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-paper shadow-sm transition-all ${
              logArc ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
        弧长为对数缩放，权重数值以底部索引为准。
      </p>
    </div>
  );
}

