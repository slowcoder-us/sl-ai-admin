"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

export default function Dashboard() {
	const trpc = useTRPC();
	const privateData = useQuery(trpc.privateData.queryOptions());

	return <p>接口状态：{privateData.data?.message}</p>;
}
