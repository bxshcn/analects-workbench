import { describe, expect, it } from "vitest";
import { buildUrlState, parseUrl, serializeUrlState } from "./url";

describe("parseUrl", () => {
  it("解析深链参数", () => {
    expect(
      parseUrl("?node=per-kongzi&target=per-zhongyou&rel=TEACHES&dir=in"),
    ).toEqual({
      node: "per-kongzi",
      target: "per-zhongyou",
      rel: "TEACHES",
      dir: "in",
    });
  });

  it("忽略旧 tab 参数与非法值", () => {
    expect(parseUrl("?tab=virtue&rel=UNKNOWN&dir=sideways")).toEqual({});
  });

  it("对称关系忽略 dir", () => {
    expect(
      parseUrl("?node=a&target=b&rel=CONTRASTS_WITH&dir=out"),
    ).toEqual({
      node: "a",
      target: "b",
      rel: "CONTRASTS_WITH",
    });
  });
});

describe("serializeUrlState", () => {
  it("有向关系携带 dir", () => {
    expect(
      serializeUrlState(
        buildUrlState({
          node: "a",
          target: "b",
          relation: "PRAISES",
          direction: "out",
        }),
      ),
    ).toBe("?node=a&target=b&rel=PRAISES&dir=out");
  });

  it("对称关系省略 dir", () => {
    expect(
      serializeUrlState(
        buildUrlState({
          node: "a",
          target: "b",
          relation: "CONTRASTS_WITH",
          direction: null,
        }),
      ),
    ).toBe("?node=a&target=b&rel=CONTRASTS_WITH");
  });

  it("没有节点时不写入目标与关系", () => {
    expect(
      serializeUrlState(
        buildUrlState({
          node: null,
          target: "b",
          relation: "PRAISES",
          direction: "out",
        }),
      ),
    ).toBe("");
  });
});
