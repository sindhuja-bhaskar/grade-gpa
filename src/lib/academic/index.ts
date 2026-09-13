/**
 * The calculation engine (docs/reqs.md §36).
 *
 * Pipeline, in the order the SRS defines it:
 *   assessment → progress → future-mark requirement → grade → GPA → CGPA
 *   → classification → recommendation
 *
 * Every module here is pure: no React, no request handling, no database. Route
 * handlers call in; nothing calls out.
 */

export * from "./types";
export * from "./decimal";
export * from "./config";
export * from "./assessment";
export * from "./grade";
export * from "./gpa";
export * from "./planning";
export * from "./classify";
export * from "./recommend";
export * from "./prioritize";
export * from "./history";
