"use client";

import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-8">
      <label className="font-label text-[11px] text-muted uppercase" htmlFor="password">
        Password
      </label>
      <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className="input mt-2" />
      {state?.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary mt-6 w-full">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Sign in
      </button>
    </form>
  );
}
