import { describe, expect, it } from "vitest";
import {
  googleMapsSearchUrl,
  isMapsShortLink,
  isResolvableMapsHost,
  parseCoords,
  parseCoordsFromMapsHtml,
} from "./maps-link";

describe("parseCoords", () => {
  it("reads plain coordinates", () => {
    expect(parseCoords("39.5966, -105.7106")).toEqual({
      lat: 39.5966,
      lng: -105.7106,
    });
    expect(parseCoords("39.5966,-105.7106")).toEqual({
      lat: 39.5966,
      lng: -105.7106,
    });
  });

  it("prefers the place pin over the viewport center in Google place URLs", () => {
    const url =
      "https://www.google.com/maps/place/Mount+Bierstadt+Trailhead/@39.59,-105.72,14z/data=!4m6!3m5!1s0x0:0x0!8m2!3d39.5966!4d-105.7106!16s";
    expect(parseCoords(url)).toEqual({ lat: 39.5966, lng: -105.7106 });
  });

  it("falls back to the @lat,lng viewport", () => {
    expect(
      parseCoords("https://www.google.com/maps/@39.6364,-105.2094,15z"),
    ).toEqual({
      lat: 39.6364,
      lng: -105.2094,
    });
  });

  it("reads query-style links (Google ?q=, Apple ll=, encoded commas)", () => {
    expect(parseCoords("https://maps.google.com/?q=39.7555,-105.2211")).toEqual(
      {
        lat: 39.7555,
        lng: -105.2211,
      },
    );
    expect(
      parseCoords("https://maps.apple.com/?ll=39.7555,-105.2211&q=Golden"),
    ).toEqual({
      lat: 39.7555,
      lng: -105.2211,
    });
    expect(
      parseCoords(
        "https://www.google.com/maps/search/?api=1&query=39.7555%2C-105.2211",
      ),
    ).toEqual({ lat: 39.7555, lng: -105.2211 });
  });

  it("rejects short links, text without coordinates, and out-of-range values", () => {
    expect(parseCoords("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(parseCoords("Mount Bierstadt")).toBeNull();
    expect(parseCoords("91.0, 10.0")).toBeNull();
    expect(parseCoords("0, 0")).toBeNull();
  });
});

describe("share links", () => {
  it("detects Google short links", () => {
    expect(isMapsShortLink("https://maps.app.goo.gl/AbCdEf123")).toBe(true);
    expect(isMapsShortLink("  https://goo.gl/maps/xyz ")).toBe(true);
    expect(isMapsShortLink("http://maps.app.goo.gl/x")).toBe(false);
    expect(isMapsShortLink("https://example.com/x")).toBe(false);
    expect(isMapsShortLink("39.5, -105.7")).toBe(false);
  });

  it("only allows Google hosts while resolving", () => {
    expect(isResolvableMapsHost("maps.app.goo.gl")).toBe(true);
    expect(isResolvableMapsHost("www.google.com")).toBe(true);
    expect(isResolvableMapsHost("maps.google.co.uk")).toBe(true);
    expect(isResolvableMapsHost("google.com.evil.example")).toBe(false);
    expect(isResolvableMapsHost("169.254.169.254")).toBe(false);
    expect(isResolvableMapsHost("localhost")).toBe(false);
  });

  it("finds the center in a Google Maps page's preview image URL", () => {
    const html =
      '<meta content="https://maps.google.com/maps/api/staticmap?center=39.5966%2C-105.7106&amp;zoom=15" property="og:image">';
    expect(parseCoordsFromMapsHtml(html)).toEqual({
      lat: 39.5966,
      lng: -105.7106,
    });
    expect(parseCoordsFromMapsHtml("<html>nothing here</html>")).toBeNull();
  });

  it("builds a Google Maps search URL", () => {
    expect(googleMapsSearchUrl("Mount Bierstadt Trailhead")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Mount%20Bierstadt%20Trailhead",
    );
  });
});
