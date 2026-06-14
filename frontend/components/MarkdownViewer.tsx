"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#c8ccee", margin: "28px 0 14px", paddingBottom: "10px", borderBottom: "1px solid #1c1c2e" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#b0b8e0", margin: "22px 0 10px" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#8890c0", margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ fontSize: "14px", lineHeight: "1.8", color: "#8890c0", marginBottom: "14px" }}>
      {children}
    </p>
  ),
  pre: ({ children }) => (
    <pre style={{ background: "#0d0d1a", border: "1px solid #1c1c2e", borderRadius: "8px", padding: "16px", overflowX: "auto", marginBottom: "16px", fontFamily: "'Space Mono', monospace", fontSize: "12px", color: "#9cacff", lineHeight: "1.65" }}>
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    if (className) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code style={{ fontFamily: "'Space Mono', monospace", fontSize: "12px", background: "#1a1a2e", color: "#7dd3fc", padding: "2px 6px", borderRadius: "4px" }}>
        {children}
      </code>
    );
  },
  ul: ({ children }) => (
    <ul style={{ paddingLeft: "20px", marginBottom: "14px" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: "20px", marginBottom: "14px" }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ fontSize: "14px", color: "#8890c0", lineHeight: "1.7", marginBottom: "4px" }}>
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: "3px solid #4361ee", paddingLeft: "16px", margin: "16px 0", color: "#6668a0", fontStyle: "italic" }}>
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong style={{ color: "#b0b8e0", fontWeight: 600 }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "#9098c8", fontStyle: "italic" }}>
      {children}
    </em>
  ),
  a: ({ children, href }) => (
    <a href={href} style={{ color: "#4361ee", textDecoration: "underline" }} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  hr: () => (
    <hr style={{ border: "none", borderTop: "1px solid #1c1c2e", margin: "24px 0" }} />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", marginBottom: "16px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ padding: "8px 12px", background: "#13131c", color: "#c8ccee", fontWeight: 600, textAlign: "left", border: "1px solid #1c1c2e" }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ padding: "8px 12px", color: "#8890c0", border: "1px solid #1c1c2e", verticalAlign: "top" }}>
      {children}
    </td>
  ),
};

export default function MarkdownViewer({ content }: { content: string }) {
  if (!content) {
    return (
      <p style={{ fontSize: "13px", color: "#44446a", fontFamily: "'Space Mono', monospace" }}>
        No content available.
      </p>
    );
  }
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
