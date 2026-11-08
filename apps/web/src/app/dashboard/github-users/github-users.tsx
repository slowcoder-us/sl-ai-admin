"use client";

import { Button } from "@sl-ai-admin/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@sl-ai-admin/ui/components/card";
import { Input } from "@sl-ai-admin/ui/components/input";
import { Label } from "@sl-ai-admin/ui/components/label";
import { Textarea } from "@sl-ai-admin/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { type SubmitEvent, useState } from "react";

import { useTRPC } from "@/utils/trpc";

interface Profile {
	avatarUrl: string | null;
	bio: string | null;
	location: string | null;
	name: string | null;
	username: string;
}

function ProfileDetails({ profile }: { profile: Profile }) {
	return (
		<div className="flex min-w-0 items-start gap-3">
			{profile.avatarUrl ? (
				<Image
					alt=""
					className="rounded-full"
					height={48}
					src={profile.avatarUrl}
					unoptimized
					width={48}
				/>
			) : null}
			<div className="wrap-break-word min-w-0">
				<a
					className="font-medium underline"
					href={`https://github.com/${profile.username}`}
					rel="noopener noreferrer"
					target="_blank"
				>
					@{profile.username}
				</a>
				{profile.name ? <p>{profile.name}</p> : null}
				{profile.bio ? <p>{profile.bio}</p> : null}
				{profile.location ? (
					<p className="text-muted-foreground">{profile.location}</p>
				) : null}
			</div>
		</div>
	);
}

function EditProfile({
	onClose,
	profile,
}: {
	onClose: () => void;
	profile: Profile & { id: string };
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const update = useMutation(
		trpc.githubProfiles.update.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(
					trpc.githubProfiles.list.queryFilter()
				);
				onClose();
			},
		})
	);

	function submit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const fields = new FormData(event.currentTarget);
		update.mutate({
			bio: String(fields.get("bio")),
			id: profile.id,
			location: String(fields.get("location")),
			name: String(fields.get("name")),
		});
	}

	return (
		<form
			aria-label={`编辑 @${profile.username}`}
			className="flex flex-col gap-3"
			onSubmit={submit}
		>
			<Label>
				姓名
				<Input
					autoComplete="off"
					defaultValue={profile.name ?? ""}
					maxLength={255}
					name="name"
				/>
			</Label>
			<Label>
				简介
				<Textarea defaultValue={profile.bio ?? ""} maxLength={500} name="bio" />
			</Label>
			<Label>
				所在地
				<Input
					autoComplete="off"
					defaultValue={profile.location ?? ""}
					maxLength={255}
					name="location"
				/>
			</Label>
			{update.error ? <p role="alert">{update.error.message}</p> : null}
			<div className="flex gap-2">
				<Button disabled={update.isPending} type="submit">
					保存修改
				</Button>
				<Button
					disabled={update.isPending}
					onClick={onClose}
					type="button"
					variant="outline"
				>
					取消
				</Button>
			</div>
		</form>
	);
}

export function GithubUsers() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const profiles = useQuery(trpc.githubProfiles.list.queryOptions());
	const lookup = useQuery(
		trpc.githubProfiles.lookup.queryOptions(search, {
			enabled: search.length > 0,
			refetchOnWindowFocus: false,
			retry: false,
		})
	);
	const add = useMutation(
		trpc.githubProfiles.add.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(
					trpc.githubProfiles.list.queryFilter()
				);
				setSearch("");
			},
		})
	);
	const remove = useMutation(
		trpc.githubProfiles.remove.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(
					trpc.githubProfiles.list.queryFilter()
				);
				setDeletingId(null);
			},
		})
	);

	function submitSearch(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const username = String(
			new FormData(event.currentTarget).get("username")
		).trim();
		add.reset();
		if (username === search) {
			lookup.refetch().catch(() => undefined);
		} else {
			setSearch(username);
		}
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>
						<h2>搜索用户</h2>
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form className="flex flex-col gap-2" onSubmit={submitSearch}>
						<Label htmlFor="github-username">GitHub 用户名</Label>
						<div className="flex gap-2">
							<Input
								autoCapitalize="none"
								autoComplete="off"
								id="github-username"
								maxLength={39}
								name="username"
								required
							/>
							<Button
								disabled={lookup.isFetching || add.isPending}
								type="submit"
							>
								搜索
							</Button>
						</div>
					</form>
					{lookup.isFetching ? <p role="status">正在搜索…</p> : null}
					{lookup.error ? <p role="alert">{lookup.error.message}</p> : null}
					{add.error ? <p role="alert">{add.error.message}</p> : null}
					{lookup.data ? (
						<div className="flex flex-wrap items-start justify-between gap-3">
							<ProfileDetails profile={lookup.data} />
							<Button
								disabled={add.isPending}
								onClick={() => add.mutate(search)}
								type="button"
								variant="outline"
							>
								保存用户
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>
						<h2>已保存用户</h2>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{profiles.status === "pending" ? (
						<p role="status">正在加载…</p>
					) : null}
					{profiles.error ? <p role="alert">{profiles.error.message}</p> : null}
					{profiles.data?.length === 0 && (
						<p className="text-muted-foreground">还没有保存的用户。</p>
					)}
					<ul className="flex flex-col gap-4">
						{profiles.data?.map((profile) => (
							<li className="border-t pt-4" key={profile.id}>
								{editingId === profile.id ? (
									<EditProfile
										onClose={() => setEditingId(null)}
										profile={profile}
									/>
								) : (
									<div className="flex flex-wrap items-start justify-between gap-3">
										<ProfileDetails profile={profile} />
										{deletingId === profile.id ? (
											<div className="flex flex-wrap items-center gap-2">
												<p>删除这条记录？</p>
												<Button
													disabled={remove.isPending}
													onClick={() => remove.mutate(profile.id)}
													type="button"
													variant="destructive"
												>
													确认删除
												</Button>
												<Button
													disabled={remove.isPending}
													onClick={() => setDeletingId(null)}
													type="button"
													variant="outline"
												>
													取消
												</Button>
												{remove.error ? (
													<p role="alert">{remove.error.message}</p>
												) : null}
											</div>
										) : (
											<div className="flex gap-2">
												<Button
													disabled={editingId !== null || deletingId !== null}
													onClick={() => setEditingId(profile.id)}
													type="button"
													variant="outline"
												>
													编辑
												</Button>
												<Button
													disabled={editingId !== null || deletingId !== null}
													onClick={() => {
														remove.reset();
														setDeletingId(profile.id);
													}}
													type="button"
													variant="outline"
												>
													删除
												</Button>
											</div>
										)}
									</div>
								)}
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</>
	);
}
