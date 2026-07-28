import { ImageResponse } from "next/og";
import React from "react";

export const alt = "Ritumbhara — India, Thoughtfully Hosted";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
    return new ImageResponse(
          React.createElement(
                  "div",
            {
                      style: {
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-start",
                                  justifyContent: "center",
                                  background: "#97183C",
                                  padding: "90px",
                                  fontFamily: "sans-serif",
                      },
            },
                  React.createElement(
                            "div",
                    { style: { fontSize: 26, letterSpacing: 6, textTransform: "uppercase", color: "#C8A96A", marginBottom: 28, display: "flex" } },
                            "India, Thoughtfully Hosted"
                          ),
                  React.createElement(
                            "div",
                    { style: { fontSize: 96, fontWeight: 700, color: "white", display: "flex" } },
                            "Ritumbhara"
                          ),
                  React.createElement(
                            "div",
                    { style: { fontSize: 32, marginTop: 36, color: "rgba(255,255,255,0.82)", maxWidth: 820, display: "flex" } },
                            "Hotels, villas, serviced apartments and boutique stays across India."
                          )
                ),
          size
        );
}
