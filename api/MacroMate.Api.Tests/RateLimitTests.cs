using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MacroMate.Api.Features.Security;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class RateLimitTests(ApiFactory factory)
{
    [Fact]
    public async Task Too_many_auth_requests_from_one_address_get_429()
    {
        var limit = factory.Services.GetRequiredService<IOptions<RateLimitOptions>>().Value.AuthPerMinute;
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.7");
        client.DefaultRequestHeaders.Add("Accept-Language", "en");

        for (var i = 0; i < limit; i++)
        {
            var allowed = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = $"nobody-{i}@macromate.local" });
            Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);
        }

        var refused = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "one-more@macromate.local" });
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.True(refused.Headers.RetryAfter is not null);
        var detail = (await refused.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString();
        Assert.Equal("Too many requests. Try again in 1 min.", detail);

        var other = factory.CreateClient();
        other.DefaultRequestHeaders.Add("X-Forwarded-For", "203.0.113.8");
        Assert.Equal(HttpStatusCode.NoContent, (await other.PostAsJsonAsync("/api/auth/forgot-password", new { email = "other@macromate.local" })).StatusCode);
    }
}
