import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Card, Chip, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { getDisplayName } from "@/lib/display-name";
import { trpc } from "@/utils/trpc";

type ConnectionStatus = "checking" | "connected" | "disconnected";

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
	checking: "正在检查连接…",
	connected: "已连接 API",
	disconnected: "API 未连接",
};

const CONNECTION_ICONS = {
	checking: "hourglass-outline",
	connected: "checkmark-circle",
	disconnected: "close-circle",
} as const satisfies Record<ConnectionStatus, string>;

function getConnectionStatus(
	isLoading: boolean,
	isConnected: boolean
): ConnectionStatus {
	if (isLoading) {
		return "checking";
	}
	return isConnected ? "connected" : "disconnected";
}

export default function Home() {
	const healthCheck = useQuery(trpc.healthCheck.queryOptions());
	const privateData = useQuery(trpc.privateData.queryOptions());
	const isConnected = healthCheck.data === "OK";
	const status = getConnectionStatus(healthCheck.isLoading, isConnected);
	const { data: session } = authClient.useSession();

	const statusColors: Record<ConnectionStatus, string> = {
		checking: useThemeColor("muted"),
		connected: useThemeColor("success"),
		disconnected: useThemeColor("danger"),
	};

	return (
		<Container className="p-6">
			<View className="mb-6 py-4">
				<Text className="mb-2 font-bold text-4xl text-foreground">
					BETTER T STACK
				</Text>
			</View>

			{session?.user ? (
				<Card className="mb-6 p-4" variant="secondary">
					<Text className="text-base text-foreground">
						欢迎，
						<Text className="font-medium">{getDisplayName(session.user)}</Text>
					</Text>
				</Card>
			) : null}

			<Card className="p-6" variant="secondary">
				<View className="mb-4 flex-row items-center justify-between">
					<Card.Title>系统状态</Card.Title>
					<Chip
						color={isConnected ? "success" : "danger"}
						size="sm"
						variant="secondary"
					>
						<Chip.Label>{isConnected ? "在线" : "离线"}</Chip.Label>
					</Chip>
				</View>

				<Card className="p-4">
					<View className="flex-row items-center">
						<View
							className={`mr-3 h-3 w-3 rounded-full ${isConnected ? "bg-success" : "bg-muted"}`}
						/>
						<View className="flex-1">
							<Text className="mb-1 font-medium text-foreground">
								TRPC Backend
							</Text>
							<Card.Description>{CONNECTION_LABELS[status]}</Card.Description>
						</View>
						<Ionicons
							color={statusColors[status]}
							name={CONNECTION_ICONS[status]}
							size={20}
						/>
					</View>
				</Card>
			</Card>

			<Card className="mt-6 p-4" variant="secondary">
				<Card.Title className="mb-3">Private Data</Card.Title>
				<Card.Description>{privateData.data?.message}</Card.Description>
			</Card>
		</Container>
	);
}
