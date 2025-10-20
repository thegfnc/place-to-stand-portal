import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-background p-10 text-center shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this page. If you believe this is an
          error, reach out to an administrator.
        </p>
        <Link className="text-sm font-medium text-primary underline" href="/">
          Go back to dashboard
        </Link>
      </div>
    </div>
  );
}
