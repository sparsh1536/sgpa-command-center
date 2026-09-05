"use client";

import { useEffect, useMemo, useState } from "react";
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

type Topic = {
  id: number;
  subject_id: number;
  completed: boolean;
};

type Session = {
  id: number;
  topic_id: number;
  minutes: number;
};

type AnalyticsSubject = Subject & {
  current: number;
  maximum: number;
  remaining: number;
  topicTotal: number;
  topicCompleted: number;
  topicProgress: number;
  studyMinutes: number;
  efficiency: number;
};

const TARGET = 85;

function calculateCurrent(m?: Marks) {
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

function calculateMaximum(m?: Marks) {
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

function getStatus(current: number, maximum: number) {
  if (current >= TARGET) return "Target Hit";

  const available = maximum - current;

  if (available <= 0) return "Impossible";

  const requiredRate =
    (TARGET - current) / available;

  if (requiredRate <= 0.7) return "On Track";
  if (requiredRate <= 0.9) return "Recoverable";

  return "High Risk";
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const [
      subjectsResponse,
      marksResponse,
      topicsResponse,
      sessionsResponse,
    ] = await Promise.all([
      supabase.from("subjects").select("*"),
      supabase.from("subject_marks").select("*"),
      supabase
        .from("study_topics")
        .select("id, subject_id, completed")
        .eq("unit", 2),
      supabase
        .from("study_sessions")
        .select("id, topic_id, minutes"),
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

    if (topicsResponse.error) {
      setError(topicsResponse.error.message);
      setLoading(false);
      return;
    }

    if (sessionsResponse.error) {
      setError(sessionsResponse.error.message);
      setLoading(false);
      return;
    }

    const subjects = (subjectsResponse.data ?? [])
      .filter((s) =>
        ["OOP", "DBMS", "ADSA", "P&S", "COA"].includes(
          s.short_name
        )
      );

    const result = subjects.map((subject) => {
      const marks = (marksResponse.data ?? []).find(
        (m) => m.subject_id === subject.id
      );

      const topics = (topicsResponse.data ?? []).filter(
        (t) => t.subject_id === subject.id
      );

      const topicIds = topics.map((t) => t.id);

      const studyMinutes = (sessionsResponse.data ?? [])
        .filter((session) =>
          topicIds.includes(session.topic_id)
        )
        .reduce(
          (sum, session) => sum + (session.minutes ?? 0),
          0
        );

      const current = calculateCurrent(marks);
      const maximum = calculateMaximum(marks);
      const remaining = Math.max(
        0,
        TARGET - current
      );

      const topicCompleted = topics.filter(
        (t) => t.completed
      ).length;

      const topicProgress =
        topics.length > 0
          ? (topicCompleted / topics.length) * 100
          : 0;

      /*
       * Efficiency is deliberately simple:
       * how much of the 85-point target has been reached
       * relative to study effort.
       *
       * It is an indicator, not a scientific causal metric.
       */
      const efficiency =
        studyMinutes > 0
          ? current / studyMinutes
          : current;

      return {
        ...subject,
        current,
        maximum,
        remaining,
        topicTotal: topics.length,
        topicCompleted,
        topicProgress,
        studyMinutes,
        efficiency,
      };
    });

    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totalCredits = data.reduce(
    (sum, s) => sum + s.credits,
    0
  );

  const weightedCurrent =
    data.reduce(
      (sum, s) => sum + s.current * s.credits,
      0
    );

  const currentMarkAverage =
    totalCredits > 0
      ? weightedCurrent / totalCredits
      : 0;

  const totalStudyMinutes = data.reduce(
    (sum, s) => sum + s.studyMinutes,
    0
  );

  const totalTopics = data.reduce(
    (sum, s) => sum + s.topicTotal,
    0
  );

  const completedTopics = data.reduce(
    (sum, s) => sum + s.topicCompleted,
    0
  );

  const overallTopicProgress =
    totalTopics > 0
      ? (completedTopics / totalTopics) * 100
      : 0;

  const priority = useMemo(() => {
    return [...data].sort((a, b) => {
      const aRate =
        a.maximum > a.current
          ? a.remaining /
            (a.maximum - a.current)
          : 1;

      const bRate =
        b.maximum > b.current
          ? b.remaining /
            (b.maximum - b.current)
          : 1;

      return bRate - aRate;
    })[0];
  }, [data]);

  const strongest = useMemo(() => {
    return [...data].sort(
      (a, b) => b.current - a.current
    )[0];
  }, [data]);

  const mostStudied = useMemo(() => {
    return [...data].sort(
      (a, b) => b.studyMinutes - a.studyMinutes
    )[0];
  }, [data]);

  return (
    <main style={styles.page}>
      <div style={styles.shell}>

        <Sidebar active="analytics" />

        <section style={styles.content}>

          <header style={styles.header}>
            <div>
              <div style={styles.eyebrow}>
                PERFORMANCE · LIVE DATA
              </div>

              <h2 style={styles.title}>
                Analytics
              </h2>

              <p style={styles.subtitle}>
                See exactly where your semester stands.
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
              Loading analytics...
            </div>
          ) : (
            <>
              <div style={styles.metrics}>

                <Metric
                  label="Current Marks"
                  value={`${currentMarkAverage.toFixed(1)}/100`}
                />

                <Metric
                  label="Study Time"
                  value={`${totalStudyMinutes} min`}
                />

                <Metric
                  label="Unit 2 Progress"
                  value={`${overallTopicProgress.toFixed(0)}%`}
                />

                <Metric
                  label="Subjects"
                  value={`${data.length}`}
                />

              </div>

              <section style={styles.insightGrid}>

                <div style={styles.insight}>
                  <div style={styles.eyebrow}>
                    TOP PRIORITY
                  </div>

                  <h3>
                    {priority?.name || "—"}
                  </h3>

                  <p>
                    Needs{" "}
                    <strong>
                      {priority?.remaining.toFixed(1) || "0"}
                    </strong>{" "}
                    more points to reach the 85-point
                    planning target.
                  </p>
                </div>

                <div style={styles.insight}>
                  <div style={styles.eyebrow}>
                    STRONGEST CURRENT SCORE
                  </div>

                  <h3>
                    {strongest?.name || "—"}
                  </h3>

                  <p>
                    Current score:{" "}
                    <strong>
                      {strongest?.current.toFixed(1) || "0"}
                    </strong>
                    /100
                  </p>
                </div>

                <div style={styles.insight}>
                  <div style={styles.eyebrow}>
                    MOST STUDIED
                  </div>

                  <h3>
                    {mostStudied?.name || "—"}
                  </h3>

                  <p>
                    {mostStudied?.studyMinutes || 0} minutes
                    recorded.
                  </p>
                </div>

              </section>

              <section style={styles.card}>

                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.sectionTitle}>
                      Subject Analysis
                    </h3>

                    <p style={styles.sectionSub}>
                      Marks, remaining target, study effort
                      and Unit 2 progress.
                    </p>
                  </div>

                  <span style={styles.badge}>
                    TARGET 85
                  </span>
                </div>

                {data.map((subject) => {
                  const status = getStatus(
                    subject.current,
                    subject.maximum
                  );

                  return (
                    <div
                      key={subject.id}
                      style={styles.subject}
                    >

                      <div style={styles.subjectHeader}>

                        <div>
                          <strong>
                            {subject.name}
                          </strong>

                          <span
                            style={styles.code}
                          >
                            {subject.short_name} ·{" "}
                            {subject.credits} credits
                          </span>
                        </div>

                        <span
                          style={{
                            ...styles.status,
                            color:
                              status === "High Risk"
                                ? "#f87171"
                                : status ===
                                  "Recoverable"
                                ? "#facc15"
                                : status ===
                                  "On Track"
                                ? "#86efac"
                                : "#60a5fa",
                          }}
                        >
                          {status}
                        </span>

                      </div>

                      <div style={styles.scoreRow}>

                        <div>
                          <span style={styles.smallLabel}>
                            CURRENT
                          </span>

                          <strong>
                            {subject.current.toFixed(1)}
                          </strong>
                          <span>/100</span>
                        </div>

                        <div>
                          <span style={styles.smallLabel}>
                            TARGET GAP
                          </span>

                          <strong>
                            {subject.remaining.toFixed(1)}
                          </strong>
                          <span> points</span>
                        </div>

                        <div>
                          <span style={styles.smallLabel}>
                            STUDY TIME
                          </span>

                          <strong>
                            {subject.studyMinutes}
                          </strong>
                          <span> min</span>
                        </div>

                        <div>
                          <span style={styles.smallLabel}>
                            UNIT 2
                          </span>

                          <strong>
                            {subject.topicProgress.toFixed(0)}
                          </strong>
                          <span>%</span>
                        </div>

                      </div>

                      <div style={styles.doubleTrack}>

                        <div>
                          <div style={styles.trackLabel}>
                            Target progress
                          </div>

                          <div style={styles.track}>
                            <div
                              style={{
                                ...styles.bar,
                                width: `${Math.min(
                                  100,
                                  (subject.current /
                                    TARGET) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={styles.trackLabel}>
                            Unit 2 progress
                          </div>

                          <div style={styles.track}>
                            <div
                              style={{
                                ...styles.bar,
                                width: `${subject.topicProgress}%`,
                              }}
                            />
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}

              </section>

              <section style={styles.card}>

                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.sectionTitle}>
                      9+ Reality Check
                    </h3>

                    <p style={styles.sectionSub}>
                      Planning model, not an official CU
                      grade prediction.
                    </p>
                  </div>
                </div>

                <div style={styles.realityGrid}>

                  <div style={styles.reality}>
                    <span>
                      Current tracked marks
                    </span>

                    <strong>
                      {currentMarkAverage.toFixed(1)}
                    </strong>

                    <small>
                      /100 weighted average
                    </small>
                  </div>

                  <div style={styles.reality}>
                    <span>
                      9-GP planning target
                    </span>

                    <strong>
                      85
                    </strong>

                    <small>
                      target score per major subject
                    </small>
                  </div>

                  <div style={styles.reality}>
                    <span>
                      Unit 2 completed
                    </span>

                    <strong>
                      {completedTopics}/{totalTopics}
                    </strong>

                    <small>
                      topics
                    </small>
                  </div>

                  <div style={styles.reality}>
                    <span>
                      Total study time
                    </span>

                    <strong>
                      {totalStudyMinutes}
                    </strong>

                    <small>
                      minutes
                    </small>
                  </div>

                </div>

              </section>

              <div style={styles.note}>
                <strong>Important:</strong> CU uses
                relative grading, so the 85-point figure is
                our planning target for aiming at 9 GP. It
                is not a guaranteed official grade cutoff.
              </div>

            </>
          )}

        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

  sidebar: {
    width: 240,
    padding: 28,
    borderRight: "1px solid #27272a",
    background: "#0b0c0f",
    flexShrink: 0,
  } as React.CSSProperties,

  back: {
    color: "#71717a",
    fontSize: 12,
    textDecoration: "none",
    display: "block",
    marginBottom: 35,
  } as React.CSSProperties,

  logo: {
    width: 38,
    height: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    color: "#000",
    borderRadius: 11,
    fontWeight: 900,
  } as React.CSSProperties,

  brand: {
    fontSize: 17,
    margin: "14px 0 3px",
  } as React.CSSProperties,

  sideText: {
    color: "#71717a",
    fontSize: 11,
  } as React.CSSProperties,

  nav: {
    marginTop: 45,
  } as React.CSSProperties,

  navItem: {
    display: "block",
    padding: "12px 13px",
    color: "#71717a",
    fontSize: 12,
    textDecoration: "none",
    marginBottom: 5,
  } as React.CSSProperties,

  activeNav: {
    padding: "12px 13px",
    borderRadius: 10,
    background: "#fff",
    color: "#000",
    fontSize: 12,
    fontWeight: 700,
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

  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 15,
  } as React.CSSProperties,

  metric: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 9,
  } as React.CSSProperties,

  insightGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 15,
  } as React.CSSProperties,

  insight: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 20,
  } as React.CSSProperties,

  card: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 23,
    marginBottom: 15,
  } as React.CSSProperties,

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 17,
    margin: 0,
  } as React.CSSProperties,

  sectionSub: {
    color: "#52525b",
    fontSize: 11,
    marginTop: 5,
  } as React.CSSProperties,

  badge: {
    background: "#fff",
    color: "#000",
    padding: "8px 11px",
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
  } as React.CSSProperties,

  subject: {
    padding: "18px 0",
    borderBottom: "1px solid #1f1f22",
  } as React.CSSProperties,

  subjectHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  code: {
    display: "block",
    color: "#52525b",
    fontSize: 9,
    marginTop: 5,
  } as React.CSSProperties,

  status: {
    fontSize: 10,
    fontWeight: 700,
  } as React.CSSProperties,

  scoreRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginTop: 17,
  } as React.CSSProperties,

  smallLabel: {
    display: "block",
    color: "#52525b",
    fontSize: 8,
    letterSpacing: "0.12em",
    marginBottom: 5,
  } as React.CSSProperties,

  doubleTrack: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 15,
    marginTop: 18,
  } as React.CSSProperties,

  trackLabel: {
    color: "#52525b",
    fontSize: 9,
    marginBottom: 6,
  } as React.CSSProperties,

  track: {
    height: 5,
    background: "#27272a",
    borderRadius: 10,
    overflow: "hidden" as const,
  } as React.CSSProperties,

  bar: {
    height: "100%",
    background: "#fff",
    borderRadius: 10,
  } as React.CSSProperties,

  realityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  } as React.CSSProperties,

  reality: {
    padding: 17,
    background: "#09090b",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column" as const,
    gap: 7,
  } as React.CSSProperties,

  note: {
    padding: 15,
    borderRadius: 12,
    background: "#0d0d0f",
    border: "1px solid #1f1f22",
    color: "#71717a",
    fontSize: 11,
    lineHeight: 1.6,
  } as React.CSSProperties,

  error: {
    padding: 15,
    background: "#1c0b0b",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
    borderRadius: 12,
    marginBottom: 15,
  } as React.CSSProperties,
};
