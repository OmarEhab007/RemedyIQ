// Override react-window types to match v1 API used in this project.
// The workspace has v2 at root but v1 in frontend/node_modules.
declare module "react-window" {
  import { Component, CSSProperties, ReactNode, Ref } from "react";

  export interface ListChildComponentProps<T = any> {
    index: number;
    style: CSSProperties;
    data: T;
    isScrolling?: boolean;
  }

  export interface FixedSizeListProps<T = any> {
    children: React.ComponentType<ListChildComponentProps<T>>;
    height: number;
    itemCount: number;
    itemSize: number;
    width: number | string;
    itemData?: T;
    overscanCount?: number;
    className?: string;
    style?: CSSProperties;
    ref?: Ref<any>;
  }

  export class FixedSizeList<T = any> extends Component<FixedSizeListProps<T>> {
    scrollTo(scrollOffset: number): void;
    scrollToItem(index: number, align?: string): void;
  }

  export interface VariableSizeListProps<T = any> {
    children: React.ComponentType<ListChildComponentProps<T>>;
    height: number;
    itemCount: number;
    itemSize: (index: number) => number;
    width: number | string;
    itemData?: T;
    overscanCount?: number;
    className?: string;
    style?: CSSProperties;
    ref?: Ref<any>;
  }

  export class VariableSizeList<T = any> extends Component<VariableSizeListProps<T>> {
    scrollTo(scrollOffset: number): void;
    scrollToItem(index: number, align?: string): void;
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
  }
}
