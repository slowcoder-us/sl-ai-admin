import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/get-server-session";

import AuthForms from "./auth-forms";

export default async function LoginPage() {
	const session = await getServerSession();

	if (session) {
		redirect("/dashboard");
	}

	return <AuthForms />;
}
