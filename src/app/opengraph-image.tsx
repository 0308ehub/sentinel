import { ImageResponse } from "next/og";

export const alt = "Kismet, the product platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f7f4",
          color: "#141414",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: "-0.04em" }}>Kismet</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 68, lineHeight: 1.05, letterSpacing: "-0.04em", maxWidth: 900 }}>
            The modern product platform
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 28, color: "#3c4250" }}>
            Decide what to build next.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
