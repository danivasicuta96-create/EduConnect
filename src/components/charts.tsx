"use client";

// Chart primitives. Palette validated for colour-vision deficiency
// (dataviz validator, light surface): coral, blue, aqua, yellow, violet in
// that fixed order. Every chart ships a screen-reader table and a hover
// tooltip; text always uses ink tokens, never the series colour.

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar, Cell, Legend,
} from "recharts";

export const SERIES = ["#d93a3a", "#2a78d6", "#1baf7a", "#eda100", "#6250d6"] as const;
const INK = { text: "#586189", grid: "#e9ebf3", axis: "#d0d4e4", strong: "#1b1f36" };

const axisProps = {
  tick: { fill: INK.text, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: INK.axis },
} as const;

function SrTable({ caption, rows, columns }: { caption: string; rows: ReadonlyArray<object>; columns: Array<{ key: string; label: string }> }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => { const r = row as Record<string, unknown>; return (
          <tr key={i}>{columns.map((c) => <td key={c.key}>{r[c.key] === null || r[c.key] === undefined ? "—" : String(r[c.key])}</td>)}</tr>
        ); })}
      </tbody>
    </table>
  );
}

function TooltipBox({ active, payload, label, suffix = "" }: { active?: boolean; payload?: Array<{ value: number | null; name: string; color: string }>; label?: string; suffix?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-ink-100">
      <p className="mb-1 font-bold text-ink-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-700">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {payload.length > 1 && <span>{p.name}:</span>}
          <span className="font-semibold text-ink-900">{p.value === null ? "—" : `${p.value}${suffix}`}</span>
        </p>
      ))}
    </div>
  );
}

export interface Point {
  label: string;
  value: number | null;
}

/** Single-series trend line (e.g. mood over days, average over time). */
export function TrendChart({ data, title, domain = [0, 10], threshold, thresholdLabel, height = 220, suffix = "" }: {
  data: Point[]; title: string; domain?: [number, number]; threshold?: number; thresholdLabel?: string; height?: number; suffix?: string;
}) {
  return (
    <figure aria-label={title}>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis domain={domain} {...axisProps} allowDecimals={false} width={44} />
            <Tooltip content={<TooltipBox suffix={suffix} />} cursor={{ stroke: INK.axis, strokeWidth: 1 }} />
            {threshold !== undefined && (
              <ReferenceLine y={threshold} stroke={INK.text} strokeDasharray="4 4" label={{ value: thresholdLabel ?? "", fill: INK.text, fontSize: 11, position: "insideTopRight" }} />
            )}
            <Line type="monotone" dataKey="value" name={title} stroke={SERIES[0]} strokeWidth={2} connectNulls
              dot={{ r: 4, fill: SERIES[0], stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption={title} rows={data} columns={[{ key: "label", label: "Date" }, { key: "value", label: "Value" }]} />
    </figure>
  );
}

/** Several series on one shared axis (e.g. class averages per subject over weeks). */
export function MultiLineChart({ data, series, title, domain = [0, 10], height = 240 }: {
  data: Array<Record<string, string | number | null>>; series: Array<{ key: string; label: string }>; title: string; domain?: [number, number]; height?: number;
}) {
  const shown = series.slice(0, SERIES.length);
  return (
    <figure aria-label={title}>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={16} />
            <YAxis domain={domain} {...axisProps} width={44} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: INK.axis }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: INK.text }} />
            {shown.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} connectNulls
                dot={{ r: 4, fill: SERIES[i], stroke: "#fff", strokeWidth: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption={title} rows={data} columns={[{ key: "label", label: "Period" }, ...shown]} />
    </figure>
  );
}

/** Vertical bars for one measure across categories (subject averages, attendance %). */
export function BarsChart({ data, title, domain = [0, 10], height = 240, suffix = "", threshold }: {
  data: Point[]; title: string; domain?: [number, number]; height?: number; suffix?: string; threshold?: number;
}) {
  return (
    <figure aria-label={title}>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps} interval={0} tick={{ fill: INK.text, fontSize: 11 }} height={44} angle={data.length > 5 ? -25 : 0} textAnchor={data.length > 5 ? "end" : "middle"} />
            <YAxis domain={domain} {...axisProps} width={44} />
            <Tooltip content={<TooltipBox suffix={suffix} />} cursor={{ fill: "rgb(217 58 58 / 0.06)" }} />
            {threshold !== undefined && <ReferenceLine y={threshold} stroke={INK.text} strokeDasharray="4 4" />}
            <Bar dataKey="value" name={title} radius={[4, 4, 0, 0]} maxBarSize={44}>
              {data.map((d, i) => (
                <Cell key={i} fill={threshold !== undefined && d.value !== null && d.value < threshold ? "#eda100" : SERIES[0]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption={title} rows={data} columns={[{ key: "label", label: "Category" }, { key: "value", label: "Value" }]} />
    </figure>
  );
}

/** Proportional stacked bar for a small fixed set of buckets, directly labelled (not colour-alone). */
export function DistributionBar({ buckets, title }: { buckets: Array<{ label: string; value: number }>; title: string }) {
  const total = buckets.reduce((a, b) => a + b.value, 0);
  const colors = ["#eda100", "#2a78d6", "#1baf7a"];
  return (
    <figure aria-label={title}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-ink-100" aria-hidden>
        {total > 0 && buckets.map((b, i) => b.value > 0 && <div key={b.label} style={{ width: `${(b.value / total) * 100}%`, background: colors[i % colors.length] }} title={`${b.label}: ${b.value}`} />)}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
        {buckets.map((b, i) => (
          <span key={b.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: colors[i % colors.length] }} aria-hidden />
            {b.label}: <strong className="text-ink-900">{total ? Math.round((b.value / total) * 100) : 0}%</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
