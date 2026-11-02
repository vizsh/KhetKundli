"use client";

/**
 * Calls to KhetKundli's own API from a screen. Each surface (the farmer's phone, the officer's desk)
 * has its own session, so every call says which surface it comes from; the event stream carries it
 * as a query parameter because EventSource cannot set headers.
 */
export type Surface = "phone" | "desk";

export const surface = (): Surface =>
  typeof location !== "undefined" && location.pathname.startsWith("/farmer") ? "phone" : "desk";

export function api(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("X-KK-Surface", surface());
  return fetch(input, { ...init, headers });
}

export const streamUrl = (path: string) => `${path}${path.includes("?") ? "&" : "?"}surface=${surface()}`;
