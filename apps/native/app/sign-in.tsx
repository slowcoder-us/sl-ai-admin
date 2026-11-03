import { useState } from "react";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";

export default function SignInScreen() {
	const [showSignIn, setShowSignIn] = useState(true);

	return (
		<Container className="px-6">
			<View className="flex-1 justify-center py-12">
				<Text className="mb-8 text-center font-bold text-3xl text-foreground">
					sl-ai-admin
				</Text>
				{showSignIn ? (
					<SignIn onSwitchToSignUp={() => setShowSignIn(false)} />
				) : (
					<SignUp onSwitchToSignIn={() => setShowSignIn(true)} />
				)}
			</View>
		</Container>
	);
}
