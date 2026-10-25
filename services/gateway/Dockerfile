FROM node:22-slim AS frontend
WORKDIR /frontend
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/.npmrc ./
RUN corepack pnpm install --frozen-lockfile
COPY frontend/ ./
RUN corepack pnpm build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY services/gateway/ ./
RUN dotnet publish -c Release -o /publish
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /publish .
COPY --from=frontend /frontend/dist ./wwwroot
USER root
RUN mkdir -p /data && chown app /data
USER app
ENV DATA_DIR=/data ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Gateway.dll"]
