import { useCallback, useEffect, useRef, useState } from "react";

export interface UseScrollStateOptions {
  /** Total number of items in the scrollable list. */
  totalItems: number;
  /** Number of items that fit in the visible viewport. */
  viewportItems: number;
}

export interface ScrollState {
  /** Items hidden from the bottom. 0 = at the bottom (follow tail). */
  offset: number;
  /** Largest value `offset` can take (= totalItems − viewportItems, ≥ 0). */
  maxOffset: number;
  /** True when offset is 0 (auto-follow new content). */
  following: boolean;
  /** True when new content appeared below the user's current scroll position. */
  hasNewBelow: boolean;
  setOffset: (n: number) => void;
  scrollUpBy: (n: number) => void;
  scrollDownBy: (n: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

/**
 * Tracks a vertical scroll offset for a virtual list.
 *
 * - `offset = 0` means the user is at the bottom (auto-follow / "follow tail").
 * - `offset > 0` means the user has scrolled up; new content is appended at the
 *   bottom without disturbing their position. `hasNewBelow` is set so the UI
 *   can prompt them to jump to the tail.
 */
export const useScrollState = ({ totalItems, viewportItems }: UseScrollStateOptions): ScrollState => {
  const maxOffset = Math.max(0, totalItems - viewportItems);
  const [offset, setOffsetRaw] = useState(0);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  // Refs to read latest values inside async effects/callbacks.
  const offsetRef = useRef(offset);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const lastTotalRef = useRef(totalItems);
  useEffect(() => {
    const prev = lastTotalRef.current;
    if (totalItems > prev) {
      // Items appended at the bottom. If the user is scrolled up, hold their
      // position but flag that new content is available below.
      if (offsetRef.current > 0) {
        setHasNewBelow(true);
      }
    } else if (totalItems < prev) {
      // Items removed (clear, /resume, etc.): drop the flag.
      setHasNewBelow(false);
    }
    lastTotalRef.current = totalItems;
  }, [totalItems]);

  const setOffset = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(maxOffset, next));
      setOffsetRaw(clamped);
      // Reaching the bottom re-engages auto-follow and clears the flag.
      if (clamped === 0) {
        setHasNewBelow(false);
      }
    },
    [maxOffset],
  );

  const scrollUpBy = useCallback((n: number) => setOffset(offsetRef.current + Math.max(1, n)), [setOffset]);
  const scrollDownBy = useCallback((n: number) => setOffset(offsetRef.current - Math.max(1, n)), [setOffset]);
  const scrollToTop = useCallback(() => setOffset(maxOffset), [maxOffset, setOffset]);
  const scrollToBottom = useCallback(() => setOffset(0), [setOffset]);

  return {
    offset,
    maxOffset,
    following: offset === 0,
    hasNewBelow,
    setOffset,
    scrollUpBy,
    scrollDownBy,
    scrollToTop,
    scrollToBottom,
  };
};
