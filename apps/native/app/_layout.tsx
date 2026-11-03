import "@/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HeroUINativeProvider, Spinner } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

function StackLayout() {
	const { data: session, isPending } = authClient.useSession();
	// Better Auth reports isPending again whenever it refetches a null session
	// (e.g. right after sign-in, or on app focus). Only the first load may hide
	// the navigator, otherwise the sign-in form would unmount mid-submit.
	const [hasLoadedSession, setHasLoadedSession] = useState(false);
	if (!(isPending || hasLoadedSession)) {
		setHasLoadedSession(true);
	}

	if (!hasLoadedSession) {
		return (
			<View className="flex-1 items-center justify-center bg-background">
				<Spinner size="lg" />
			</View>
		);
	}

	const isSignedIn = Boolean(session);

	return (
		<Stack>
			<Stack.Protected guard={isSignedIn}>
				<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
				<Stack.Screen
					name="modal"
					options={{ presentation: "modal", title: "Modal" }}
				/>
			</Stack.Protected>
			<Stack.Protected guard={!isSignedIn}>
				<Stack.Screen name="sign-in" options={{ headerShown: false }} />
			</Stack.Protected>
		</Stack>
	);
}

export default function Layout() {
	return (
		<QueryClientProvider client={queryClient}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<KeyboardProvider>
					<AppThemeProvider>
						<HeroUINativeProvider>
							<StackLayout />
						</HeroUINativeProvider>
					</AppThemeProvider>
				</KeyboardProvider>
			</GestureHandlerRootView>
		</QueryClientProvider>
	);
}
