import React from 'react'

interface MockFixedSizeListProps {
  itemCount: number
  itemSize: number
  height: number
  width: number
  children: React.ComponentType<{ index: number; style: React.CSSProperties }>
}

export const FixedSizeList = React.forwardRef<any, MockFixedSizeListProps>(
  ({ itemCount, itemSize, children: RowComponent, ...props }, ref) => (
    <div ref={ref} data-testid="fixed-size-list" {...props}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} style={{ position: 'absolute', top: index * (itemSize || 40) }}>
          <RowComponent index={index} style={{ position: 'absolute', top: index * (itemSize || 40) }} />
        </div>
      ))}
    </div>
  ),
)
FixedSizeList.displayName = 'FixedSizeList'

interface MockVariableSizeListProps {
  itemCount: number
  height: number
  width: number
  children: React.ComponentType<{ index: number; style: React.CSSProperties }>
}

export const VariableSizeList = React.forwardRef<any, MockVariableSizeListProps>(
  ({ itemCount, children: RowComponent, ...props }, ref) => (
    <div ref={ref} data-testid="variable-size-list" {...props}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} style={{ position: 'absolute', top: index * 40 }}>
          <RowComponent index={index} style={{ position: 'absolute', top: index * 40 }} />
        </div>
      ))}
    </div>
  ),
)
VariableSizeList.displayName = 'VariableSizeList'

// react-window also exports List as an alias for FixedSizeList in some configurations.
// Components that use `import * as ReactWindow` and then `ReactWindow.List` need this.
export const List = React.forwardRef<any, any>(
  ({ itemCount, itemSize, itemData, children: RowComponent, ...props }, ref) => (
    <div ref={ref} data-testid="virtual-list" {...props}>
      {Array.from({ length: Math.min(itemCount, 50) }).map((_, index) => (
        <div key={index} style={{ position: 'absolute', top: index * (itemSize || 40) }}>
          <RowComponent index={index} style={{ position: 'absolute', top: index * (itemSize || 40) }} data={itemData} />
        </div>
      ))}
    </div>
  ),
)
List.displayName = 'List'
