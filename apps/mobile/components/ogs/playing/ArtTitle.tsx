import type { Manifest } from "@open-game-system/ogs-protocol";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { artKit } from "../library/art-kit";
import { GameLogo, KeyArt } from "../library/KeyArt";

/**
 * A game's key art at `width` × 16:9 with its logo in the free left third (the art kit's clean
 * hero), else the capture with the logo (or name) low on a short scrim. Same treatment as the
 * Library hero, so a game looks the same everywhere.
 */
export function ArtTitle({
  game,
  width,
  radius = 0,
  aspect = 16 / 9,
  fadeTo,
  children,
}: {
  game: Manifest;
  width: number;
  radius?: number;
  /** Width ÷ height; wider than 16:9 trims the clean hero's empty logo third first. */
  aspect?: number;
  /** Fade the foot of the art into this colour (the card it sits on). */
  fadeTo?: string;
  /** Overlaid at the top left (a status tag). */
  children?: ReactNode;
}) {
  const height = Math.round(width / aspect);
  const kit = artKit(game);
  const clean = kit.heroClean !== null;
  return (
    <View style={{ width, height, borderRadius: radius, overflow: "hidden" }}>
      <KeyArt game={game} width={width} height={height} radius={radius} />
      <LinearGradient
        colors={
          clean
            ? ["rgba(18,15,34,0.45)", "rgba(18,15,34,0)"]
            : ["rgba(18,15,34,0)", "rgba(18,15,34,0.85)"]
        }
        start={clean ? { x: 0, y: 0.5 } : { x: 0.5, y: 0.4 }}
        end={clean ? { x: 0.55, y: 0.5 } : { x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {fadeTo ? (
        <LinearGradient colors={["transparent", fadeTo]} style={styles.fade} pointerEvents="none" />
      ) : null}
      {kit.logo ? (
        // Only a real logo goes on the art; the name is set in the card, never over baked-in text.
        <View
          style={[styles.caption, clean ? styles.captionClean : styles.captionLow]}
          pointerEvents="none"
        >
          <GameLogo
            game={game}
            width={clean ? width * 0.42 : width * 0.55}
            height={clean ? height * 0.6 : height * 0.36}
          />
        </View>
      ) : null}
      {children ? <View style={styles.tag}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { position: "absolute", left: 14 },
  captionClean: { top: 0, bottom: 0, justifyContent: "center" },
  captionLow: { bottom: 10, right: 14 },
  tag: { position: "absolute", top: 12, left: 12 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "28%" },
});
