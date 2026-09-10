# `pts` — Place to Stand admin CLI

A machine-facing view of the portal, for admins and the AI agents helping them. Reads cover
tasks, projects, clients, contacts, users, time logs and invoices; writes cover task create,
task edit and comments.

Output is JSON on **stdout** and everything else on **stderr**, so `pts … | jq` never has to
step around a status line. `--pretty` renders a table instead, for humans.

The CLI never touches the database. It talks to `/api/cli/v1/*` on the internal portal, which
is why it can reuse the portal's own permission checks rather than reimplementing them.

## Install

```sh
npm run cli:link      # from the repo root — builds, then links `pts` onto your PATH
```

The link points at `packages/cli/dist/`, so a later `npm run build -w @pts/cli` is picked up
without re-linking. You do need to rebuild after pulling changes to the CLI.

`npx pts …` also works anywhere inside the repo without linking, since npm workspaces put the
binary in the root `node_modules/.bin`.

## Sign in

```sh
pts login             # opens your browser
pts whoami
```

`login` defaults to a browser flow: it stands up a throwaway loopback server, sends you to
Google, and catches the authorization code. That's the only flow that works for admins who
sign in with Google and so have no password. The listener is bound to `127.0.0.1`, serves
only `/callback`, and is closed the moment the code arrives or five minutes pass.

For automation, where no browser can open:

```sh
PTS_EMAIL=… PTS_PASSWORD=… pts login --password
```

Passwords are read from the environment, never from argv — argv is visible to every other
user on the machine. Setting `PTS_PASSWORD` selects this flow automatically.

Only `ADMIN` users may use the CLI. A valid Supabase session for a `CLIENT` user still gets a
JSON 403 from `whoami`.

## Choosing an environment

```sh
pts --local tasks list          # http://localhost:3000
pts --prod tasks list           # production
pts --api-url https://… whoami  # anything else
pts config set-url http://localhost:3000   # persist a default
pts config show                            # what resolved, and from where
```

Precedence: `--api-url` / `--local` / `--prod`, then `PTS_API_URL`, then
`~/.pts/config.json`, then production. Credentials are keyed by portal URL in
`~/.pts/credentials.json` (mode `0600`), so local and production sessions coexist — sign in
once per environment and switch with a flag.

## Commands

```
pts login | logout | whoami | status
pts config show | set-url <url>

pts tasks list [--project <slug|uuid>] [--status <s>] [--assignee <uuid>] [--limit n]
pts tasks show <taskId>
pts tasks create --title <t> --project <slug|uuid> [--description] [--status] [--due] [--assignee …]
pts tasks edit <taskId> [--title] [--project] [--description] [--status] [--due] [--assignee …]
                        [--clear-description] [--clear-due]
pts tasks comment <taskId> --body <text|->
pts tasks comments <taskId> [--limit n]

pts updates draft --client <slug|uuid> [--items <file|->] [--subject] [--intro] [--closing] [--since]
pts updates list [--client <slug|uuid>] [--status DRAFT|SENT] [--limit n]
pts updates show <updateId>

pts projects list | show <slug|uuid>
pts clients list | pts contacts list | pts invoices list | pts users list
pts time list --project <slug|uuid>
pts schema tables | pts schema describe <table>
```

Projects take a UUID or a slug — slugs are globally unique. Assignees take a UUID or an email
address; an unmatched reference is an error rather than a silent no-op, so a typo can't
quietly unassign everyone.

`tasks comment` and the `--description` flags take plain text or minimal markdown — paragraphs
on blank lines, `- ` bullets, `1. ` numbered lists, `**bold**`, `*italic*`, `` `code` ``, and
`[text](https://…)` links — and store the HTML the portal's editor would have produced. Raw HTML
tags in the text are escaped, not rendered. Both `--body -` and `--description -` read from
stdin, so multi-paragraph text can come from a heredoc instead of one long shell argument.

`updates draft` creates a client status email as a draft in the portal and prints the URL where
you review recipients, edit, and send it from your own Gmail. The CLI never sends. Pass `--items`
with what you did — a JSON array of `{ taskId?, label, body? }`, body in minimal markdown (bold,
italic, links, line breaks) — because the session that did the work is the only thing that knows
what to tell the client. Each item with a `taskId` links to that task in the client portal. The
greeting, hours balance, and branded footer are added by the portal. Without `--items` the draft
is scaffolded with one empty item per task that moved since the last sent update (or `--since`).

```json
[
  { "taskId": "8b515d81-…", "label": "Site speed",
    "body": "The homepage loads noticeably faster. **Note:** some images still need alt text, which you can add under Content > Files." },
  { "label": "Product title", "body": "We also removed a duplicate title above product photos." }
]
```

`tasks show`, `tasks create` and `tasks edit` print the task's portal URL on stderr (`View: …`),
built from the `path` field in the response the same way `updates draft` does — so the link you
hand someone is the one the board actually uses, not a guess.

`tasks edit` is a genuine partial update: fields you omit keep their current values, and
`--clear-description` / `--clear-due` are how you blank one. This matters because the
underlying save is a full replace.

## Notes for agents

`pts schema tables` and `pts schema describe <table>` are the fastest way to orient yourself —
they're derived statically from the Drizzle schema, so they never drift from the code.

Every response is `{ ok, data }` with camelCase fields, defined by the serializers in
`apps/internal/lib/cli/serializers/`. Those are the contract: fields get added, not renamed.

A write that partially fails returns 2xx with a warning on stderr rather than a 4xx, whenever
the task row was created. Do not retry on a warning — you will duplicate the task.
