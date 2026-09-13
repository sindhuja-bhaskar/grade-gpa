"use client";

import { useActionState } from "react";
import { DeleteButton, FormMessage } from "@/components/ui";
import { IDLE, type FormState } from "@/lib/actions/form-state";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Delete, behind a confirmation that spells out what else goes with it (§30.4). */
export function DeleteForm({
  action,
  confirm,
  label,
}: {
  action: Action;
  confirm: string;
  label?: string;
}) {
  const [state, submit] = useActionState(action, IDLE);

  return (
    <form action={submit} className="inline-flex items-center gap-3">
      <DeleteButton confirm={confirm}>{label ?? "Delete"}</DeleteButton>
      <FormMessage state={state} />
    </form>
  );
}
