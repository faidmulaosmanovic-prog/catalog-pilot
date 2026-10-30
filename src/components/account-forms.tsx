"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700";
const buttonClass =
  "rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950";

async function sendJson(
  url: string,
  body: unknown,
  method = "POST",
  headers?: Record<string, string>,
) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: { message?: string }; message?: string }) : {};
  return { ok: response.ok, status: response.status, data };
}

function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600">{message}</p>;
}

export function RegisterForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await sendJson("/api/v1/auth/register", {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not register");
      return;
    }
    setMessage(result.data.message ?? "If an account exists, check your email.");
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="name" placeholder="Name" required />
      <input className={fieldClass} name="email" type="email" placeholder="Email" required />
      <input className={fieldClass} name="password" type="password" placeholder="Password" required />
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account"}
      </button>
      <ErrorText message={error} />
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await sendJson("/api/v1/auth/login", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not sign in");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="email" type="email" placeholder="Email" required />
      <input className={fieldClass} name="password" type="password" placeholder="Password" required />
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <ErrorText message={error} />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await sendJson("/api/v1/auth/password-reset/request", {
      email: String(form.get("email") ?? ""),
    });
    if (!result.ok && result.status !== 202) {
      setError(result.data.error?.message ?? "Could not send reset email");
      return;
    }
    setMessage(result.data.message ?? "If an account exists, check your email.");
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="email" type="email" placeholder="Email" required />
      <button className={buttonClass} type="submit">
        Send reset link
      </button>
      <ErrorText message={error} />
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await sendJson("/api/v1/auth/password-reset/confirm", {
      token,
      password: String(form.get("password") ?? ""),
    });
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not reset password");
      return;
    }
    setMessage("Password updated. You can sign in.");
  }

  if (!token) {
    return <p className="text-sm">This reset link is missing a token.</p>;
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="password" type="password" placeholder="New password" required />
      <button className={buttonClass} type="submit">
        Update password
      </button>
      <ErrorText message={error} />
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [message, setMessage] = useState(
    token ? "Verifying your email…" : "Check your email for a verification link.",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void sendJson("/api/v1/auth/verify-email", { token }).then((result) => {
      if (!result.ok) {
        setError(result.data.error?.message ?? "Could not verify email");
        setMessage("");
        return;
      }
      setMessage("Email verified. You can sign in.");
    });
  }, [token]);

  return (
    <div className="flex flex-col gap-3">
      {message ? <p className="text-sm">{message}</p> : null}
      <ErrorText message={error} />
    </div>
  );
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await sendJson("/api/v1/organizations", {
      name: String(form.get("name") ?? ""),
      defaultCurrency: String(form.get("currency") ?? "USD").toUpperCase(),
    });
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not create organization");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="name" placeholder="Organization name" required />
      <input className={fieldClass} name="currency" defaultValue="USD" maxLength={3} />
      <button className={buttonClass} type="submit">
        Create organization
      </button>
      <ErrorText message={error} />
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className={buttonClass}
      type="button"
      onClick={() => {
        void fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" }).then(() => {
          router.push("/login");
          router.refresh();
        });
      }}
    >
      Log out
    </button>
  );
}

export function OrganizationSwitcher({
  organizations,
  activeId,
}: {
  organizations: Array<{ id: string; name: string; role: string }>;
  activeId: string;
}) {
  const router = useRouter();
  const [orgId, setOrgId] = useState(activeId);

  if (organizations.length === 0) {
    return null;
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/v1/organizations/${orgId}/activate`, {
          method: "POST",
          credentials: "include",
        }).then(() => router.refresh());
      }}
    >
      <select
        className={fieldClass}
        value={orgId}
        onChange={(event) => setOrgId(event.target.value)}
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name} ({org.role})
          </option>
        ))}
      </select>
      <button className={buttonClass} type="submit">
        Switch
      </button>
    </form>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await sendJson(
      "/api/v1/auth/me",
      { name: String(form.get("name") ?? "") },
      "PATCH",
    );
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not update profile");
      return;
    }
    setMessage("Profile saved.");
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="name" defaultValue={name} required />
      <button className={buttonClass} type="submit">
        Save profile
      </button>
      <ErrorText message={error} />
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}

export function InviteForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await sendJson(
      `/api/v1/organizations/${organizationId}/invites`,
      {
        email: String(form.get("email") ?? ""),
        role: String(form.get("role") ?? "editor"),
      },
      "POST",
      { "x-organization-id": organizationId },
    );
    if (!result.ok) {
      setError(result.data.error?.message ?? "Could not send invite");
      return;
    }
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <input className={fieldClass} name="email" type="email" placeholder="Teammate email" required />
      <select className={fieldClass} name="role" defaultValue="editor">
        <option value="admin">Admin</option>
        <option value="editor">Editor</option>
        <option value="viewer">Viewer</option>
      </select>
      <button className={buttonClass} type="submit">
        Send invite
      </button>
      <ErrorText message={error} />
    </form>
  );
}

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <button
        className={buttonClass}
        type="button"
        onClick={() => {
          void fetch(`/api/v1/invites/${token}/accept`, {
            method: "POST",
            credentials: "include",
          }).then(async (response) => {
            if (!response.ok) {
              const data = (await response.json()) as { error?: { message?: string } };
              setError(data.error?.message ?? "Could not accept invite");
              return;
            }
            router.push("/app");
            router.refresh();
          });
        }}
      >
        Accept invite
      </button>
      <ErrorText message={error} />
    </div>
  );
}
