"use client";

import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ============== TYPES ==============

interface ChartDataPoint {
    name: string;
    value: number;
    [key: string]: string | number;
}

interface BaseChartProps {
    data: ChartDataPoint[];
    title?: string;
    className?: string;
    height?: number;
}

// ============== COLORS ==============

const CHART_COLORS = {
    primary: "#1a3320", // ink
    secondary: "#4F46E5", // intel-blue
    success: "#22c55e",
    warning: "#eab308",
    danger: "#ef4444",
    muted: "#6b705c",
};

const PIE_COLORS = ["#1a3320", "#4F46E5", "#22c55e", "#eab308", "#ef4444", "#6b705c"];

// ============== LINE CHART ==============

interface LineChartComponentProps extends BaseChartProps {
    lines?: Array<{ dataKey: string; color?: string; name?: string }>;
}

export function AnalyticsLineChart({
    data,
    title,
    className,
    height = 300,
    lines = [{ dataKey: "value", color: CHART_COLORS.primary }],
}: LineChartComponentProps) {
    return (
        <Card className={className}>
            {title && (
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dcdcc6" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #dcdcc6",
                                borderRadius: "4px",
                                fontSize: "12px",
                            }}
                        />
                        <Legend />
                        {lines.map((line, i) => (
                            <Line
                                key={line.dataKey}
                                type="monotone"
                                dataKey={line.dataKey}
                                stroke={line.color || PIE_COLORS[i % PIE_COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name={line.name || line.dataKey}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// ============== AREA CHART ==============

interface AreaChartComponentProps extends BaseChartProps {
    areas?: Array<{ dataKey: string; color?: string; name?: string }>;
}

export function AnalyticsAreaChart({
    data,
    title,
    className,
    height = 300,
    areas = [{ dataKey: "value", color: CHART_COLORS.primary }],
}: AreaChartComponentProps) {
    return (
        <Card className={className}>
            {title && (
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dcdcc6" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #dcdcc6",
                                borderRadius: "4px",
                                fontSize: "12px",
                            }}
                        />
                        {areas.map((area, i) => (
                            <Area
                                key={area.dataKey}
                                type="monotone"
                                dataKey={area.dataKey}
                                stroke={area.color || PIE_COLORS[i % PIE_COLORS.length]}
                                fill={area.color || PIE_COLORS[i % PIE_COLORS.length]}
                                fillOpacity={0.2}
                                name={area.name || area.dataKey}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// ============== BAR CHART ==============

interface BarChartComponentProps extends BaseChartProps {
    bars?: Array<{ dataKey: string; color?: string; name?: string }>;
    layout?: "horizontal" | "vertical";
}

export function AnalyticsBarChart({
    data,
    title,
    className,
    height = 300,
    bars = [{ dataKey: "value", color: CHART_COLORS.primary }],
    layout = "horizontal",
}: BarChartComponentProps) {
    return (
        <Card className={className}>
            {title && (
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                        data={data}
                        layout={layout === "vertical" ? "vertical" : "horizontal"}
                        margin={{ top: 5, right: 20, left: layout === "vertical" ? 80 : 0, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#dcdcc6" />
                        {layout === "vertical" ? (
                            <>
                                <XAxis type="number" tick={{ fontSize: 12, fill: CHART_COLORS.muted }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                                    width={75}
                                />
                            </>
                        ) : (
                            <>
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: CHART_COLORS.muted }} />
                                <YAxis tick={{ fontSize: 12, fill: CHART_COLORS.muted }} />
                            </>
                        )}
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #dcdcc6",
                                borderRadius: "4px",
                                fontSize: "12px",
                            }}
                        />
                        {bars.map((bar, i) => (
                            <Bar
                                key={bar.dataKey}
                                dataKey={bar.dataKey}
                                fill={bar.color || PIE_COLORS[i % PIE_COLORS.length]}
                                radius={[4, 4, 0, 0]}
                                name={bar.name || bar.dataKey}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// ============== PIE/DONUT CHART ==============

interface PieChartComponentProps extends BaseChartProps {
    innerRadius?: number;
    showLabels?: boolean;
}

export function AnalyticsPieChart({
    data,
    title,
    className,
    height = 300,
    innerRadius = 0,
    showLabels = true,
}: PieChartComponentProps) {
    return (
        <Card className={className}>
            {title && (
                <CardHeader>
                    <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
            )}
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={innerRadius}
                            outerRadius={height / 3}
                            paddingAngle={2}
                            dataKey="value"
                            label={showLabels ? ({ name, percent }) =>
                                `${name} (${(percent * 100).toFixed(0)}%)`
                                : false}
                            labelLine={showLabels}
                        >
                            {data.map((_, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #dcdcc6",
                                borderRadius: "4px",
                                fontSize: "12px",
                            }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// ============== STAT CARD WITH SPARKLINE ==============

interface SparklineStatProps {
    title: string;
    value: string | number;
    change?: { value: number; isPositive: boolean };
    data: number[];
    className?: string;
}

export function SparklineStat({
    title,
    value,
    change,
    data,
    className,
}: SparklineStatProps) {
    const sparkData = data.map((v, i) => ({ name: i.toString(), value: v }));

    return (
        <Card className={className}>
            <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm font-mono uppercase tracking-widest text-muted">{title}</p>
                        <p className="text-3xl font-serif mt-1">{value}</p>
                        {change && (
                            <p className={cn(
                                "text-xs mt-1",
                                change.isPositive ? "text-green-600" : "text-red-500"
                            )}>
                                {change.isPositive ? "↑" : "↓"} {Math.abs(change.value)}%
                            </p>
                        )}
                    </div>
                    <div className="w-24 h-12">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sparkData}>
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={change?.isPositive ? "#22c55e" : "#ef4444"}
                                    fill={change?.isPositive ? "#22c55e" : "#ef4444"}
                                    fillOpacity={0.2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default {
    AnalyticsLineChart,
    AnalyticsAreaChart,
    AnalyticsBarChart,
    AnalyticsPieChart,
    SparklineStat,
};
