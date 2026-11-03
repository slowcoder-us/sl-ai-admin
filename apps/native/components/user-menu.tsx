import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { getDisplayName } from "@/lib/display-name";
import { queryClient } from "@/utils/trpc";

export function UserMenu() {
	const { data: session } = authClient.useSession();

	if (!session) {
		return null;
	}

	const signOut = async () => {
		try {
			await authClient.signOut();
		} catch {
			// The Expo plugin clears the SecureStore session before the request is sent, so the
			// user is signed out locally (and the guard returns to sign-in) even when the server
			// is unreachable; the server-side session then simply expires.
		}
		queryClient.clear();
	};

	return (
		<View className="flex-row items-center gap-2 pr-2">
			<Text
				className="max-w-28 font-medium text-foreground text-sm"
				numberOfLines={1}
			>
				{getDisplayName(session.user)}
			</Text>
			<Button onPress={signOut} size="sm" variant="danger-soft">
				<Button.Label>退出登录</Button.Label>
			</Button>
		</View>
	);
}
