import {
	AUTH_MESSAGES,
	getSignUpErrorMessage,
	signUpSchema,
	toPlaceholderEmail,
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

export function SignUp({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
	const passwordInputRef = useRef<InputRef | null>(null);
	const confirmPasswordInputRef = useRef<InputRef | null>(null);
	const { toast } = useToast();

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			password: "",
			username: "",
		},
		onSubmit: async ({ value }) => {
			const username = value.username.trim();
			try {
				await authClient.signUp.email(
					{
						email: toPlaceholderEmail(username),
						name: username,
						password: value.password,
						username,
					},
					{
						onError: (error) => {
							toast.show({
								label: getSignUpErrorMessage(error.error.code),
								variant: "danger",
							});
						},
						onSuccess: () => {
							toast.show({ label: "注册成功", variant: "success" });
							// Sign-up starts a session; the root layout's guard swaps to the app.
							queryClient.invalidateQueries();
						},
					}
				);
			} catch {
				// better-fetch throws (instead of calling onError) when the server is unreachable.
				toast.show({ label: AUTH_MESSAGES.signUpFailed, variant: "danger" });
			}
		},
		validators: {
			onSubmit: signUpSchema,
		},
	});

	return (
		<Surface className="rounded-lg p-4" variant="secondary">
			<Text className="mb-4 font-semibold text-foreground text-xl">注册</Text>

			<View className="gap-3">
				<form.Field name="username">
					{(field) => {
						const error = getErrorMessage(field.state.meta.errors);
						return (
							<TextField isInvalid={Boolean(error)}>
								<Label>用户名</Label>
								<Input
									autoCapitalize="none"
									autoComplete="username-new"
									autoCorrect={false}
									blurOnSubmit={false}
									onBlur={field.handleBlur}
									onChangeText={field.handleChange}
									onSubmitEditing={() => {
										passwordInputRef.current?.focus();
									}}
									placeholder="3–20 位字母、数字或下划线"
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
									autoComplete="new-password"
									blurOnSubmit={false}
									onBlur={field.handleBlur}
									onChangeText={field.handleChange}
									onSubmitEditing={() => {
										confirmPasswordInputRef.current?.focus();
									}}
									placeholder="至少 8 位"
									ref={passwordInputRef}
									returnKeyType="next"
									secureTextEntry
									textContentType="newPassword"
									value={field.state.value}
								/>
								<FieldError>{error}</FieldError>
							</TextField>
						);
					}}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => {
						const error = getErrorMessage(field.state.meta.errors);
						return (
							<TextField isInvalid={Boolean(error)}>
								<Label>确认密码</Label>
								<Input
									autoComplete="new-password"
									onBlur={field.handleBlur}
									onChangeText={field.handleChange}
									onSubmitEditing={form.handleSubmit}
									placeholder="再次输入密码"
									ref={confirmPasswordInputRef}
									returnKeyType="go"
									secureTextEntry
									textContentType="newPassword"
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
								<Button.Label>注册</Button.Label>
							)}
						</Button>
					)}
				</form.Subscribe>

				<LinkButton onPress={onSwitchToSignIn}>
					<LinkButton.Label>已有账号？去登录</LinkButton.Label>
				</LinkButton>
			</View>
		</Surface>
	);
}
