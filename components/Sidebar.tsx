"use client";

type SidebarProps = {
  active?: "dashboard" | "subjects" | "study-plan" | "analytics";
};

export default function Sidebar({
  active = "dashboard",
}: SidebarProps) {
  const itemStyle = (name: string) => ({
    display: "block",
    padding: "12px 13px",
    color: active === name ? "#000" : "#71717a",
    background: active === name ? "#fff" : "transparent",
    fontSize: 12,
    fontWeight: active === name ? 700 : 400,
    textDecoration: "none",
    borderRadius: 10,
    marginBottom: 5,
  });

  return (
    <aside
      style={{
        width: 240,
        padding: 28,
        borderRight: "1px solid #27272a",
        background: "#0b0c0f",
        flexShrink: 0,
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div
          style={{
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            color: "#000",
            borderRadius: 11,
            fontWeight: 900,
          }}
        >
          9+
        </div>

        <h1
          style={{
            fontSize: 17,
            margin: "14px 0 3px",
            color: "#f4f4f5",
          }}
        >
          Command Center
        </h1>

        <p
          style={{
            color: "#71717a",
            fontSize: 11,
            margin: 0,
          }}
        >
          Semester 3 · 2026
        </p>
      </div>

      <nav style={{ marginTop: 45 }}>
        <a href="/" style={itemStyle("dashboard")}>
          ◈ Dashboard
        </a>

        <a
          href="/subjects"
          style={itemStyle("subjects")}
        >
          ▣ Subjects
        </a>

        <a
          href="/study-plan"
          style={itemStyle("study-plan")}
        >
          ✓ Study Plan
        </a>

        <a
          href="/analytics"
          style={itemStyle("analytics")}
        >
          ◌ Analytics
        </a>
      </nav>

      <div
        style={{
          marginTop: 50,
          padding: 16,
          borderRadius: 14,
          background: "#111113",
          border: "1px solid #27272a",
        }}
      >
        <div
          style={{
            color: "#71717a",
            fontSize: 9,
            letterSpacing: "0.12em",
            marginBottom: 7,
          }}
        >
          NEXT MILESTONE
        </div>

        <strong
          style={{
            fontSize: 15,
            color: "#f4f4f5",
          }}
        >
          MST-2
        </strong>

        <p
          style={{
            color: "#d4d4d8",
            fontSize: 13,
            margin: "7px 0 0",
          }}
        >
          12 October 2026
        </p>

        <div
          style={{
            height: 1,
            background: "#27272a",
            margin: "15px 0",
          }}
        />

        <div
          style={{
            color: "#71717a",
            fontSize: 9,
            letterSpacing: "0.12em",
            marginBottom: 7,
          }}
        >
          EST WINDOW
        </div>

        <strong
          style={{
            fontSize: 15,
            color: "#f4f4f5",
          }}
        >
          END-SEM
        </strong>

        <p
          style={{
            color: "#d4d4d8",
            fontSize: 13,
            lineHeight: 1.5,
            margin: "7px 0 0",
          }}
        >
          23 Nov – 19 Dec 2026
        </p>
      </div>
    </aside>
  );
}
