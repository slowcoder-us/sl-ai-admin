// biome-ignore-all lint/correctness/noUnusedInstantiation: CDK registers constructs on their parent scope.
import { fileURLToPath } from "node:url";
import {
	CfnOutput,
	CfnParameter,
	CustomResource,
	Duration,
	IgnoreMode,
	RemovalPolicy,
	Stack,
	type StackProps,
} from "aws-cdk-lib";
import { CfnStage, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
	AmazonLinuxCpuType,
	CfnEIP,
	CfnInternetGateway,
	CfnNatGateway,
	CfnRoute,
	CfnVPCGatewayAttachment,
	Instance,
	InstanceType,
	IpAddresses,
	MachineImage,
	Peer,
	Port,
	PublicSubnet,
	SecurityGroup,
	SubnetType,
	Vpc,
} from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
	Architecture,
	DockerImageCode,
	DockerImageFunction,
} from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import {
	AuroraPostgresEngineVersion,
	ClusterInstance,
	Credentials,
	DatabaseCluster,
	DatabaseClusterEngine,
} from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Provider } from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

const DB_NAME = "sl_ai_admin";
const APP_DB_USER = "sl_ai_app";
const MIGRATION_USER = "sl_ai_admin";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const dockerFile = "apps/server/Dockerfile";

