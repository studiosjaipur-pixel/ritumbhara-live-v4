import { ImageResponse } from "next/og";
import React from "react";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
          React.createElement(
                  "div",
            {
                      style: {
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: "#97183C",
                                  color: "white",
                                  fontSize: 38,
                                  fontWeight: 700,
                                  fontFamily: "sans-serif",
                      },
            },
                  "R"
                ),
          size
        );
}
