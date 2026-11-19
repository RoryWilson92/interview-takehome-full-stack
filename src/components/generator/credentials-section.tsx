"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Section } from "./section";
import type { GeneratorForm } from "./use-generator-form";

export function CredentialsSection({ form }: { form: GeneratorForm }) {
  const [showPassword, setShowPassword] = useState(false);
  const userError = form.errorFor("proxy_user_id");
  const passwordError = form.errorFor("proxy_user_password");

  return (
    <Section step={1} title="Proxy user" description="The credentials every proxy in the list signs in with.">
      <Field id="proxy_user_id" label="Proxy user ID" error={userError} hint="Find it under Proxy Users in your Byteful dashboard.">
        <input
          id="proxy_user_id"
          className={inputClass(Boolean(userError))}
          value={form.values.proxy_user_id}
          onChange={(event) => form.set("proxy_user_id", event.target.value)}
          onBlur={() => form.touch("proxy_user_id")}
          aria-invalid={Boolean(userError) || undefined}
          aria-describedby={userError ? "proxy_user_id-error" : undefined}
          placeholder="e.g. 125526_SFkUC"
          autoComplete="username"
          spellCheck={false}
        />
      </Field>
      <Field id="proxy_user_password" label="Password" error={passwordError}>
        <div className="relative">
          <input
            id="proxy_user_password"
            type={showPassword ? "text" : "password"}
            className={`${inputClass(Boolean(passwordError))} pr-10`}
            value={form.values.proxy_user_password}
            onChange={(event) => form.set("proxy_user_password", event.target.value)}
            onBlur={() => form.touch("proxy_user_password")}
            aria-invalid={Boolean(passwordError) || undefined}
            aria-describedby={passwordError ? "proxy_user_password-error" : undefined}
            placeholder="Proxy user password"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1 my-auto grid size-8 place-items-center rounded-md text-fg-subtle hover:text-fg"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
    </Section>
  );
}
