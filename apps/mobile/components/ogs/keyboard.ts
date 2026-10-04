/** A view's place in the window (points), as `measureInWindow` reports it. */
export interface WindowFrame {
  y: number;
  height: number;
}

/**
 * How many points of a view the keyboard covers. Uses the view's position in the window: React
 * Native's KeyboardAvoidingView uses its layout relative to its parent, which is wrong for any
 * view that does not start at the top of the window (an onboarding page, a modal sheet).
 * In a modal sheet React Native measures from the sheet's top, not the display's: `sheet` (the
 * screen container's height and the window's) adds the sheet's offset, as sheets sit on the bottom.
 */
export function keyboardOverlap(
  view: WindowFrame,
  keyboardTop: number,
  sheet?: { container: number; window: number },
): number {
  const sheetTop = sheet ? Math.max(0, sheet.window - sheet.container) : 0;
  return Math.max(0, sheetTop + view.y + view.height - keyboardTop);
}

/**
 * The scroll offset that shows a focused field (its top and height in the scroll content) inside
 * the visible part of a scroll view, with `margin` around it, or null when it is already in view.
 */
export function revealOffset(
  field: { top: number; height: number },
  viewport: { offset: number; height: number },
  margin: number,
): number | null {
  const fieldBottom = field.top + field.height + margin;
  const viewBottom = viewport.offset + viewport.height;
  const fieldTop = Math.max(0, field.top - margin);
  if (fieldTop >= viewport.offset && fieldBottom <= viewBottom) return null;
  // A field taller than the view (or above it) shows its top; one below it rises just enough.
  if (fieldTop < viewport.offset || field.height + 2 * margin > viewport.height) return fieldTop;
  return fieldBottom - viewport.height;
}

/** A view's place in the scroll content. */
export interface ContentFrame {
  top: number;
  height: number;
}

/**
 * The part of the scroll content to reveal for a focused field: the field itself, or the field and
 * the one that comes with it (the @id under the name, with its "free" check), whichever is first.
 */
export function revealSpan(field: ContentFrame, also: ContentFrame | null): ContentFrame {
  if (!also) return field;
  const top = Math.min(field.top, also.top);
  const bottom = Math.max(field.top + field.height, also.top + also.height);
  return { top, height: bottom - top };
}

/** One frame, after a resize animation ends, before the scroll view has its final size. */
const FRAME_MS = 16;

/**
 * How long to wait before scrolling a field into view: until the page's resize animation (ending at
 * `settleAt`) is done, plus a frame. A scroll during it is clamped to the taller page it is leaving.
 */
export function settleDelay(settleAt: number, now: number): number {
  return settleAt > now ? settleAt - now + FRAME_MS : 0;
}

/**
 * A view's top in a scroll view's content, from window positions: its window y below the scroll
 * view's top, plus how far the content is scrolled (`offset`).
 */
export function contentTop(viewWindowY: number, scrollWindowY: number, offset: number): number {
  return viewWindowY - scrollWindowY + offset;
}
