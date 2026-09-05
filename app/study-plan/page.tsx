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

type Topic = {
  id: number;
  subject_id: number;
  unit: number;
  title: string;
  source: string | null;
  completed: boolean;
  completed_at: string | null;
};

type Session = {
  id: number;
  topic_id: number;
  minutes: number;
};

type SubjectGroup = Subject & {
  topics: Topic[];
  completed: number;
  total: number;
  progress: number;
};

export default function StudyPlan() {
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSubject, setOpenSubject] = useState("OOP");
  const [activeTopic, setActiveTopic] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const { data: subjects, error: subjectError } =
      await supabase
        .from("subjects")
        .select("*")
        .order("credits", { ascending: false });

    if (subjectError) {
      setError(subjectError.message);
      setLoading(false);
      return;
    }

    const { data: topics, error: topicError } =
      await supabase
        .from("study_topics")
        .select("*")
        .eq("unit", 2)
        .order("id");

    if (topicError) {
      setError(topicError.message);
      setLoading(false);
      return;
    }

    const { data: sessionData, error: sessionError } =
      await supabase
        .from("study_sessions")
        .select("id, topic_id, minutes");

    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    const mainCodes = ["OOP", "DBMS", "ADSA", "P&S", "COA"];

    const result = (subjects ?? [])
      .filter((s) => mainCodes.includes(s.short_name))
      .map((subject) => {
        const subjectTopics = (topics ?? []).filter(
          (t) => t.subject_id === subject.id
        );

        const completed = subjectTopics.filter(
          (t) => t.completed
        ).length;

        return {
          ...subject,
          topics: subjectTopics,
          completed,
          total: subjectTopics.length,
          progress:
            subjectTopics.length > 0
              ? (completed / subjectTopics.length) * 100
              : 0,
        };
      });

    setGroups(result);
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeTopic === null) return;

    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTopic]);

  async function toggleTopic(topic: Topic) {
    const next = !topic.completed;

    // Update UI immediately — no page reload and no scroll jump.
    setGroups((currentGroups) =>
      currentGroups.map((group) => {
        if (group.id !== topic.subject_id) return group;

        const updatedTopics = group.topics.map((t) =>
          t.id === topic.id
            ? {
                ...t,
                completed: next,
                completed_at: next
                  ? new Date().toISOString()
                  : null,
              }
            : t
        );

        const completed = updatedTopics.filter(
          (t) => t.completed
        ).length;

        return {
          ...group,
          topics: updatedTopics,
          completed,
          progress:
            group.total > 0
              ? (completed / group.total) * 100
              : 0,
        };
      })
    );

    // Save the change to Supabase in the background.
    const { error } = await supabase
      .from("study_topics")
      .update({
        completed: next,
        completed_at: next
          ? new Date().toISOString()
          : null,
      })
      .eq("id", topic.id);

    if (error) {
      setError(error.message);
      await load();
      return;
    }

    setError("");
  }

  async function stopSession() {
    if (activeTopic === null) return;

    if (seconds >= 10) {
      const minutes = Math.max(
        1,
        Math.round(seconds / 60)
      );

      const startedAt = new Date(
        Date.now() - seconds * 1000
      ).toISOString();

      const { error } = await supabase
        .from("study_sessions")
        .insert({
          topic_id: activeTopic,
          minutes,
          started_at: startedAt,
          ended_at: new Date().toISOString(),
        });

      if (error) {
        setError(error.message);
      }
    }

    setActiveTopic(null);
    setSeconds(0);
    await load();
  }

  function startSession(topicId: number) {
    if (activeTopic === topicId) {
      stopSession();
      return;
    }

    if (activeTopic !== null) {
      stopSession();
    }

    setSeconds(0);
    setActiveTopic(topicId);
  }

  const totalTopics = groups.reduce(
    (sum, g) => sum + g.total,
    0
  );

  const completedTopics = groups.reduce(
    (sum, g) => sum + g.completed,
    0
  );

  const overallProgress =
    totalTopics > 0
      ? (completedTopics / totalTopics) * 100
      : 0;

  const totalMinutes = sessions.reduce(
    (sum, s) => sum + s.minutes,
    0
  );

  const priority = useMemo(() => {
    return [...groups]
      .filter((g) => g.total > 0)
      .sort((a, b) => {
        if (a.short_name === "OOP") return -1;
        if (b.short_name === "OOP") return 1;
        return a.progress - b.progress;
      })[0];
  }, [groups]);

  function formatTime(value: number) {
    const minutes = Math.floor(value / 60)
      .toString()
      .padStart(2, "0");

    const secondsPart = (value % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${secondsPart}`;
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>

        <Sidebar active="study-plan" />

        <section style={styles.content}>

          <header style={styles.header}>
            <div>
              <div style={styles.eyebrow}>
                UNIT 2 · LIVE TRACKER
              </div>

              <h2 style={styles.title}>
                Study Command Center
              </h2>

              <p style={styles.subtitle}>
                Learn the material. Track the work. Move the marks.
              </p>
            </div>

            <button
              style={styles.refresh}
              onClick={load}
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
              Loading Unit 2...
            </div>
          ) : (
            <>
              <section style={styles.hero}>
                <div>
                  <div style={styles.eyebrow}>
                    UNIT 2 PROGRESS
                  </div>

                  <h3 style={styles.heroTitle}>
                    {completedTopics} of {totalTopics} topics completed
                  </h3>

                  <p style={styles.heroText}>
                    {overallProgress.toFixed(0)}% of Unit 2 is complete.
                  </p>
                </div>

                <div style={styles.heroNumber}>
                  {overallProgress.toFixed(0)}%
                </div>

                <div style={styles.heroTrack}>
                  <div
                    style={{
                      ...styles.heroBar,
                      width: `${overallProgress}%`,
                    }}
                  />
                </div>
              </section>

              <div style={styles.grid}>

                <section style={styles.card}>
                  <div style={styles.sectionHeader}>
                    <h3 style={styles.sectionTitle}>
                      Subjects
                    </h3>

                    <p style={styles.sectionSub}>
                      Complete Unit 2 systematically.
                    </p>
                  </div>

                  {groups.map((group) => (
                    <div key={group.id}>

                      <button
                        onClick={() =>
                          setOpenSubject(
                            openSubject === group.short_name
                              ? ""
                              : group.short_name
                          )
                        }
                        style={{
                          ...styles.subjectButton,
                          background:
                            openSubject === group.short_name
                              ? "#18181b"
                              : "transparent",
                        }}
                      >
                        <div style={styles.subjectLeft}>

                          <div style={styles.subjectIcon}>
                            {group.short_name}
                          </div>

                          <div>
                            <strong>
                              {group.name}
                            </strong>

                            <div style={styles.subjectMeta}>
                              {group.completed}/{group.total} complete
                            </div>
                          </div>

                        </div>

                        <div style={styles.subjectRight}>
                          <span>
                            {group.progress.toFixed(0)}%
                          </span>

                          <span>
                            {openSubject === group.short_name
                              ? "−"
                              : "+"}
                          </span>
                        </div>
                      </button>

                      {openSubject === group.short_name && (
                        <div style={styles.topicList}>

                          {group.topics.map((topic, index) => (
                            <div
                              key={topic.id}
                              style={{
                                ...styles.topic,
                                opacity: topic.completed ? 0.55 : 1,
                              }}
                            >

                              <button
                                onClick={() =>
                                  toggleTopic(topic)
                                }
                                style={{
                                  ...styles.checkbox,
                                  background: topic.completed
                                    ? "#fff"
                                    : "transparent",
                                  color: topic.completed
                                    ? "#000"
                                    : "#fff",
                                }}
                              >
                                {topic.completed ? "✓" : ""}
                              </button>

                              <div style={styles.topicInfo}>
                                <strong
                                  style={{
                                    textDecoration:
                                      topic.completed
                                        ? "line-through"
                                        : "none",
                                  }}
                                >
                                  {index + 1}. {topic.title}
                                </strong>

                                <span>
                                  {topic.source}
                                </span>
                              </div>

                              <button
                                onClick={() =>
                                  startSession(topic.id)
                                }
                                style={{
                                  ...styles.sessionButton,
                                  background:
                                    activeTopic === topic.id
                                      ? "#fff"
                                      : "#18181b",
                                  color:
                                    activeTopic === topic.id
                                      ? "#000"
                                      : "#fff",
                                }}
                              >
                                {activeTopic === topic.id
                                  ? formatTime(seconds)
                                  : "Start"}
                              </button>

                            </div>
                          ))}

                        </div>
                      )}

                    </div>
                  ))}
                </section>

                <aside>

                  <section style={styles.card}>
                    <div style={styles.eyebrow}>
                      TODAY&apos;S FOCUS
                    </div>

                    <h3 style={styles.focusTitle}>
                      {priority?.name || "Choose a subject"}
                    </h3>

                    <p style={styles.focusText}>
                      OOP is currently your most critical
                      major subject. Start there unless
                      today's schedule says otherwise.
                    </p>

                    {priority && (
                      <button
                        onClick={() =>
                          setOpenSubject(priority.short_name)
                        }
                        style={styles.focusButton}
                      >
                        Open {priority.short_name} →
                      </button>
                    )}
                  </section>

                  <section style={styles.card}>
                    <div style={styles.eyebrow}>
                      STUDY TIME
                    </div>

                    <div style={styles.bigStat}>
                      {totalMinutes}
                    </div>

                    <p style={styles.sectionSub}>
                      minutes recorded
                    </p>

                    <div style={styles.miniGrid}>
                      <MiniStat
                        label="Topics"
                        value={`${completedTopics}/${totalTopics}`}
                      />

                      <MiniStat
                        label="Progress"
                        value={`${overallProgress.toFixed(0)}%`}
                      />
                    </div>
                  </section>

                  <section style={styles.card}>
                    <div style={styles.eyebrow}>
                      WORKFLOW
                    </div>

                    <p style={styles.workflow}>
                      <strong>1.</strong> Pick a topic
                    </p>

                    <p style={styles.workflow}>
                      <strong>2.</strong> Start timer
                    </p>

                    <p style={styles.workflow}>
                      <strong>3.</strong> Study
                    </p>

                    <p style={styles.workflow}>
                      <strong>4.</strong> Stop timer
                    </p>

                    <p style={styles.workflow}>
                      <strong>5.</strong> Mark complete
                    </p>
                  </section>

                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.miniStat}>
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
    borderRadius: 10,
    marginBottom: 5,
  } as React.CSSProperties,

  activeNav: {
    display: "block",
    padding: "12px 13px",
    color: "#000",
    background: "#fff",
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
    borderRadius: 10,
    marginBottom: 5,
  } as React.CSSProperties,

  examCard: {
    marginTop: 50,
    padding: 16,
    borderRadius: 14,
    background: "#111113",
    border: "1px solid #27272a",
  } as React.CSSProperties,

  sideStats: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px solid #1f1f22",
    color: "#71717a",
    fontSize: 11,
    marginTop: 15,
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

  hero: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 25,
    marginBottom: 15,
    position: "relative" as const,
  } as React.CSSProperties,

  heroTitle: {
    fontSize: 24,
    margin: "8px 0",
  } as React.CSSProperties,

  heroText: {
    color: "#71717a",
    fontSize: 12,
  } as React.CSSProperties,

  heroNumber: {
    position: "absolute" as const,
    right: 25,
    top: 25,
    fontSize: 40,
    fontWeight: 800,
  } as React.CSSProperties,

  heroTrack: {
    height: 7,
    background: "#27272a",
    borderRadius: 10,
    marginTop: 22,
    overflow: "hidden" as const,
  } as React.CSSProperties,

  heroBar: {
    height: "100%",
    background: "#fff",
    borderRadius: 10,
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "1.6fr 0.8fr",
    gap: 15,
  } as React.CSSProperties,

  card: {
    background: "#111113",
    border: "1px solid #27272a",
    borderRadius: 15,
    padding: 23,
    marginBottom: 15,
  } as React.CSSProperties,

  sectionHeader: {
    marginBottom: 15,
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

  subjectButton: {
    width: "100%",
    border: 0,
    color: "#fff",
    padding: 13,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    textAlign: "left" as const,
    marginBottom: 4,
  } as React.CSSProperties,

  subjectLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
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
  } as React.CSSProperties,

  subjectMeta: {
    color: "#52525b",
    fontSize: 9,
    marginTop: 4,
  } as React.CSSProperties,

  subjectRight: {
    display: "flex",
    gap: 15,
    color: "#71717a",
    fontSize: 11,
  } as React.CSSProperties,

  topicList: {
    padding: "3px 0 10px 52px",
  } as React.CSSProperties,

  topic: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 0",
    borderBottom: "1px solid #1f1f22",
  } as React.CSSProperties,

  checkbox: {
    width: 24,
    height: 24,
    border: "1px solid #52525b",
    borderRadius: 7,
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  topicInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  } as React.CSSProperties,

  sessionButton: {
    border: "1px solid #27272a",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 10,
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  focusTitle: {
    fontSize: 23,
    margin: "12px 0 8px",
  } as React.CSSProperties,

  focusText: {
    color: "#a1a1aa",
    fontSize: 12,
    lineHeight: 1.6,
  } as React.CSSProperties,

  focusButton: {
    marginTop: 12,
    border: 0,
    background: "#fff",
    color: "#000",
    borderRadius: 9,
    padding: "10px 13px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 11,
  } as React.CSSProperties,

  bigStat: {
    fontSize: 42,
    fontWeight: 800,
    marginTop: 12,
  } as React.CSSProperties,

  miniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 18,
  } as React.CSSProperties,

  miniStat: {
    padding: 12,
    background: "#09090b",
    borderRadius: 10,
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
  } as React.CSSProperties,

  workflow: {
    color: "#a1a1aa",
    fontSize: 12,
    margin: "12px 0",
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
