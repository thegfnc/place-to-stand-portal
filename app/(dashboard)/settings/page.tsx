import { redirect } from "next/navigation";

export default function SettingsIndexPage() {
  redirect("/settings/users");
}
