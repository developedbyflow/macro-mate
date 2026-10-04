FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY MacroMate.Api/MacroMate.Api.csproj MacroMate.Api/
RUN dotnet restore MacroMate.Api/MacroMate.Api.csproj
COPY MacroMate.Api/ MacroMate.Api/
RUN dotnet publish MacroMate.Api/MacroMate.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
RUN mkdir -p /data && chown app:app /data
USER app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "MacroMate.Api.dll"]
