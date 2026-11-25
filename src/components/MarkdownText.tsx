import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { splitHighlight } from "../lib/highlight";

function highlightChildren(
  children: ReactNode,
  keywords: string[],
): ReactNode {
  if (keywords.length === 0) return children;
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      const segments = splitHighlight(child, keywords);
      if (!segments.some((segment) => segment.matched)) return child;
      return segments.map((segment, index) =>
        segment.matched ? (
          <mark
            key={`${segment.text}-${index}`}
            className="verse-keyword"
          >
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      );
    }
    if (
      isValidElement<{ children?: ReactNode }>(child)
    ) {
      const props = child.props as { children?: ReactNode };
      return cloneElement(
        child as ReactElement<{ children?: ReactNode }>,
        undefined,
        highlightChildren(props.children, keywords),
      );
    }
    return child;
  });
}

export function MarkdownText({
  text,
  keywords = [],
  className = "",
}: {
  text: string;
  keywords?: string[];
  className?: string;
}) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{highlightChildren(children, keywords)}</p>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
