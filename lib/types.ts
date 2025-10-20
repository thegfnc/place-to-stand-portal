import type { Database } from "@/supabase/types/database";

export type DbClient = Database["public"]["Tables"]["clients"]["Row"];
export type DbProject = Database["public"]["Tables"]["projects"]["Row"];
export type DbTask = Database["public"]["Tables"]["tasks"]["Row"];
export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbProjectMember = Database["public"]["Tables"]["project_members"]["Row"];
export type DbHourBlock = Database["public"]["Tables"]["hour_blocks"]["Row"];

export type ProjectMemberWithUser = DbProjectMember & {
  user: DbUser;
};

export type TaskWithRelations = DbTask & {
  assignees: { user_id: string }[];
};

export type ProjectWithRelations = DbProject & {
  client: DbClient | null;
  members: ProjectMemberWithUser[];
  tasks: TaskWithRelations[];
  hour_blocks: DbHourBlock[];
};
