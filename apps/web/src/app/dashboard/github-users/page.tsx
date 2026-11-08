import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/get-server-session";

import { GithubUsers } from "./github-users";

export default async function GithubUsersPage() {
	if (!(await getServerSession())) {
		redirect("/login");
	}

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
			<header>
				<h1 className="font-bold text-2xl">GitHub 用户管理</h1>
				<p className="text-muted-foreground">
					搜索 GitHub 公开资料并保存到你的列表。
				</p>
			</header>
			<GithubUsers />
		</main>
	);
}
