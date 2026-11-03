import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { useThemeColor } from "heroui-native";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

function DrawerLayout() {
	const themeColorForeground = useThemeColor("foreground");
	const themeColorBackground = useThemeColor("background");

	const renderHeaderRight = useCallback(
		() => (
			<View className="flex-row items-center">
				<ThemeToggle />
				<UserMenu />
			</View>
		),
		[]
	);

	return (
		<Drawer
			screenOptions={{
				drawerStyle: { backgroundColor: themeColorBackground },
				headerRight: renderHeaderRight,
				headerStyle: { backgroundColor: themeColorBackground },
				headerTintColor: themeColorForeground,
				headerTitleStyle: {
					color: themeColorForeground,
					fontWeight: "600",
				},
			}}
		>
			<Drawer.Screen
				name="index"
				options={{
					drawerIcon: ({ size, color, focused }) => (
						<Ionicons
							name="home-outline"
							size={size}
							style={{ color: focused ? color : themeColorForeground }}
						/>
					),
					drawerLabel: ({ color, focused }) => (
						<Text style={{ color: focused ? color : themeColorForeground }}>
							首页
						</Text>
					),
					headerTitle: "首页",
				}}
			/>
			<Drawer.Screen
				name="(tabs)"
				options={{
					drawerIcon: ({ size, color, focused }) => (
						<MaterialIcons
							name="border-bottom"
							size={size}
							style={{ color: focused ? color : themeColorForeground }}
						/>
					),
					drawerLabel: ({ color, focused }) => (
						<Text style={{ color: focused ? color : themeColorForeground }}>
							Tabs
						</Text>
					),
					headerRight: () => (
						<View className="flex-row items-center">
							<Link asChild href="/modal">
								<Pressable className="mr-2">
									<Ionicons
										name="add-outline"
										size={24}
										style={{ color: themeColorForeground }}
									/>
								</Pressable>
							</Link>
							<UserMenu />
						</View>
					),
					headerTitle: "Tabs",
				}}
			/>
		</Drawer>
	);
}

export default DrawerLayout;
