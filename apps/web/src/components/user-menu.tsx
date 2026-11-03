import { Button, buttonVariants } from "@sl-ai-admin/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@sl-ai-admin/ui/components/dropdown-menu";
import { Skeleton } from "@sl-ai-admin/ui/components/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { getDisplayName } from "@/lib/display-name";

export default function UserMenu() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Link className={buttonVariants({ variant: "outline" })} href="/login">
				登录
			</Link>
		);
	}

	const displayName = getDisplayName(session.user);

	const signOut = async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queryClient.clear();
					router.replace("/login");
					router.refresh();
				},
			},
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				{displayName}
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>{displayName}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={signOut} variant="destructive">
						退出登录
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
