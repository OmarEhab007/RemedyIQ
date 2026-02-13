import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LineChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FixedSizeList, VariableSizeList } from 'react-window'

describe('Recharts Mocks', () => {
  it('should render LineChart mock', () => {
    const data = [{ name: 'Page A', value: 100 }]
    render(
      <LineChart data={data} width={400} height={300}>
        <XAxis dataKey="name" />
        <YAxis />
      </LineChart>
    )
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
  })

  it('should render BarChart mock', () => {
    const data = [{ name: 'Page A', value: 100 }]
    render(
      <BarChart data={data} width={400} height={300}>
        <CartesianGrid />
        <Tooltip />
      </BarChart>
    )
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
  })

  it('should render ResponsiveContainer mock', () => {
    render(
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={[]}>
          <XAxis />
        </LineChart>
      </ResponsiveContainer>
    )
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})

describe('react-window Mocks', () => {
  it('should render FixedSizeList mock', () => {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <div style={style}>Row {index}</div>
    )

    render(
      <FixedSizeList
        itemCount={5}
        itemSize={40}
        height={200}
        width={300}
      >
        {Row}
      </FixedSizeList>
    )

    expect(screen.getByTestId('fixed-size-list')).toBeInTheDocument()
    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.getByText('Row 4')).toBeInTheDocument()
  })

  it('should render VariableSizeList mock', () => {
    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <div style={style}>Item {index}</div>
    )

    render(
      <VariableSizeList
        itemCount={3}
        height={200}
        width={300}
      >
        {Row}
      </VariableSizeList>
    )

    expect(screen.getByTestId('variable-size-list')).toBeInTheDocument()
    expect(screen.getByText('Item 0')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })
})
