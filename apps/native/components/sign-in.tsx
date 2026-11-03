import {
	AUTH_MESSAGES,
	getSignInErrorMessage,
	signInSchema,
} from "@sl-ai-admin/auth/credentials";
import { useForm } from "@tanstack/react-form";
import {
	Button,
	FieldError,
	Input,
	type InputRef,
	Label,
	LinkButton,
	Spinner,
	Surface,
	TextField,
	useToast,
} from "heroui-native";
import { useRef } from "react";
import { Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/form-error";
import { queryClient } from "@/utils/trpc";

export function SignIn({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
	const passwordInputRef = useRef<InputRef | null>(null);
	const { toast } = useToast();

	const form = useForm({
		defaultValues: {
			password: "",
			username: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await authClient.signIn.username(
					{
						password: value.password,
						username: value.username.trim(),
					},
					{
						onError: (error) => {
							toast.show({
								label: getSignInErrorMessage(error.error.status),
								variant: "danger",
							});
						},
						onSuccess: () => {
							toast.show({ label: "登录成功", variant: "success" });
							// The root layout's Stack.Protected guard swaps to the app once the session updates.
							queryClient.invalidateQueries();
						},
					}
				);
			} catch {
				// better-fetch throws (instead of calling onError) when the server is unreachable.
				toast.show({ label: AUTH_MESSAGES.signInFailed, variant: "danger" });
			}
		},
		validators: {
			onSubmit: signInSchema,
		},
	});

	return (
		<Surface className="rounded-lg p-4" variant="secondary">
			<Text className="mb-4 font-semibold text-foreground text-xl">登录</Text>

			<View className="gap-3">
				<form.Field name="username">
					{(field) => {
						const error = getErrorMessage(field.state.meta.errors);
						return (
							<TextField isInvalid={Boolean(error)}>
								<Label>用户名</Label>
								<Input
									autoCapitalize="none"
									autoComplete="username"
									autoCorrect={false}
									blurOnSubmit={false}
									onBlur={field.handleBlur}
									onChangeText={field.handleChange}
									onSubmitEditing={() => {
										passwordInputRef.current?.focus();
									}}
									placeholder="请输入用户名"
									returnKeyType="next"
									textContentType="username"
									value={field.state.value}
								/>
								<FieldError>{error}</FieldError>
							</TextField>
						);
					}}
				</form.Field>

				<form.Field name="password">
					{(field) => {
						const error = getErrorMessage(field.state.meta.errors);
						return (
							<TextField isInvalid={Boolean(error)}>
								<Label>密码</Label>
								<Input
									autoComplete="current-password"
									onBlur={field.handleBlur}
									onChangeText={field.handleChange}
									onSubmitEditing={form.handleSubmit}
									placeholder="请输入密码"
									ref={passwordInputRef}
									returnKeyType="go"
									secureTextEntry
									textContentType="password"
									value={field.state.value}
								/>
								<FieldError>{error}</FieldError>
							</TextField>
						);
					}}
				</form.Field>

				<form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Button
							className="mt-1"
							isDisabled={isSubmitting}
							onPress={form.handleSubmit}
						>
							{isSubmitting ? (
								<Spinner color="default" size="sm" />
							) : (
								<Button.Label>登录</Button.Label>
							)}
						</Button>
					)}
				</form.Subscribe>

				<LinkButton onPress={onSwitchToSignUp}>
					<LinkButton.Label>没有账号？去注册</LinkButton.Label>
				</LinkButton>
			</View>
		</Surface>
	);
}
