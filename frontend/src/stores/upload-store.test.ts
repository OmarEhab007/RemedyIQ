import { describe, it, expect, beforeEach } from 'vitest'
import { useUploadStore } from './upload-store'

// Reset the store before each test to avoid cross-test state contamination.
beforeEach(() => {
  useUploadStore.getState().clearUploads()
})

describe('useUploadStore — initial state', () => {
  it('has an empty activeUploads Map', () => {
    expect(useUploadStore.getState().activeUploads).toBeInstanceOf(Map)
    expect(useUploadStore.getState().activeUploads.size).toBe(0)
  })
})

describe('useUploadStore — addUpload', () => {
  it('creates a new entry with progress=0 and uploaded=false', () => {
    useUploadStore.getState().addUpload('file-001', 'report.log')

    const entry = useUploadStore.getState().activeUploads.get('file-001')
    expect(entry).toBeDefined()
    expect(entry!.fileId).toBe('file-001')
    expect(entry!.fileName).toBe('report.log')
    expect(entry!.progress).toBe(0)
    expect(entry!.uploaded).toBe(false)
  })

  it('adds multiple uploads independently', () => {
    useUploadStore.getState().addUpload('file-a', 'alpha.log')
    useUploadStore.getState().addUpload('file-b', 'beta.log')
    useUploadStore.getState().addUpload('file-c', 'gamma.log')

    const { activeUploads } = useUploadStore.getState()
    expect(activeUploads.size).toBe(3)
    expect(activeUploads.get('file-a')!.fileName).toBe('alpha.log')
    expect(activeUploads.get('file-b')!.fileName).toBe('beta.log')
    expect(activeUploads.get('file-c')!.fileName).toBe('gamma.log')
  })

  it('overwrites an existing entry when the same fileId is added again', () => {
    useUploadStore.getState().addUpload('file-001', 'original.log')
    useUploadStore.getState().updateProgress('file-001', 50)

    // Re-add with the same id but a different name
    useUploadStore.getState().addUpload('file-001', 'replacement.log')

    const entry = useUploadStore.getState().activeUploads.get('file-001')
    expect(entry!.fileName).toBe('replacement.log')
    expect(entry!.progress).toBe(0)
    expect(entry!.uploaded).toBe(false)
  })

  it('preserves existing entries when adding a new one', () => {
    useUploadStore.getState().addUpload('file-x', 'x.log')
    useUploadStore.getState().addUpload('file-y', 'y.log')

    expect(useUploadStore.getState().activeUploads.size).toBe(2)
    expect(useUploadStore.getState().activeUploads.has('file-x')).toBe(true)
    expect(useUploadStore.getState().activeUploads.has('file-y')).toBe(true)
  })
})

describe('useUploadStore — updateProgress', () => {
  beforeEach(() => {
    useUploadStore.getState().addUpload('file-001', 'report.log')
  })

  it('sets progress to the provided value', () => {
    useUploadStore.getState().updateProgress('file-001', 42)
    expect(useUploadStore.getState().activeUploads.get('file-001')!.progress).toBe(42)
  })

  it('clamps progress to 0 when given a negative value', () => {
    useUploadStore.getState().updateProgress('file-001', -10)
    expect(useUploadStore.getState().activeUploads.get('file-001')!.progress).toBe(0)
  })

  it('clamps progress to 100 when given a value above 100', () => {
    useUploadStore.getState().updateProgress('file-001', 150)
    expect(useUploadStore.getState().activeUploads.get('file-001')!.progress).toBe(100)
  })

  it('accepts exactly 0', () => {
    useUploadStore.getState().updateProgress('file-001', 0)
    expect(useUploadStore.getState().activeUploads.get('file-001')!.progress).toBe(0)
  })

  it('accepts exactly 100', () => {
    useUploadStore.getState().updateProgress('file-001', 100)
    expect(useUploadStore.getState().activeUploads.get('file-001')!.progress).toBe(100)
  })

  it('accepts a fractional value within range', () => {
    useUploadStore.getState().updateProgress('file-001', 33.5)
    expect(useUploadStore.getState().activeUploads.get('file-001')!.progress).toBe(33.5)
  })

  it('is a no-op for a non-existent fileId', () => {
    const sizeBefore = useUploadStore.getState().activeUploads.size
    useUploadStore.getState().updateProgress('does-not-exist', 75)

    // Map size unchanged and the missing entry is still absent
    expect(useUploadStore.getState().activeUploads.size).toBe(sizeBefore)
    expect(useUploadStore.getState().activeUploads.has('does-not-exist')).toBe(false)
  })

  it('does not modify other uploads when updating one', () => {
    useUploadStore.getState().addUpload('file-002', 'other.log')
    useUploadStore.getState().updateProgress('file-001', 60)

    expect(useUploadStore.getState().activeUploads.get('file-002')!.progress).toBe(0)
  })

  it('preserves other entry fields (fileName, uploaded) when updating progress', () => {
    useUploadStore.getState().updateProgress('file-001', 55)
    const entry = useUploadStore.getState().activeUploads.get('file-001')!
    expect(entry.fileName).toBe('report.log')
    expect(entry.uploaded).toBe(false)
  })
})

