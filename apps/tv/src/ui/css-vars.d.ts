import "react";

declare module "react" {
  /** Custom properties the launcher's styles read (row and shelf scroll positions). */
  interface CSSProperties {
    "--row"?: number;
    "--shift"?: number;
  }
}
