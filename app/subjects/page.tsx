"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

type Subject = {
  id: number;
  name: string;
  short_name: string;
  credits: number;
};

type Marks = {
  subject_id: number;
  assignment: number | null;
  attendance: number | null;
  mst1_raw: number | null;
  quiz_raw: number | null;
  surprise_raw: number | null;
  mst2_raw: number | null;
  est_raw: number | null;
};

const TARGET = 85;

function currentScore(m?: Marks) {
  if (!m) return 0;

  return (
    (m.assignment ?? 0) +
    (m.attendance ?? 0) +
    (m.mst1_raw ?? 0) / 2 +
    (m.quiz_raw ?? 0) / 2 +
    (m.surprise_raw ?? 0) / 2 +
    (m.mst2_raw ?? 0) / 2 +
    (m.est_raw ?? 0)
  );
}

function maximumPossible(m?: Marks) {
  if (!m) return 100;

  return (
    (m.assignment ?? 10) +
    (m.attendance ?? 2) +
    (m.mst1_raw == null ? 10 : m.mst1_raw / 2) +
    (m.quiz_raw == null ? 2 : m.quiz_raw / 2) +
    (m.surprise_raw == null ? 6 : m.surprise_raw / 2) +
    (m.mst2_raw == null ? 10 : m.mst2_raw / 2) +
    (m.est_raw == null ? 60 : m.est_raw)
  );
}

function status(current: number, maximum: number) {
  if (current >= TARGET) return "Target Hit";

  const available = maximum - current;

  if (available <= 0) return "Impossible";

  const required =
    (TARGET - current) / available;

  if (required <= 0.7) return "On Track";
  if (required <= 0.9) return "Recoverable";

  return "High Risk";
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Marks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const [subjectsResponse, marksResponse] =
      await Promise.all([
        supabase.from("subjects").select("*"),
        supabase.from("subject_marks").select("*"),
      ]);

    if (subjectsResponse.error) {
      setError(subjectsResponse.error.message);
      setLoading(false);
      return;
    }

    if (marksResponse.error) {
      setError(marksResponse.error.message);
      setLoading(false);
      return;
    }

    setSubjects(subjectsResponse.data ?? []);
    setMarks(marksResponse.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <Sidebar active="subjects" />

        <section style={styles.content}>
          <header style={styles.header}>
            <div>
              <div style={styles.eyebrow}>
                SEMESTER 3 · LIVE DATA
              </div>

              <h2 style={styles.title}>
                Subjects
              </h2>

              <p style={styles.subtitle}>
                All subjects, marks and 9-GP targets in one place.
              </p>
            </div>

            <button
              onClick={load}
              style={styles.refresh}
            >
              ↻ Refresh
            </button>
          </header>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={styles.card}>
              Loading subjects...
            </div>
          ) : (
            <div style={styles.grid}>
              {subjects.map((subject) => {
                const m = marks.find(
                  (x) => x.subject_id === subject.id
                );

                const current = currentScore(m);
                const maximum = maximumPossible(m);
                const remaining = Math.max(
                  0,
                  TARGET - current
                );

                const subjectStatus = status(
                  current,
                  maximum
                );

                return (
                  <a
                    key={subject.id}
                    href={`/subjects/${subject.id}`}
                    style={styles.subjectCard}
                  >
                    <div style={styles.cardTop}>
                      <div style={styles.icon}>
                        {subject.short_name}
                      </div>

                      <span
                        style={{
                          ...styles.status,
                          color:
                            subjectStatus === "High Risk"
                              ? "#f87171"
                              : subjectStatus ===
                                  "Recoverable"
                                ? "#facc15"
                                : subjectStatus ===
                                    "On Track"
                                  ? "#86efac"
                                  : "#60a5fa",
                        }}
                      >
                        {m
                          ? subjectStatus
                          : "No Data"}
                      </span>
                    </div>

                    <h3 style={styles.subjectName}>
                      {subject.name}
                    </h3>

                    <div style={styles.credits}>
                      {subject.credits} credit
                      {subject.credits !== 1
                        ? "s"
                        : ""}
                    </div>

                    <div style={styles.score}>
                      {m
                        ? current.toFixed(1)
                        : "—"}
                      <span>/100</span>
                    </div>

                    <div style={styles.track}>
                      <div
                        style={{
                          ...styles.bar,
                          width: `${Math.min(
                            100,
                            (current / TARGET) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    <div style={styles.bottom}>
                      <span>
                        {m
                          ? current >= TARGET
                            ? "9-GP target reached"
                            : `${remaining.toFixed(
                                1
                              )} points needed`
                          : "Marks not entered"}
                      </span>

                      <span>
                        Open →
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#08090b",
    color: "#f4f4f5",
    fontFamily: "Arial, sans-serif",
  } as React.CSSProperties,

  shell: {
    display: "flex",
    minHeight: "100vh",
  } as React.CSSProperties,

  content: {
    flex: 1,
    padding: "45px 50px",
    maxWidth: 1250,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "end",
    marginBottom: 30,
  } as React.CSSProperties,

  eyebrow: {
    fontSize: 10,
    color: "#52525b",
    letterSpacing: "0.16em",
  } as React.CSSProperties,

  title: {
    fontSize: 38,
    margin: "8px 0",
  } as React.CSSProperties,

  subtitle: {
    color: "#71717a",
    margin: 0,
  } as React.CSSProperties,

  refresh: {
    border: 0,
    background: "#fff",
    color: "#000",
    borderRadius: 10,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 15,
  } as React.CSSProperties,

  subjectCard: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 22,
    textDecoration: "none",
    color: "#f4f4f5",
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  icon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    background: "#1a1a1d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
  } as React.CSSProperties,

  status: {
    fontSize: 10,
    fontWeight: 700,
  } as React.CSSProperties,

  subjectName: {
    fontSize: 17,
    margin: "18px 0 5px",
  } as React.CSSProperties,

  credits: {
    color: "#52525b",
    fontSize: 10,
  } as React.CSSProperties,

  score: {
    fontSize: 35,
    fontWeight: 800,
    marginTop: 20,
  } as React.CSSProperties,

  scoreSpan: {
    fontSize: 12,
  } as React.CSSProperties,

  track: {
    height: 5,
    background: "#27272a",
    borderRadius: 10,
    overflow: "hidden" as const,
    marginTop: 15,
  } as React.CSSProperties,

  bar: {
    height: "100%",
    background: "#fff",
    borderRadius: 10,
  } as React.CSSProperties,

  bottom: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#71717a",
    fontSize: 9,
    marginTop: 12,
  } as React.CSSProperties,

  card: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 23,
  } as React.CSSProperties,

  error: {
    padding: 15,
    background: "#1c0b0b",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 12,
  } as React.CSSProperties,
};
