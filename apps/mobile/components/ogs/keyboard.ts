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
