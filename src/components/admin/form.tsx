"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import type { FormState } from "@/app/admin/actions";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {label}
    </button>
  );
}

/**
 * Form wired to a server action, with inline error and success messages.
 */
export function AdminForm({ action, submitLabel, children, className = "", footer }: Props) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p className="pixel-clip mt-5 flex items-center gap-2 bg-danger/15 px-4 py-3 text-sm text-danger [--step:3px]">
          <TriangleAlert className="size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="pixel-clip mt-5 flex items-center gap-2 bg-accent/10 px-4 py-3 text-sm text-accent [--step:3px]">
          <CheckCircle2 className="size-4 shrink-0" /> {state.ok}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Submit label={submitLabel} />
        {footer}
      </div>
    </form>
  );
}

/**
 * Submit button that asks before doing something you can't undo.
 */
export function ConfirmButton({ message, children, className = "btn btn-ghost btn-sm" }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
