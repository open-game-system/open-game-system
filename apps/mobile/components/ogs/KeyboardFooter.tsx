import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
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
import { keyboardOverlap, revealOffset } from "./keyboard";

const RevealContext = createContext<() => void>(() => {});

/**
 * For a field's onFocus: inside a KeyboardFooterScroll, scrolls the focused field into view (focus
 * moved by a return key brings no keyboard event to do it). Elsewhere it does nothing.
 */
export function useRevealFocused(): () => void {
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

  // Scroll the focused field into the space above the footer (and the keyboard).
  const reveal = useRef(() => {
    const field = TextInput.State.currentlyFocusedInput();
    const content = scroll.current?.getInnerViewNode();
    if (!field || !content) return;
    field.measureLayout(
      content,
      (_x, top, _width, height) => {
        const y = revealOffset({ top, height }, viewport.current, MARGIN);
        if (y !== null) scroll.current?.scrollTo({ y, animated: true });
      },
      // A focused field outside this page: nothing to reveal.
      () => {},
    );
  }).current;

  // The keyboard is an external system: follow its frame while this page is mounted.
  useEffect(() => {
    const animate = (e: KeyboardEvent) => {
      if (!e.duration) return;
      const duration = Math.max(e.duration, 10);
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
            Keyboard.addListener("keyboardDidShow", reveal),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", (e) => {
              follow(e);
              reveal();
            }),
            Keyboard.addListener("keyboardDidHide", () => setInset(0)),
          ];
    return () => {
      for (const s of subs) s.remove();
    };
  }, [reveal]);

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
            viewport.current.height = e.nativeEvent.layout.height;
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
