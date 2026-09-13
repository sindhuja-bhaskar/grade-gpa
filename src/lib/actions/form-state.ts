/**
 * Shape of a Server Action's result, shared by the actions and the forms that
 * render them. Kept free of imports so client components can use it without
 * pulling server code into the browser bundle.
 */

export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field name → message, for rendering errors next to their input (§37). */
  issues?: Record<string, string>;
}

export const IDLE: FormState = { status: "idle" };
