"use client";
import { useState, type ImgHTMLAttributes } from "react";

export function SafeImage({
  src,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSource, setFailedSource] = useState<string | undefined>();
  return (
    <img
      {...props}
      alt={alt ?? ""}
      src={
        !src || failedSource === src ? "/images/fruit-farmer-thumb.jpg" : src
      }
      loading={props.loading ?? "lazy"}
      onError={() => setFailedSource(typeof src === "string" ? src : undefined)}
    />
  );
}
