#!/usr/bin/env bash
set -euo pipefail

export AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_PAGER=""
expected_account="${EXPECTED_AWS_ACCOUNT_ID:-347076820926}"
cluster="${AURORA_CLUSTER_IDENTIFIER:-sl-ai-admin-express}"
metadata_file="${AURORA_METADATA_FILE:-/tmp/sl-ai-admin-express.json}"

command -v jq >/dev/null || { echo 'Install jq before continuing' >&2; exit 1; }
if [[ "$(aws sts get-caller-identity --query Account --output text)" != "$expected_account" ]]; then
  echo "Wrong AWS account; expected $expected_account" >&2
  exit 1
fi
if [[ ! "$cluster" =~ ^[a-z][a-z0-9-]{0,61}[a-z0-9]$ || "$cluster" == *--* ]]; then
  echo 'Invalid AURORA_CLUSTER_IDENTIFIER' >&2
  exit 1
fi

# Reuse only a matching Express database. Never adopt a VPC/password cluster.
if metadata="$(aws rds describe-db-clusters --db-cluster-identifier "$cluster" --query 'DBClusters[0]' --output json 2>&1)"; then
  if ! printf '%s' "$metadata" | jq -e '
    .Engine == "aurora-postgresql" and
    .InternetAccessGatewayEnabled == true and
    .IAMDatabaseAuthenticationEnabled == true
  ' >/dev/null; then
    echo 'Existing cluster does not match the required Express database configuration' >&2
    exit 1
  fi
else
  if [[ "$metadata" != *DBClusterNotFoundFault* && "$metadata" != *DBClusterNotFound* ]]; then
    printf '%s\n' "$metadata" >&2
    exit 1
  fi
  echo "Creating Aurora Express cluster $cluster in $AWS_REGION"
  aws rds create-db-cluster \
    --db-cluster-identifier "$cluster" \
    --engine aurora-postgresql \
    --with-express-configuration \
    --serverless-v2-scaling-configuration MinCapacity=0.5,MaxCapacity=4 \
    --deletion-protection \
    --output json >/dev/null
fi

echo 'Waiting for the Aurora cluster and writer to become available'
aws rds wait db-cluster-available --db-cluster-identifier "$cluster"
metadata="$(aws rds describe-db-clusters --db-cluster-identifier "$cluster" --query 'DBClusters[0]' --output json)"
writer="$(printf '%s' "$metadata" | jq -er '.DBClusterMembers[] | select(.IsClusterWriter == true) | .DBInstanceIdentifier')"
aws rds wait db-instance-available --db-instance-identifier "$writer"
printf '%s' "$metadata" | jq -e '
  .InternetAccessGatewayEnabled == true and
  .IAMDatabaseAuthenticationEnabled == true and
  (.Endpoint | type == "string") and
  (.DbClusterResourceId | startswith("cluster-"))
' >/dev/null

# Connection metadata only. No database password or IAM token is saved.
printf '%s' "$metadata" | jq '{
  DatabaseHost: .Endpoint,
  DatabaseResourceId: .DbClusterResourceId,
  DatabaseAdminUser: .MasterUsername,
  DatabaseName: "sl_ai_admin",
  BootstrapDatabaseName: "postgres",
  ClusterIdentifier: .DBClusterIdentifier
}' > "$metadata_file"
echo "Aurora Express ready. Connection metadata: $metadata_file"