describe('useUploadStore — markUploaded', () => {
  beforeEach(() => {
    useUploadStore.getState().addUpload('file-001', 'report.log')
  })

  it('sets progress to 100 and uploaded to true', () => {
    useUploadStore.getState().markUploaded('file-001')
    const entry = useUploadStore.getState().activeUploads.get('file-001')!
    expect(entry.progress).toBe(100)
    expect(entry.uploaded).toBe(true)
  })

  it('preserves fileName after marking uploaded', () => {
    useUploadStore.getState().markUploaded('file-001')
    expect(useUploadStore.getState().activeUploads.get('file-001')!.fileName).toBe('report.log')
  })

  it('preserves fileId after marking uploaded', () => {
    useUploadStore.getState().markUploaded('file-001')
    expect(useUploadStore.getState().activeUploads.get('file-001')!.fileId).toBe('file-001')
  })

  it('is a no-op for a non-existent fileId', () => {
    const sizeBefore = useUploadStore.getState().activeUploads.size
    useUploadStore.getState().markUploaded('does-not-exist')
    expect(useUploadStore.getState().activeUploads.size).toBe(sizeBefore)
  })

  it('does not affect other uploads', () => {
    useUploadStore.getState().addUpload('file-002', 'other.log')
    useUploadStore.getState().markUploaded('file-001')

    const other = useUploadStore.getState().activeUploads.get('file-002')!
    expect(other.progress).toBe(0)
    expect(other.uploaded).toBe(false)
  })

  it('is idempotent when called multiple times', () => {
    useUploadStore.getState().markUploaded('file-001')
    useUploadStore.getState().markUploaded('file-001')
    const entry = useUploadStore.getState().activeUploads.get('file-001')!
    expect(entry.progress).toBe(100)
    expect(entry.uploaded).toBe(true)
  })
})

describe('useUploadStore — removeUpload', () => {
  beforeEach(() => {
    useUploadStore.getState().addUpload('file-001', 'report.log')
    useUploadStore.getState().addUpload('file-002', 'other.log')
  })

  it('removes the entry with the given fileId', () => {
    useUploadStore.getState().removeUpload('file-001')
    expect(useUploadStore.getState().activeUploads.has('file-001')).toBe(false)
  })

  it('decreases the map size by one', () => {
    expect(useUploadStore.getState().activeUploads.size).toBe(2)
    useUploadStore.getState().removeUpload('file-001')
    expect(useUploadStore.getState().activeUploads.size).toBe(1)
  })

  it('leaves other entries intact', () => {
    useUploadStore.getState().removeUpload('file-001')
    expect(useUploadStore.getState().activeUploads.has('file-002')).toBe(true)
    expect(useUploadStore.getState().activeUploads.get('file-002')!.fileName).toBe('other.log')
  })

  it('is a no-op for a non-existent fileId', () => {
    useUploadStore.getState().removeUpload('does-not-exist')
    expect(useUploadStore.getState().activeUploads.size).toBe(2)
  })

  it('can remove all entries individually', () => {
    useUploadStore.getState().removeUpload('file-001')
    useUploadStore.getState().removeUpload('file-002')
    expect(useUploadStore.getState().activeUploads.size).toBe(0)
  })
})

describe('useUploadStore — clearUploads', () => {
  it('empties the activeUploads map', () => {
    useUploadStore.getState().addUpload('file-001', 'a.log')
    useUploadStore.getState().addUpload('file-002', 'b.log')
    useUploadStore.getState().addUpload('file-003', 'c.log')

    useUploadStore.getState().clearUploads()
    expect(useUploadStore.getState().activeUploads.size).toBe(0)
  })

  it('returns an empty Map (not undefined)', () => {
    useUploadStore.getState().addUpload('file-001', 'a.log')
    useUploadStore.getState().clearUploads()

    expect(useUploadStore.getState().activeUploads).toBeInstanceOf(Map)
  })

  it('is a no-op when already empty', () => {
    useUploadStore.getState().clearUploads()
    expect(useUploadStore.getState().activeUploads.size).toBe(0)
  })

  it('allows adding new uploads after clearing', () => {
    useUploadStore.getState().addUpload('file-001', 'a.log')
    useUploadStore.getState().clearUploads()
    useUploadStore.getState().addUpload('file-002', 'b.log')

    expect(useUploadStore.getState().activeUploads.size).toBe(1)
    expect(useUploadStore.getState().activeUploads.has('file-002')).toBe(true)
  })
})
