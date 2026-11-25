import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MarkdownText } from "./MarkdownText";

describe("MarkdownText", () => {
  it("解析粗体与列表", () => {
    const { container } = render(
      <MarkdownText text={"**重点**\n\n- 第一条\n- 第二条"} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("重点");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("在 Markdown 文本中保留关系双方高亮", () => {
    const { container } = render(
      <MarkdownText
        text={"子曰：**求**也，不知其仁也。"}
        keywords={["求"]}
      />,
    );
    const marks = container.querySelectorAll("mark.verse-keyword");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].textContent).toBe("求");
  });

  it("注疏字段不强行高亮", () => {
    const { container } = render(
      <MarkdownText text={"求也，千室之邑。"} />,
    );
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });
});
