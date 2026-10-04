using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Email;
using MacroMate.Api.Features.Kitchens;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
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
        Environment.SetEnvironmentVariable("RateLimits__AuthPerMinute", "200");
    }

    public TestOutbox Outbox { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureTestServices(services => services.AddSingleton<IEmailSender>(Outbox));

    public async Task<HttpClient> NewUserAsync(string name)
    {
        var email = $"{name.ToLowerInvariant()}-{Guid.NewGuid():N}@macromate.local";
        await using (var scope = Services.CreateAsyncScope())
        {
            var (user, errors) = await KitchenService.CreateUserAsync(
                scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>(),
                scope.ServiceProvider.GetRequiredService<AppDbContext>(),
                email, name, Password, null, CancellationToken.None);
            if (user is null)
                throw new InvalidOperationException(string.Join(" ", errors));
        }
        return await LoginAsync(email);
    }

    public async Task<HttpClient> LoginAsync(string email)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });
        response.EnsureSuccessStatusCode();
        return client;
    }
}

public sealed partial class TestOutbox : IEmailSender
{
    readonly ConcurrentQueue<EmailMessage> sent = new();

    public Task SendAsync(EmailMessage message, CancellationToken ct)
    {
        sent.Enqueue(message);
        return Task.CompletedTask;
    }

    public bool HasMailFor(string email) => sent.Any(m => m.To == email);

    public Uri LinkFor(string email) => new(LinkPattern().Match(sent.Last(m => m.To == email).Text).Value);

    [GeneratedRegex(@"https?://\S+")]
    private static partial Regex LinkPattern();
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>;
