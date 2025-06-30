
"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { format, subDays, startOfDay } from 'date-fns';

interface ChartDataPoint {
  date: string; // Expects YYYY-MM-DD
  overdue: number;
  completed: number;
}

interface OverdueTasksChartProps {
  data?: ChartDataPoint[];
}

// Generate default data for the last 7 days with 0 values
const generateDefaultData = (): ChartDataPoint[] => {
  const today = new Date();
  const defaultData: ChartDataPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    defaultData.push({
      date: format(startOfDay(subDays(today, i)), "yyyy-MM-dd"),
      overdue: 0,
      completed: 0,
    });
  }
  return defaultData;
};


const chartConfig = {
  overdue: {
    label: "Newly Overdue", // Updated label to be more specific
    color: "hsl(var(--destructive))",
  },
  completed: {
    label: "Completed",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function OverdueTasksChart({ data }: OverdueTasksChartProps) {
  const chartDataToDisplay = data && data.length > 0 ? data : generateDefaultData();
  
  // Custom tick formatter for XAxis to show MM-DD
  const formatXAxis = (tickItem: string) => {
    // Assuming tickItem is "YYYY-MM-DD"
    return format(new Date(tickItem + 'T00:00:00'), "MMM d"); // Add T00:00:00 to ensure correct parsing as local date
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Task Overview</CardTitle>
        <CardDescription>Newly overdue vs. Completed tasks in the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDataToDisplay} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <XAxis 
                dataKey="date" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8}
                tickFormatter={formatXAxis} // Apply custom formatter
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar dataKey="overdue" fill="var(--color-overdue)" radius={4} name="Newly Overdue" />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={4} name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
