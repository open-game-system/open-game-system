import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  LayoutAnimation,
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import {
  type ContentFrame,
  contentTop,
  keyboardOverlap,
  revealOffset,
  revealSpan,
  settleDelay,
} from "./keyboard";

/** Anything measureInWindow works on: a host view or a text input. */
interface Measurable {
  measureInWindow(cb: (x: number, y: number, width: number, height: number) => void): void;
}

/** A view that comes into view with the focused field (the field under it). */
type Also = RefObject<View | null>;
type Reveal = (also?: Also) => void;

const RevealContext = createContext<Reveal>(() => {});

/**
 * For a field's onFocus: inside a KeyboardFooterScroll, scrolls the focused field into view (focus
 * moved by a return key brings no keyboard event to do it). Elsewhere it does nothing. `also`: a
 * view that must show with it (the @id under the name), kept for the keyboard's own reveal too.
 */
export function useRevealFocused(): Reveal {
  return useContext(RevealContext);
}

/** Room kept around a field scrolled into view above the footer. */
const MARGIN = 16;

/**
 * A scrolling page with a footer (its main action: Next, Save) that stays on screen above the
 * keyboard. While the keyboard is up the page shrinks by exactly the part the keyboard covers
 * (measured in the window, so it is right on an onboarding page or in a modal sheet too), the
 * footer sits on the keyboard, and the focused field is scrolled into the space above the footer.
 */
export function KeyboardFooterScroll({
  footer,
  children,
  contentContainerStyle,
  footerStyle,
  restingBottom = 0,
  sheetHeight,
  testID,
}: {
  footer: ReactNode;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  /** Room under the footer while the keyboard is down (the home indicator in a sheet). */
  restingBottom?: number;
  /** The height of the modal sheet this page fills (React Native measures from the sheet's top). */
  sheetHeight?: number;
  testID?: string;
}) {
  const root = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef({ offset: 0, height: 0 });
  const [inset, setInset] = useState(0);
  const sheet = useRef(sheetHeight);
  sheet.current = sheetHeight;

  // The view that comes with the focused field, for as long as that field has the focus.
  const companion = useRef<{ field: unknown; also: Also } | null>(null);

  // Scroll the focused field (and its companion) into the space above the footer and the keyboard.
  // Positions come from the window (measureInWindow is native, so it sees the scroll): a field's
  // place in the content is its window y below the page's top, plus how far the page has scrolled.
  const reveal = useRef((also?: Also) => {
    const field = TextInput.State.currentlyFocusedInput();
    const page = root.current;
    if (!field || !page) return;
    if (also) companion.current = { field, also };
    const withIt = companion.current?.field === field ? companion.current.also.current : null;
    const show = (span: ContentFrame) => {
      const y = revealOffset(span, viewport.current, MARGIN);
      if (y !== null) scroll.current?.scrollTo({ y, animated: true });
    };
    const inWindow = (view: Measurable) =>
      new Promise<{ y: number; height: number }>((resolve) =>
        view.measureInWindow((_x, y, _w, height) => resolve({ y, height })),
      );
    // Only a field on this page: measuring it against the page fails for a field elsewhere.
    field.measureLayout(
      page,
      () => {
        void Promise.all([
          inWindow(page),
          inWindow(field),
          withIt ? inWindow(withIt) : Promise.resolve(null),
        ]).then(([top, f, a]) => {
          const at = (v: { y: number; height: number }) => ({
            top: contentTop(v.y, top.y, viewport.current.offset),
            height: v.height,
          });
          show(revealSpan(at(f), a ? at(a) : null));
        });
      },
      () => {},
    );
  }).current;

  // When the page's resize animation ends: a scroll before then is clamped to the taller page.
  const settleAt = useRef(0);
  const revealSettled = useRef(() => {
    const wait = settleDelay(settleAt.current, Date.now());
    if (wait > 0) setTimeout(() => reveal(), wait);
    else reveal();
  }).current;

  // The keyboard is an external system: follow its frame while this page is mounted.
  useEffect(() => {
    const animate = (e: KeyboardEvent) => {
      if (!e.duration) return;
      const duration = Math.max(e.duration, 10);
      settleAt.current = Date.now() + duration;
      LayoutAnimation.configureNext({
        duration,
        update: { duration, type: LayoutAnimation.Types[e.easing] ?? "keyboard" },
      });
    };
    const follow = (e: KeyboardEvent) => {
      root.current?.measureInWindow((_x, y, _width, height) => {
        const container = sheet.current;
        const next = keyboardOverlap(
          { y, height },
          e.endCoordinates.screenY,
          container ? { container, window: Dimensions.get("window").height } : undefined,
        );
        setInset((was) => {
          if (was !== next) animate(e);
          return next;
        });
      });
    };
    const subs =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillChangeFrame", follow),
            Keyboard.addListener("keyboardDidShow", revealSettled),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", (e) => {
              follow(e);
              revealSettled();
            }),
            Keyboard.addListener("keyboardDidHide", () => setInset(0)),
          ];
    return () => {
      for (const s of subs) s.remove();
    };
  }, [revealSettled]);

  return (
    <RevealContext.Provider value={reveal}>
      <View ref={root} style={[styles.root, { paddingBottom: Math.max(inset, restingBottom) }]}>
        <ScrollView
          ref={scroll}
          style={styles.scroll}
          contentContainerStyle={contentContainerStyle}
          // A tap on a button with the keyboard up presses it (not just closes the keyboard).
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => {
            const was = viewport.current.height;
            viewport.current.height = e.nativeEvent.layout.height;
            // The keyboard came up and the page shrank (this can land after keyboardDidShow): reveal
            // the focused field in the space it has now.
            if (viewport.current.height < was) revealSettled();
          }}
          onScroll={(e) => {
            viewport.current.offset = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          testID={testID}
        >
          {children}
        </ScrollView>
        <View style={footerStyle}>{footer}</View>
      </View>
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
});
