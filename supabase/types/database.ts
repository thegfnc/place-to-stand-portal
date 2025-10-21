export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      hour_blocks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          block_type: Database["public"]["Enums"]["hour_block_type"];
          hours_purchased: number;
          hours_consumed: number;
          notes: string | null;
          starts_on: string | null;
          ends_on: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          block_type?: Database["public"]["Enums"]["hour_block_type"];
          hours_purchased: number;
          hours_consumed?: number;
          notes?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          block_type?: Database["public"]["Enums"]["hour_block_type"];
          hours_purchased?: number;
          hours_consumed?: number;
          notes?: string | null;
          starts_on?: string | null;
          ends_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hour_blocks_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hour_blocks_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      project_members: {
        Row: {
          id: number;
          project_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["member_role"];
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          project_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          project_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      projects: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          status: string;
          starts_on: string | null;
          ends_on: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          status?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          name?: string;
          status?: string;
          starts_on?: string | null;
          ends_on?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      task_assignees: {
        Row: {
          id: number;
          task_id: string;
          user_id: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          task_id: string;
          user_id: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          task_id?: string;
          user_id?: string;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: Database["public"]["Enums"]["task_status"];
          priority: Database["public"]["Enums"]["task_priority"];
          due_on: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          priority?: Database["public"]["Enums"]["task_priority"];
          due_on?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          priority?: Database["public"]["Enums"]["task_priority"];
          due_on?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_updated_by_fkey";
            columns: ["updated_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: Database["public"]["Enums"]["user_role"];
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      current_user_with_role: {
        Row: {
          id: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      set_updated_at: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
    };
    Enums: {
      hour_block_type: "RETAINER" | "PROJECT" | "MAINTENANCE";
      member_role: "OWNER" | "CONTRIBUTOR" | "VIEWER";
      task_status:
        | "BACKLOG"
        | "ON_DECK"
        | "IN_PROGRESS"
        | "IN_REVIEW"
        | "BLOCKED"
        | "DONE"
        | "ARCHIVED";
      task_priority: "LOW" | "MEDIUM" | "HIGH";
      user_role: "ADMIN" | "CONTRACTOR" | "CLIENT";
    };
    CompositeTypes: Record<string, never>;
  };
};
