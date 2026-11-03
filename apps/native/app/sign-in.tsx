import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";

/** Gap kept between the keyboard and the focused input when the form scrolls it into view. */
const KEYBOARD_BOTTOM_OFFSET = 24;

export default function SignInScreen() {
	const [showSignIn, setShowSignIn] = useState(true);

	return (
		<Container className="px-6" isScrollable={false}>
			{/* Container's plain ScrollView does not react to the keyboard, so the lower inputs and
			    the submit button of this centered form could end up hidden behind it. */}
			<KeyboardAwareScrollView
				bottomOffset={KEYBOARD_BOTTOM_OFFSET}
				contentContainerStyle={{ flexGrow: 1 }}
				contentInsetAdjustmentBehavior="automatic"
				keyboardShouldPersistTaps="handled"
			>
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
			</KeyboardAwareScrollView>
		</Container>
	);
}
