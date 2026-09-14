# syntax=docker/dockerfile:1
# Build context is src/ (see .github/workflows/app.yml): docker build -f api/Dockerfile src

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY api/SevenHabits.Api.csproj api/
RUN dotnet restore api/SevenHabits.Api.csproj

COPY api/ api/
RUN dotnet publish api/SevenHabits.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app \
    -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# Commit SHA served by GET /api/version.
ARG APP_VERSION=dev

ENV ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_NOLOGO=1 \
    App__Version=${APP_VERSION}

WORKDIR /app
COPY --from=build /app .

# Non-root user provided by the .NET base image (UID 1654).
USER $APP_UID
EXPOSE 8080

ENTRYPOINT ["dotnet", "SevenHabits.Api.dll"]
