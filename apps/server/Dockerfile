FROM public.ecr.aws/lambda/nodejs:24 AS build
RUN dnf install -y openssl && dnf clean all \
    && npm install --global pnpm@12.16.1
WORKDIR /var/task
COPY . .
RUN pnpm --filter 'server...' install --frozen-lockfile --ignore-scripts
RUN pnpm -F server env:generate \
    && DATABASE_URL=postgresql://build@localhost/build pnpm -F @sl-ai-admin/db db:generate \
    && pnpm -F server build
RUN DATABASE_URL=postgresql://build@localhost/build pnpm -F @sl-ai-admin/db exec prisma version

FROM public.ecr.aws/lambda/nodejs:24
RUN dnf install -y openssl && dnf clean all
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /var/task/rds-ca.pem
COPY --from=build /var/task /var/task
CMD ["apps/server/dist/lambda.handler"]
