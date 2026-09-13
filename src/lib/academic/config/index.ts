export * from "./schemes";
export * from "./grades";
export * from "./performance";

/** Supported GPA/CGPA range (§37). */
export const GPA_RANGE = { min: 0, max: 10 } as const;
