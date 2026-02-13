import React from 'react'

interface MockChartProps {
  data?: any[]
  children?: React.ReactNode
  width?: number
  height?: number
}

export const LineChart = React.forwardRef<any, MockChartProps>(({ data, children, ...props }, ref) => (
  <div ref={ref} data-testid="line-chart" data-chart-data={JSON.stringify(data)} {...props}>
    {children}
  </div>
))
LineChart.displayName = 'LineChart'

export const BarChart = React.forwardRef<any, MockChartProps>(({ data, children, ...props }, ref) => (
  <div ref={ref} data-testid="bar-chart" data-chart-data={JSON.stringify(data)} {...props}>
    {children}
  </div>
))
BarChart.displayName = 'BarChart'

export const AreaChart = React.forwardRef<any, MockChartProps>(({ data, children, ...props }, ref) => (
  <div ref={ref} data-testid="area-chart" data-chart-data={JSON.stringify(data)} {...props}>
    {children}
  </div>
))
AreaChart.displayName = 'AreaChart'

export const PieChart = React.forwardRef<any, MockChartProps>(({ data, children, ...props }, ref) => (
  <div ref={ref} data-testid="pie-chart" data-chart-data={JSON.stringify(data)} {...props}>
    {children}
  </div>
))
PieChart.displayName = 'PieChart'

export const XAxis = React.forwardRef<any, any>(({ dataKey, ...props }, ref) => (
  <div ref={ref} data-testid="x-axis" data-data-key={dataKey} {...props} />
))
XAxis.displayName = 'XAxis'

export const YAxis = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="y-axis" {...props} />
))
YAxis.displayName = 'YAxis'

export const CartesianGrid = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="cartesian-grid" {...props} />
))
CartesianGrid.displayName = 'CartesianGrid'

export const Tooltip = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="tooltip" {...props} />
))
Tooltip.displayName = 'Tooltip'

export const Legend = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="legend" {...props} />
))
Legend.displayName = 'Legend'

export const ResponsiveContainer = React.forwardRef<any, MockChartProps>(({ children, ...props }, ref) => (
  <div ref={ref} data-testid="responsive-container" {...props}>
    {children}
  </div>
))
ResponsiveContainer.displayName = 'ResponsiveContainer'

export const Cell = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="cell" {...props} />
))
Cell.displayName = 'Cell'

export const Bar = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="bar" {...props} />
))
Bar.displayName = 'Bar'

export const Area = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="area" {...props} />
))
Area.displayName = 'Area'

export const Line = React.forwardRef<any, any>(({ ...props }, ref) => (
  <div ref={ref} data-testid="line" {...props} />
))
Line.displayName = 'Line'