export class BackendStack extends Stack {
	constructor(scope: Construct, id: string, props: StackProps) {
		super(scope, id, props);

		const webOrigin = new CfnParameter(this, "WebOrigin", {
			allowedPattern: "https://[a-zA-Z0-9.-]+",
			description:
				"Public HTTPS origin of the Cloudflare Worker, without a trailing slash",
		}).valueAsString;

		const vpc = new Vpc(this, "Vpc", {
			createInternetGateway: false,
			ipAddresses: IpAddresses.cidr("10.42.0.0/16"),
			maxAzs: 2,
			natGateways: 0,
			subnetConfiguration: [
				{
					cidrMask: 24,
					name: "Application",
					subnetType: SubnetType.PRIVATE_WITH_EGRESS,
				},
				{
					cidrMask: 24,
					name: "Database",
					subnetType: SubnetType.PRIVATE_ISOLATED,
				},
			],
		});
		const [firstAz] = vpc.availabilityZones;
		if (!firstAz) {
			throw new Error("The VPC requires at least two availability zones");
		}
		const publicSubnet = new PublicSubnet(this, "EgressSubnet", {
			availabilityZone: firstAz,
			cidrBlock: "10.42.254.0/24",
			mapPublicIpOnLaunch: false,
			vpcId: vpc.vpcId,
		});
		const internetGateway = new CfnInternetGateway(this, "InternetGateway");
		const attachment = new CfnVPCGatewayAttachment(
			this,
			"AttachInternetGateway",
			{
				internetGatewayId: internetGateway.ref,
				vpcId: vpc.vpcId,
			}
		);
		publicSubnet.addDefaultInternetRoute(internetGateway.ref, attachment);
		const eip = new CfnEIP(this, "NatAddress", { domain: "vpc" });
		const nat = new CfnNatGateway(this, "Nat", {
			allocationId: eip.attrAllocationId,
			subnetId: publicSubnet.subnetId,
		});
		nat.node.addDependency(publicSubnet.internetConnectivityEstablished);
		for (const [index, subnet] of vpc.privateSubnets.entries()) {
			new CfnRoute(this, `ApplicationEgress${index}`, {
				destinationCidrBlock: "0.0.0.0/0",
				natGatewayId: nat.ref,
				routeTableId: subnet.routeTable.routeTableId,
			});
		}

		const lambdaSecurity = new SecurityGroup(this, "LambdaSecurity", {
			allowAllOutbound: false,
			vpc,
		});
		lambdaSecurity.addEgressRule(
			Peer.anyIpv4(),
			Port.tcp(443),
			"GitHub API over HTTPS"
		);
		const bastionSecurity = new SecurityGroup(this, "BastionSecurity", {
			allowAllOutbound: false,
			vpc,
		});
		bastionSecurity.addEgressRule(
			Peer.anyIpv4(),
			Port.tcp(443),
			"Systems Manager over HTTPS"
		);
		const privateSubnets = { subnetType: SubnetType.PRIVATE_WITH_EGRESS };
		const bastion = new Instance(this, "DatabaseBastion", {
			instanceType: new InstanceType("t4g.nano"),
			machineImage: MachineImage.latestAmazonLinux2023({
				cpuType: AmazonLinuxCpuType.ARM_64,
			}),
			requireImdsv2: true,
			securityGroup: bastionSecurity,
			ssmSessionPermissions: true,
			vpc,
			vpcSubnets: privateSubnets,
		});
		const database = new DatabaseCluster(this, "Database", {
			backup: { retention: Duration.days(7) },
			credentials: Credentials.fromGeneratedSecret(MIGRATION_USER),
			defaultDatabaseName: DB_NAME,
			deletionProtection: true,
			engine: DatabaseClusterEngine.auroraPostgres({
				version: AuroraPostgresEngineVersion.VER_16_13,
			}),
			parameters: { "rds.force_ssl": "1" },
			removalPolicy: RemovalPolicy.SNAPSHOT,
			serverlessV2MaxCapacity: 4,
			serverlessV2MinCapacity: 0.5,
			storageEncrypted: true,
			vpc,
			vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
			writer: ClusterInstance.serverlessV2("Writer", {
				publiclyAccessible: false,
			}),
		});
		database.connections.allowDefaultPortFrom(lambdaSecurity);
		database.connections.allowDefaultPortFrom(bastionSecurity);
		const adminSecret = database.secret;
		if (!adminSecret) {
			throw new Error("Aurora administrator secret is missing");
		}

		const appSecret = new Secret(this, "DatabaseAppSecret", {
			generateSecretString: {
				excludePunctuation: true,
				generateStringKey: "password",
				passwordLength: 48,
				secretStringTemplate: "{}",
			},
			removalPolicy: RemovalPolicy.RETAIN,
		});
		const authSecret = new Secret(this, "AuthSecret", {
			generateSecretString: {
				excludePunctuation: true,
				generateStringKey: "secret",
				passwordLength: 64,
				secretStringTemplate: "{}",
			},
			removalPolicy: RemovalPolicy.RETAIN,
		});
		const image = new DockerImageAsset(this, "ServerImage", {
			directory: repositoryRoot,
			exclude: [
				".*",
				"**/.*",
				"!.dockerignore",
				"!apps/server/.env.schema",
				"!packages/db/.env.schema",
				"**/node_modules",
				"**/dist",
				"**/*.tsbuildinfo",
				"**/prisma/generated",
				"apps/web/**",
				"!apps/web/package.json",
				"apps/native/**",
				"!apps/native/package.json",
				"apps/fumadocs/**",
				"!apps/fumadocs/package.json",
				"docs",
				"specs",
				"packages/infra/**",
				"!packages/infra/package.json",
			],
			file: dockerFile,
			ignoreMode: IgnoreMode.DOCKER,
			platform: Platform.LINUX_AMD64,
		});
		const databaseEnv = {
			DB_HOST: database.clusterEndpoint.hostname,
			DB_NAME,
			NODE_ENV: "production",
		};
		const lambdaVpc = {
			securityGroups: [lambdaSecurity],
			vpc,
			vpcSubnets: privateSubnets,
		};
		const migrationFunction = new DockerImageFunction(this, "MigrateDatabase", {
			...lambdaVpc,
			architecture: Architecture.X86_64,
			code: DockerImageCode.fromEcr(image.repository, {
				cmd: ["apps/server/dist/migrate.handler"],
				tagOrDigest: image.imageTag,
			}),
			environment: {
				...databaseEnv,
				APP_DB_PASSWORD: appSecret
					.secretValueFromJson("password")
					.unsafeUnwrap(),
				DB_PASSWORD: adminSecret.secretValueFromJson("password").unsafeUnwrap(),
				DB_USER: MIGRATION_USER,
			},
			logGroup: new LogGroup(this, "MigrationLogs", {
				retention: RetentionDays.ONE_MONTH,
			}),
			memorySize: 1024,
			timeout: Duration.minutes(3),
		});
		migrationFunction.node.addDependency(database);
		const migrations = new Provider(this, "MigrationProvider", {
			onEventHandler: migrationFunction,
		});
		const schema = new CustomResource(this, "DatabaseSchema", {
			properties: { Release: image.assetHash },
			resourceType: "Custom::PrismaMigrations",
			serviceToken: migrations.serviceToken,
		});
		const apiFunction = new DockerImageFunction(this, "ApiFunction", {
			...lambdaVpc,
			architecture: Architecture.X86_64,
			code: DockerImageCode.fromEcr(image.repository, {
				tagOrDigest: image.imageTag,
			}),
			environment: {
				...databaseEnv,
				BETTER_AUTH_SECRET: authSecret
					.secretValueFromJson("secret")
					.unsafeUnwrap(),
				BETTER_AUTH_URL: webOrigin,
				CORS_ORIGIN: webOrigin,
				DB_PASSWORD: appSecret.secretValueFromJson("password").unsafeUnwrap(),
				DB_USER: APP_DB_USER,
			},
			logGroup: new LogGroup(this, "ApiLogs", {
				retention: RetentionDays.ONE_MONTH,
			}),
			memorySize: 1024,
			timeout: Duration.seconds(15),
		});
		apiFunction.node.addDependency(schema);

		const api = new HttpApi(this, "HttpApi");
		const integration = new HttpLambdaIntegration("Hono", apiFunction);
		api.addRoutes({ integration, methods: [HttpMethod.GET], path: "/" });
		for (const path of ["/api/auth/{proxy+}", "/trpc/{proxy+}"]) {
			api.addRoutes({
				integration,
				methods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
				path,
			});
		}
		const stage = api.defaultStage?.node.defaultChild;
		if (stage instanceof CfnStage) {
			stage.defaultRouteSettings = {
				throttlingBurstLimit: 40,
				throttlingRateLimit: 20,
			};
		}

		new CfnOutput(this, "ApiOrigin", { value: api.apiEndpoint });
		new CfnOutput(this, "BastionInstanceId", { value: bastion.instanceId });
		new CfnOutput(this, "DatabaseEndpoint", {
			value: database.clusterEndpoint.hostname,
		});
		new CfnOutput(this, "DatabaseName", { value: DB_NAME });
		new CfnOutput(this, "DatabaseAdminSecretArn", {
			value: adminSecret.secretArn,
		});
	}
}
