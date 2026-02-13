import { describe, it, expect } from 'vitest'
import { renderWithProviders, mockData, testHelpers } from '@/test-utils'

describe('Test Utils', () => {
  describe('renderWithProviders', () => {
    it('should render components', () => {
      const TestComponent = () => <div>Test Component</div>
      const { getByText } = renderWithProviders(<TestComponent />)
      expect(getByText('Test Component')).toBeInTheDocument()
    })
  })

  describe('mockData', () => {
    it('should generate a single log entry', () => {
      const entry = mockData.logEntry()
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('timestamp')
      expect(entry).toHaveProperty('level')
      expect(entry).toHaveProperty('message')
    })

    it('should generate log entry with overrides', () => {
      const entry = mockData.logEntry({ level: 'ERROR', message: 'Custom message' })
      expect(entry.level).toBe('ERROR')
      expect(entry.message).toBe('Custom message')
    })

    it('should generate multiple log entries', () => {
      const entries = mockData.logEntries(5)
      expect(entries).toHaveLength(5)
      expect(entries[0].id).toBe('1')
      expect(entries[4].id).toBe('5')
    })

    it('should generate chart data', () => {
      const data = mockData.chartData(3)
      expect(data).toHaveLength(3)
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('value')
    })

    it('should generate statistics', () => {
      const stats = mockData.statistics()
      expect(stats).toHaveProperty('totalLogs')
      expect(stats).toHaveProperty('errorCount')
      expect(stats).toHaveProperty('timeRange')
    })

    it('should generate statistics with overrides', () => {
      const stats = mockData.statistics({ totalLogs: 5000 })
      expect(stats.totalLogs).toBe(5000)
    })

    it('should generate analysis result', () => {
      const result = mockData.analysisResult()
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('insights')
      expect(result.insights).toBeInstanceOf(Array)
    })
  })

  describe('testHelpers', () => {
    it('should create mock API response', async () => {
      const response = testHelpers.mockApiResponse({ data: 'test' })
      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ data: 'test' })
    })

    it('should create mock API error', async () => {
      const response = testHelpers.mockApiError('Server error', 500)
      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Server error' })
    })

    it('should wait for specified time', async () => {
      const start = Date.now()
      await testHelpers.wait(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow small margin
    })
  })
})
