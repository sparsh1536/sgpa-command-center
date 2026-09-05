"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/Sidebar";

type Subject = {
  id: string;
  name: string;
  short_name: string;
  credits: number;
};

type Marks = {
  assignment: number | null;
  attendance: number | null;
  mst1_raw: number | null;
  quiz_raw: number | null;
  surprise_raw: number | null;
  mst2_raw: number | null;
  est_raw: number | null;
};

export default function SubjectPage() {
  const params = useParams();
  const id = String(params.id);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [marks, setMarks] = useState<Marks>({
    assignment: null,
    attendance: null,
    mst1_raw: null,
    quiz_raw: null,
    surprise_raw: null,
    mst2_raw: null,
    est_raw: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: subjectData, error: subjectError } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", id)
      .single();

    if (subjectError) {
      setError(subjectError.message);
      setLoading(false);
      return;
    }

    setSubject(subjectData);

    const { data: marksData, error: marksError } = await supabase
      .from("subject_marks")
      .select("*")
      .eq("subject_id", id)
      .maybeSingle();

    if (marksError) {
      setError(marksError.message);
    } else if (marksData) {
      setMarks({
        assignment: marksData.assignment,
        attendance: marksData.attendance,
        mst1_raw: marksData.mst1_raw,
        quiz_raw: marksData.quiz_raw,
        surprise_raw: marksData.surprise_raw,
        mst2_raw: marksData.mst2_raw,
        est_raw: marksData.est_raw,
      });
    }

    setLoading(false);
  }

  async function saveMarks() {
    setSaving(true);
    setMessage("");
    setError("");

    const { error } = await supabase
      .from("subject_marks")
      .upsert(
        {
          subject_id: id,
          assignment: marks.assignment,
          attendance: marks.attendance,
          mst1_raw: marks.mst1_raw,
          quiz_raw: marks.quiz_raw,
          surprise_raw: marks.surprise_raw,
          mst2_raw: marks.mst2_raw,
          est_raw: marks.est_raw,
        },
        { onConflict: "subject_id" }
      );

    if (error) {
      setError(error.message);
    } else {
      setMessage("✓ Marks saved successfully");
    }

    setSaving(false);
  }

  function updateMark(key: keyof Marks, value: string) {
    setMarks((current) => ({
      ...current,
      [key]: value === "" ? null : Number(value),
    }));
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>Loading subject...</div>
      </main>
    );
  }

  if (!subject) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <div style={errorStyle}>Subject not found.</div>
        </div>
      </main>
    );
  }

  const assignment = marks.assignment ?? 0;
  const attendance = marks.attendance ?? 0;
  const mst1 = (marks.mst1_raw ?? 0) / 2;
  const quiz = (marks.quiz_raw ?? 0) / 2;
  const surprise =
    marks.surprise_raw == null ? 0 : marks.surprise_raw / 2;
  const mst2 = (marks.mst2_raw ?? 0) / 2;
  const est = marks.est_raw ?? 0;

  const currentScore =
    assignment + attendance + mst1 + quiz + surprise + mst2 + est;

  const maxPossible =
    assignment +
    attendance +
    (marks.mst1_raw == null ? 10 : mst1) +
    (marks.quiz_raw == null ? 2 : quiz) +
    (marks.surprise_raw == null ? 6 : surprise) +
    (marks.mst2_raw == null ? 10 : mst2) +
    (marks.est_raw == null ? 60 : est);

  const target = 85;
  const stillNeeded = Math.max(0, target - currentScore);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#09090b",
      }}
    >
      <Sidebar active="subjects" />

      <main
        style={{
          ...pageStyle,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div style={containerStyle}>
        <a href="/" style={backStyle}>
          ← Dashboard
        </a>

        <div style={{ marginTop: 35 }}>
          <div style={mutedStyle}>
            {subject.short_name} · {subject.credits} credits
          </div>

          <h1 style={titleStyle}>{subject.name}</h1>

          <p style={mutedStyle}>
            Enter your marks and track your 9+ SGPA strategy.
          </p>
        </div>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <div style={labelStyle}>CURRENT SCORE</div>
            <div style={bigNumberStyle}>
              {currentScore.toFixed(1)}
              <span style={smallNumberStyle}> / 100</span>
            </div>

            <div style={progressOuter}>
              <div
                style={{
                  ...progressInner,
                  width: `${Math.min(currentScore, 100)}%`,
                }}
              />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={labelStyle}>MAXIMUM POSSIBLE</div>
            <div style={bigNumberStyle}>
              {maxPossible.toFixed(1)}
              <span style={smallNumberStyle}> / 100</span>
            </div>

            <div
              style={{
                marginTop: 15,
                color: maxPossible >= target ? "#86efac" : "#fca5a5",
                fontWeight: 700,
              }}
            >
              {maxPossible >= target
                ? "TARGET STILL POSSIBLE"
                : "TARGET CURRENTLY IMPOSSIBLE"}
            </div>
          </div>
        </div>

        <section style={sectionStyle}>
          <div style={labelStyle}>9 GP TARGET ENGINE</div>

          <h2 style={{ margin: "8px 0 5px", fontSize: 26 }}>
            What you need from here
          </h2>

          <div style={engineGrid}>
            <Stat title="Points secured" value={currentScore.toFixed(1)} />
            <Stat title="Still needed" value={stillNeeded.toFixed(1)} />
            <Stat
              title="Target"
              value={`${target} / 100`}
            />
            <Stat
              title="Maximum possible"
              value={maxPossible.toFixed(1)}
            />
          </div>
        </section>

        <section style={sectionStyle}>
          <div style={labelStyle}>UPDATE MARKS</div>

          <h2 style={{ margin: "8px 0 20px", fontSize: 26 }}>
            Enter your latest marks
          </h2>

          <div style={marksGrid}>
            <MarkInput
              label="Assignment"
              value={marks.assignment}
              max={10}
              onChange={(v) => updateMark("assignment", v)}
            />

            <MarkInput
              label="Attendance"
              value={marks.attendance}
              max={2}
              onChange={(v) => updateMark("attendance", v)}
            />

            <MarkInput
              label="MST-1"
              value={marks.mst1_raw}
              max={20}
              onChange={(v) => updateMark("mst1_raw", v)}
            />

            <MarkInput
              label="Quiz"
              value={marks.quiz_raw}
              max={4}
              onChange={(v) => updateMark("quiz_raw", v)}
            />

            <MarkInput
              label="Surprise Test"
              value={marks.surprise_raw}
              max={12}
              onChange={(v) => updateMark("surprise_raw", v)}
            />

            <MarkInput
              label="MST-2"
              value={marks.mst2_raw}
              max={20}
              onChange={(v) => updateMark("mst2_raw", v)}
            />

            <MarkInput
              label="EST"
              value={marks.est_raw}
              max={60}
              onChange={(v) => updateMark("est_raw", v)}
            />
          </div>

          <button onClick={saveMarks} disabled={saving} style={buttonStyle}>
            {saving ? "Saving..." : "Save Marks"}
          </button>

          {message && <div style={successStyle}>{message}</div>}
          {error && <div style={errorStyle}>{error}</div>}
        </section>

        <section style={sectionStyle}>
          <div style={labelStyle}>MARKS BREAKDOWN</div>

          <div style={breakdownGrid}>
            <Breakdown title="Assignment" value={assignment} />
            <Breakdown title="Attendance" value={attendance} />
            <Breakdown title="MST-1 weighted" value={mst1} />
            <Breakdown title="Quiz weighted" value={quiz} />
            <Breakdown title="Surprise weighted" value={surprise} />
            <Breakdown title="MST-2 weighted" value={mst2} />
            <Breakdown title="EST" value={est} />
          </div>
        </section>
      </div>
      </main>
    </div>
  );
}

function MarkInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label} <span style={{ color: "#52525b" }}>/ {max}</span>
      </label>

      <input
        type="number"
        min="0"
        max={max}
        step="1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        style={inputStyle}
      />
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8 }}>
        {value}
      </div>
    </div>
  );
}

function Breakdown({ title, value }: { title: string; value: number }) {
  return (
    <div style={breakdownCard}>
      <div style={mutedStyle}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 7 }}>
        {value.toFixed(1)}
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#09090b",
  color: "#f4f4f5",
  padding: "40px",
  fontFamily: "Arial, sans-serif",
};

const containerStyle = {
  maxWidth: 1100,
  margin: "0 auto",
};

const backStyle = {
  color: "#a1a1aa",
  textDecoration: "none",
};

const titleStyle = {
  fontSize: 42,
  margin: "8px 0",
};

const mutedStyle = {
  color: "#a1a1aa",
  fontSize: 14,
};

const labelStyle = {
  color: "#71717a",
  fontSize: 13,
  fontWeight: 500,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 16,
  marginTop: 35,
};

const cardStyle = {
  background: "#111113",
  border: "1px solid #27272a",
  borderRadius: 16,
  padding: 24,
};

const bigNumberStyle = {
  fontSize: 40,
  fontWeight: 700,
  marginTop: 10,
};

const smallNumberStyle = {
  fontSize: 18,
  color: "#71717a",
  fontWeight: 400,
};

const progressOuter = {
  height: 7,
  background: "#27272a",
  borderRadius: 10,
  marginTop: 20,
  overflow: "hidden" as const,
};

const progressInner = {
  height: "100%",
  background: "#f4f4f5",
  borderRadius: 10,
};

const sectionStyle = {
  marginTop: 18,
  background: "#111113",
  border: "1px solid #27272a",
  borderRadius: 16,
  padding: 24,
};

const engineGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 20,
  marginTop: 25,
};

const marksGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 18,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  marginTop: 8,
  background: "#09090b",
  color: "#f4f4f5",
  border: "1px solid #3f3f46",
  borderRadius: 10,
  padding: "13px 14px",
  fontSize: 17,
  outline: "none",
};

const buttonStyle = {
  marginTop: 25,
  background: "#f4f4f5",
  color: "#09090b",
  border: "none",
  borderRadius: 10,
  padding: "13px 22px",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

const successStyle = {
  marginTop: 15,
  color: "#86efac",
};

const errorStyle = {
  marginTop: 15,
  padding: 16,
  border: "1px solid #7f1d1d",
  background: "#1c0b0b",
  borderRadius: 10,
  color: "#fca5a5",
};

const breakdownGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  marginTop: 20,
};

const breakdownCard = {
  background: "#09090b",
  border: "1px solid #27272a",
  borderRadius: 12,
  padding: 16,
};
