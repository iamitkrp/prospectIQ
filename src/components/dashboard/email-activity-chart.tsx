"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import type { DailyEmailCount } from "@/app/dashboard/actions";

interface EmailActivityChartProps {
    data: DailyEmailCount[];
}

/**
 * 30-day email activity area chart with Recharts.
 */
export function EmailActivityChart({ data }: EmailActivityChartProps) {
    if (data.length === 0) {
        return (
            <div className="chart-empty">
                <p>No email activity in the last 30 days.</p>
            </div>
        );
    }

    // Format date labels as "Feb 1"
    const formatted = data.map((d) => {
        const dt = new Date(d.date + "T00:00:00");
        const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { ...d, label };
    });

    return (
        <div className="chart-card">
            <h3 className="chart-title">Email Activity — Last 30 Days</h3>
            <div className="chart-container">
                <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                            <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradReplied" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.06)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "var(--bg-surface)",
                                border: "1px solid var(--border-default)",
                                borderRadius: "8px",
                                fontSize: "0.75rem",
                            }}
                            labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }}
                        />
                        <Area
                            type="monotone"
                            dataKey="sent"
                            name="Sent"
                            stroke="#22c55e"
                            fill="url(#gradSent)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="failed"
                            name="Failed"
                            stroke="#ef4444"
                            fill="url(#gradFailed)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="replied"
                            name="Replied"
                            stroke="#6366f1"
                            fill="url(#gradReplied)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
