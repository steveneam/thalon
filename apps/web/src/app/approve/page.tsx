import { redirect } from "next/navigation";

/** The queue moved into the workspace shell (B6.2); the old operator URL keeps working. */
export default function ApprovePage() {
  redirect("/app/approve");
}
