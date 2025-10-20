import type { Metadata } from "next";

import { ProjectsBoard } from "./projects-board";
import { fetchProjectsWithRelations } from "@/lib/data/projects";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Projects | Place to Stand Portal",
};

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await fetchProjectsWithRelations();

  const clients = projects
    .map((project) => project.client)
    .filter((client): client is NonNullable<typeof client> => Boolean(client))
    .reduce(
      (acc, client) => {
        if (!acc.some((existing) => existing.id === client.id)) {
          acc.push({ id: client.id, name: client.name });
        }
        return acc;
      },
      [] as Array<{ id: string; name: string }>
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ProjectsBoard
      projects={projects}
      clients={clients}
      currentUserId={user.id}
      currentUserRole={user.role}
    />
  );
}
