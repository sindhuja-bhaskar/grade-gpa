"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * GPA and CGPA by semester (§28, §29).
 *
 * Semesters with nothing completed carry a null GPA — the line breaks rather
 * than dropping to zero, so the chart cannot imply a 0.00 that does not exist
 * (BR-22).
 */
export function TrendChart({
  data,
}: {
  data: Array<{ label: string; gpa: number | null; cgpa: number | null }>;
}) {
  if (data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: -16 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? value.toFixed(2) : "Not yet available",
              name === "gpa" ? "Semester GPA" : "CGPA",
            ]}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="plainline"
            formatter={(value) => (value === "gpa" ? "Semester GPA" : "CGPA")}
          />
          <Line
            type="monotone"
            dataKey="gpa"
            name="gpa"
            stroke="var(--color-ontrack)"
            strokeWidth={2}
            connectNulls={false}
            dot
          />
          <Line
            type="monotone"
            dataKey="cgpa"
            name="cgpa"
            stroke="var(--color-excellent)"
            strokeWidth={2}
            connectNulls={false}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
