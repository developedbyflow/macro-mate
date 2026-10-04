using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace MacroMate.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Password = "macromate-dev-2026";
    public const string FlorinEmail = "florin@macromate.local";
    public const string SecondEmail = "cont2@macromate.local";

    static readonly string ConnectionString =
        Environment.GetEnvironmentVariable("MACROMATE_TEST_DB")
        ?? "Host=localhost;Port=5491;Database=macromate_test;Username=macromate;Password=macromate";

    public ApiFactory()
    {
        var admin = new NpgsqlConnectionStringBuilder(ConnectionString) { Database = "postgres" };
        using var connection = new NpgsqlConnection(admin.ConnectionString);
        connection.Open();
        using var drop = new NpgsqlCommand("DROP DATABASE IF EXISTS macromate_test WITH (FORCE)", connection);
        drop.ExecuteNonQuery();

        Environment.SetEnvironmentVariable("ConnectionStrings__Default", ConnectionString);
        Environment.SetEnvironmentVariable("Storage__Path", Path.Combine(Path.GetTempPath(), "macromate-tests"));
    }

    public async Task<HttpClient> LoginAsync(string email)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        return client;
    }
}
