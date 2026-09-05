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

type SubjectView = Subject & {
  marks?: Marks;
  current: number;
  maximum: number;
  remaining: number;
  progress: number;
  status: string;
  gradePotential: number;
};

const TARGET = 85;

const majorSubjects = ["OOP", "DBMS", "ADSA", "P&S", "COA"];

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

function gradePoint(score: number) {
  if (score >= 95) return 10;
  if (score >= 85) return 9;
  if (score >= 75) return 8;
  if (score >= 65) return 7;
  if (score >= 55) return 6;
  if (score >= 45) return 5;
  if (score >= 40) return 4;
  return 0;
}

function getStatus(
  current: number,
  maximum: number,
  hasData: boolean
) {
  if (!hasData) return "No Data";

  if (current >= TARGET) return "Target Achieved";

  if (maximum < TARGET) return "Impossible";

  const remaining = TARGET - current;
  const available = maximum - current;

  if (available <= 0) return "Impossible";

  const requiredRate = remaining / available;

  if (requiredRate <= 0.70) return "On Track";
  if (requiredRate <= 0.90) return "Recoverable";

  return "High Risk";
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1);
}

export default function Home() {
  const [data, setData] = useState<SubjectView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const { data: subjects, error: subjectError } = await supabase
      .from("subjects")
      .select("*")
      .order("credits", { ascending: false });

    if (subjectError) {
      setError(subjectError.message);
      setLoading(false);
      return;
    }

    const { data: marks, error: marksError } = await supabase
      .from("subject_marks")
      .select("*");

    if (marksError) {
      setError(marksError.message);
      setLoading(false);
      return;
    }

    const result = (subjects ?? []).map((subject) => {
      const m = marks?.find(
        (item) => item.subject_id === subject.id
      );

      const hasData = !!m;

      const current = currentScore(m);
      const maximum = maximumPossible(m);
      const remaining = Math.max(0, TARGET - current);

      const progress = hasData
        ? Math.min(100, (current / TARGET) * 100)
        : 0;

      const status = getStatus(
        current,
        maximum,
        hasData
      );

      return {
        ...subject,
        marks: m,
        current,
        maximum,
        remaining,
        progress,
        status,
        gradePotential: gradePoint(maximum),
      };
    });

    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  /*
   * Only subjects for which we currently have real marks
   * are included in the live SGPA analysis.
   *
   * This prevents UHV / EM / CER / Aptitude from being
   * incorrectly treated as zero.
   */
  const trackedSubjects = data.filter(
    (s) =>
      s.marks &&
      majorSubjects.includes(s.short_name)
  );

  const trackedCredits = trackedSubjects.reduce(
    (sum, s) => sum + s.credits,
    0
  );

  /*
   * During the semester, final grade points cannot be
   * meaningfully assigned from partial marks.
   *
   * Therefore we track the actual mark average instead.
   */
  const currentWeightedMarks =
    trackedSubjects.reduce(
      (sum, s) =>
        sum + s.current * s.credits,
      0
    );

  const currentMarkAverage =
    trackedCredits > 0
      ? currentWeightedMarks / trackedCredits
      : 0;

  /*
   * Best possible grade-point contribution from the
   * assessments that are still available.
   */
  const bestPossiblePoints =
    trackedSubjects.reduce(
      (sum, s) =>
        sum + s.gradePotential * s.credits,
      0
    );

  const totalCredits = data.reduce(
    (sum, s) => sum + s.credits,
    0
  );

  const untrackedCredits =
    totalCredits - trackedCredits;

  /*
   * Planning scenario:
   * tracked subjects achieve their current maximum
   * possible grade point, while currently untracked
   * subjects achieve 9 GP.
   */
  const bestSemesterPoints =
    bestPossiblePoints +
    untrackedCredits * 9;

  const bestSemesterGP =
    totalCredits > 0
      ? bestSemesterPoints / totalCredits
      : 0;

  /*
   * Planning scenario where every subject eventually
   * reaches 9 GP.
   *
   * This is NOT the current SGPA. It represents the
   * target scenario we are trying to achieve.
   */
  const ninePointScenario = 9;

  const riskySubjects = trackedSubjects.filter(
    (s) =>
      s.status === "High Risk" ||
      s.status === "Impossible"
  );

  const recoverableSubjects = trackedSubjects.filter(
    (s) => s.status === "Recoverable"
  );

  const targetAchieved = trackedSubjects.filter(
    (s) => s.status === "Target Achieved"
  );

  /*
   * Priority = subject requiring the highest percentage
   * of its remaining available marks to reach 85.
   */
  const priority = [...trackedSubjects]
    .filter(
      (s) =>
        s.current < TARGET &&
        s.maximum >= TARGET
    )
    .sort((a, b) => {
      const aRate =
        (TARGET - a.current) /
        Math.max(1, a.maximum - a.current);

      const bRate =
        (TARGET - b.current) /
        Math.max(1, b.maximum - b.current);

      return bRate - aRate;
    })[0];

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <Sidebar active="dashboard" />

        <section style={styles.content}>
          <header style={styles.header}>
            <div>
              <div style={styles.eyebrow}>
                SEMESTER 3 · LIVE DATA
              </div>

              <h2 style={styles.title}>
                Semester Overview
              </h2>

              <p style={styles.subtitle}>
                Your complete path to a 9+ SGPA.
              </p>
            </div>

            <button
              style={styles.primaryButton}
              onClick={loadDashboard}
            >
              ↻ Refresh
            </button>
          </header>

          {loading && (
            <div style={styles.card}>
              Loading live semester data...
            </div>
          )}

          {error && (
            <div style={styles.error}>
              <strong>Database error</strong>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              <div style={styles.metrics}>
                <Metric
                  title="9+ Target"
                  value="9.00+"
                />

                <Metric
                  title="Current Marks Average"
                  value={
                    trackedCredits
                      ? `${currentMarkAverage.toFixed(2)}`
                      : "—"
                  }
                />

                <Metric
                  title="Best Possible"
                  value={
                    trackedCredits
                      ? `${bestSemesterGP.toFixed(2)}`
                      : "—"
                  }
                />

                <Metric
                  title="Credits Tracked"
                  value={`${trackedCredits}/${totalCredits}`}
                />
              </div>

              <section style={styles.heroCard}>
                <div>
                  <div style={styles.eyebrow}>
                    9-GP PLANNING ENGINE
                  </div>

                  <h3 style={styles.heroTitle}>
                    Semester Target
                  </h3>

                  <p style={styles.heroText}>
                    Planning scenario: every remaining
                    subject reaches 9 GP.
                  </p>
                </div>

                <div style={styles.heroScore}>
                  {ninePointScenario.toFixed(2)}
                </div>

                <div style={styles.heroBottom}>
                  <span>
                    Current tracked subjects:{" "}
                    {trackedCredits} credits
                  </span>

                  <span>
                    Remaining untracked:{" "}
                    {untrackedCredits} credits
                  </span>
                </div>
              </section>

              <div style={styles.twoColumn}>
                <section style={styles.card}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <h3 style={styles.sectionTitle}>
                        Subject Performance
                      </h3>

                      <p style={styles.sectionSub}>
                        85/100 = 9-GP planning target
                      </p>
                    </div>
                  </div>

                  {data.map((subject) => (
                    <a
                      key={subject.id}
                      href={`/subjects/${subject.id}`}
                      style={styles.subjectLink}
                    >
                      <div style={styles.subject}>
                        <div style={styles.subjectIcon}>
                          {subject.short_name}
                        </div>

                        <div style={styles.subjectInfo}>
                          <div style={styles.subjectTop}>
                            <strong>
                              {subject.name}
                            </strong>

                            <span
                              style={{
                                color:
                                  subject.status ===
                                    "High Risk" ||
                                  subject.status ===
                                    "Impossible"
                                    ? "#f87171"
                                    : subject.status ===
                                        "Recoverable"
                                      ? "#facc15"
                                      : subject.status ===
                                          "On Track"
                                        ? "#86efac"
                                        : subject.status ===
                                            "Target Achieved"
                                          ? "#60a5fa"
                                          : "#71717a",
                              }}
                            >
                              {subject.status}
                            </span>
                          </div>

                          <div style={styles.progressTrack}>
                            <div
                              style={{
                                ...styles.progressBar,
                                width: `${subject.progress}%`,
                              }}
                            />
                          </div>

                          <div style={styles.subjectBottom}>
                            <span>
                              {subject.marks
                                ? `Current: ${formatNumber(
                                    subject.current
                                  )}/100`
                                : "No marks entered"}
                            </span>

                            <span>
                              {subject.marks
                                ? subject.current >= TARGET
                                  ? "Target reached"
                                  : `Need ${formatNumber(
                                      subject.remaining
                                    )}`
                                : "Awaiting data"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </section>

                <section style={styles.card}>
                  <h3 style={styles.sectionTitle}>
                    Today&apos;s Priority
                  </h3>

                  <p style={styles.sectionSub}>
                    Highest-impact subject right now
                  </p>

                  {priority ? (
                    <div style={styles.priorityBox}>
                      <div style={styles.priorityLabel}>
                        FOCUS SUBJECT
                      </div>

                      <h3 style={styles.priorityTitle}>
                        {priority.name}
                      </h3>

                      <p style={styles.priorityText}>
                        Current score:{" "}
                        <strong>
                          {formatNumber(
                            priority.current
                          )}
                        </strong>
                        /100
                        <br />
                        9-GP target:{" "}
                        <strong>85</strong>
                        <br />
                        Still needed:{" "}
                        <strong>
                          {formatNumber(
                            priority.remaining
                          )}
                        </strong>
                      </p>

                      <a
                        href={`/subjects/${priority.id}`}
                        style={styles.priorityButton}
                      >
                        Open Subject →
                      </a>
                    </div>
                  ) : (
                    <div style={styles.priorityBox}>
                      No immediate priority.
                    </div>
                  )}

                  <div style={styles.riskBox}>
                    <div style={styles.priorityLabel}>
                      RISK WATCH
                    </div>

                    <div style={styles.riskNumber}>
                      {riskySubjects.length}
                    </div>

                    <p>
                      {riskySubjects.length === 0
                        ? "No tracked subject is currently high risk."
                        : "tracked subjects need serious attention."}
                    </p>
                  </div>

                  <div style={styles.statsBox}>
                    <Stat
                      label="High Risk"
                      value={riskySubjects.length}
                    />

                    <Stat
                      label="Recoverable"
                      value={
                        recoverableSubjects.length
                      }
                    />

                    <Stat
                      label="Target Hit"
                      value={targetAchieved.length}
                    />
                  </div>
                </section>
              </div>

              <section style={styles.card}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h3 style={styles.sectionTitle}>
                      9+ Strategy
                    </h3>

                    <p style={styles.sectionSub}>
                      Live calculation based on your saved marks.
                    </p>
                  </div>

                  <span style={styles.targetBadge}>
                    TARGET 85
                  </span>
                </div>

                <div style={styles.strategyGrid}>
                  <Strategy
                    title="Tracked average"
                    value={
                      trackedCredits
                        ? `${currentMarkAverage.toFixed(
                            1
                          )}/100`
                        : "—"
                    }
                  />

                  <Strategy
                    title="Best possible"
                    value={
                      trackedCredits
                        ? `${bestSemesterGP.toFixed(
                            2
                          )} GP`
                        : "—"
                    }
                  />

                  <Strategy
                    title="Risk subjects"
                    value={String(
                      riskySubjects.length
                    )}
                  />

                  <Strategy
                    title="Next exam"
                    value="MST-2"
                  />
                </div>
              </section>

              <div style={styles.note}>
                <strong>How to read this:</strong>{" "}
                CU uses relative grading. The 85/100 figure here is
                our <strong>planning target</strong> for aiming at a
                9 GP, not an official fixed CU cutoff.
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricTitle}>
        {title}
      </div>

      <div style={styles.metricValue}>
        {value}
      </div>
    </div>
  );
}

function Strategy({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div style={styles.strategy}>
      <div style={styles.metricTitle}>
        {title}
      </div>

      <div style={styles.strategyValue}>
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div style={styles.metricTitle}>
        {label}
      </div>

      <div style={styles.statValue}>
        {value}
      </div>
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
    fontSize: 16,
    margin: "14px 0 3px",
  } as React.CSSProperties,

  sideText: {
    color: "#71717a",
    fontSize: 11,
  } as React.CSSProperties,

  nav: {
    marginTop: 45,
  } as React.CSSProperties,

  activeNav: {
    padding: "12px 13px",
    borderRadius: 10,
    background: "#fff",
    color: "#000",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 5,
  } as React.CSSProperties,

  navItem: {
    padding: "12px 13px",
    color: "#71717a",
    fontSize: 12,
    marginBottom: 5,
  } as React.CSSProperties,

  examCard: {
    marginTop: 50,
    padding: 16,
    borderRadius: 14,
    background: "#111113",
    border: "1px solid #27272a",
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
    marginBottom: 35,
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

  primaryButton: {
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
  } as React.CSSProperties,

  metricTitle: {
    color: "#71717a",
    fontSize: 11,
  } as React.CSSProperties,

  metricValue: {
    fontSize: 28,
    fontWeight: 700,
    marginTop: 8,
  } as React.CSSProperties,

  heroCard: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 25,
    marginBottom: 15,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 20,
  } as React.CSSProperties,

  heroTitle: {
    fontSize: 24,
    margin: "8px 0",
  } as React.CSSProperties,

  heroText: {
    color: "#71717a",
    fontSize: 12,
    margin: 0,
  } as React.CSSProperties,

  heroScore: {
    fontSize: 50,
    fontWeight: 800,
    alignSelf: "center",
  } as React.CSSProperties,

  heroBottom: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "space-between",
    color: "#52525b",
    fontSize: 10,
  } as React.CSSProperties,

  twoColumn: {
    display: "grid",
    gridTemplateColumns: "1.6fr 1fr",
    gap: 15,
    marginBottom: 15,
  } as React.CSSProperties,

  card: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 23,
  } as React.CSSProperties,

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 16,
    margin: 0,
  } as React.CSSProperties,

  sectionSub: {
    color: "#52525b",
    fontSize: 11,
    marginTop: 5,
  } as React.CSSProperties,

  subjectLink: {
    textDecoration: "none",
    color: "inherit",
  } as React.CSSProperties,

  subject: {
    display: "flex",
    gap: 13,
    padding: "15px 0",
    borderBottom: "1px solid #1f1f22",
  } as React.CSSProperties,

  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: "#1a1a1d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  subjectInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  subjectTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 11,
  } as React.CSSProperties,

  progressTrack: {
    height: 5,
    background: "#27272a",
    borderRadius: 10,
    marginTop: 10,
    overflow: "hidden" as const,
  } as React.CSSProperties,

  progressBar: {
    height: "100%",
    background: "#fff",
    borderRadius: 10,
  } as React.CSSProperties,

  subjectBottom: {
    display: "flex",
    justifyContent: "space-between",
    color: "#52525b",
    fontSize: 9,
    marginTop: 7,
  } as React.CSSProperties,

  priorityBox: {
    marginTop: 22,
    padding: 20,
    borderRadius: 13,
    background: "#18181b",
    border: "1px solid #27272a",
  } as React.CSSProperties,

  priorityLabel: {
    color: "#52525b",
    fontSize: 9,
    letterSpacing: "0.14em",
    fontWeight: 700,
  } as React.CSSProperties,

  priorityTitle: {
    fontSize: 22,
    margin: "9px 0",
  } as React.CSSProperties,

  priorityText: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 1.7,
  } as React.CSSProperties,

  priorityButton: {
    display: "inline-block",
    marginTop: 10,
    color: "#fff",
    fontSize: 11,
    textDecoration: "none",
  } as React.CSSProperties,

  riskBox: {
    marginTop: 12,
    padding: 18,
    borderRadius: 13,
    background: "#120d0d",
    border: "1px solid #3f2020",
  } as React.CSSProperties,

  riskNumber: {
    fontSize: 30,
    fontWeight: 700,
    marginTop: 7,
  } as React.CSSProperties,

  statsBox: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginTop: 12,
    padding: 15,
    background: "#09090b",
    borderRadius: 12,
  } as React.CSSProperties,

  statValue: {
    fontSize: 20,
    fontWeight: 700,
    marginTop: 5,
  } as React.CSSProperties,

  targetBadge: {
    background: "#fff",
    color: "#000",
    padding: "8px 11px",
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
  } as React.CSSProperties,

  strategyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  } as React.CSSProperties,

  strategy: {
    padding: 17,
    borderRadius: 12,
    background: "#09090b",
  } as React.CSSProperties,

  strategyValue: {
    fontSize: 20,
    fontWeight: 700,
    marginTop: 7,
  } as React.CSSProperties,

  note: {
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    background: "#0d0d0f",
    border: "1px solid #1f1f22",
    color: "#71717a",
    fontSize: 11,
    lineHeight: 1.6,
  } as React.CSSProperties,

  error: {
    padding: 20,
    borderRadius: 14,
    background: "#1c0b0b",
    border: "1px solid #7f1d1d",
    color: "#fca5a5",
  } as React.CSSProperties,
};
