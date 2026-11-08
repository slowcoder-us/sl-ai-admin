import { buttonVariants } from "@sl-ai-admin/ui/components/button";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getDisplayName } from "@/lib/display-name";
import { getServerSession } from "@/lib/get-server-session";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
	const session = await getServerSession();

	if (!session) {
		redirect("/login");
	}

	return (
		<div className="p-6">
			<h1 className="mb-4 font-bold text-2xl">后台首页</h1>
			<p>欢迎，{getDisplayName(session.user)}</p>
			<Dashboard />
			<Link
				className={buttonVariants({ variant: "outline" })}
				href="/dashboard/github-users"
			>
				GitHub 用户管理
			</Link>
		</div>
	);
}
