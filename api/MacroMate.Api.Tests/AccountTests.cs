using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MacroMate.Api.Features.Auth;
using Microsoft.AspNetCore.WebUtilities;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class AccountTests(ApiFactory factory)
{
    const string NewPassword = "parola-noua-2026";

    static async Task<MeResponse> MeAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/auth/me", JsonSerializerOptions.Web))!;

    async Task<HttpStatusCode> LoginStatusAsync(string email, string password) =>
        (await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password })).StatusCode;

    static async Task<string> DetailAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString()!;

    [Fact]
    public async Task A_forgotten_password_is_reset_from_the_emailed_link()
    {
        var email = (await MeAsync(await factory.NewUserAsync("Ana"))).Email;
        var guest = factory.CreateClient();

        Assert.Equal(HttpStatusCode.NoContent, (await guest.PostAsJsonAsync("/api/auth/forgot-password", new { email })).StatusCode);
        var query = QueryHelpers.ParseQuery(factory.Outbox.LinkFor(email).Query);
        Assert.Equal(email, query["email"].ToString());

        var reset = await guest.PostAsJsonAsync("/api/auth/reset-password", new { email, token = query["token"].ToString(), password = NewPassword });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(email, NewPassword));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(email, ApiFactory.Password));

        var reused = await guest.PostAsJsonAsync("/api/auth/reset-password", new { email, token = query["token"].ToString(), password = "inca-una-2026" });
        Assert.Equal(HttpStatusCode.BadRequest, reused.StatusCode);
        Assert.Equal("Linkul nu mai e valabil. Cere altul.", await DetailAsync(reused));
    }

    [Fact]
    public async Task An_unknown_email_gets_the_same_answer_and_no_mail()
    {
        var email = $"nobody-{Guid.NewGuid():N}@macromate.local";
        var response = await factory.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { email });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(factory.Outbox.HasMailFor(email));
    }

    [Fact]
    public async Task Changing_the_password_needs_the_current_one()
    {
        var ana = await factory.NewUserAsync("Ana");
        var email = (await MeAsync(ana)).Email;

        var wrong = await ana.PostAsJsonAsync("/api/auth/me/password", new { currentPassword = "nu-e-asta-2026", newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("Parola actuală nu e corectă.", await DetailAsync(wrong));

        var right = await ana.PostAsJsonAsync("/api/auth/me/password", new { currentPassword = ApiFactory.Password, newPassword = NewPassword });
        Assert.Equal(HttpStatusCode.NoContent, right.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ana.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(email, NewPassword));
    }

    [Fact]
    public async Task A_new_email_takes_effect_only_after_the_link_is_opened()
    {
        var ana = await factory.NewUserAsync("Ana");
        var oldEmail = (await MeAsync(ana)).Email;
        var newEmail = $"ana-noua-{Guid.NewGuid():N}@macromate.local";

        var wrong = await ana.PostAsJsonAsync("/api/auth/me/email", new { newEmail, currentPassword = "nu-e-asta-2026" });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);

        var asked = await ana.PostAsJsonAsync("/api/auth/me/email", new { newEmail, currentPassword = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.Accepted, asked.StatusCode);
        Assert.Equal(oldEmail, (await MeAsync(ana)).Email);

        var query = QueryHelpers.ParseQuery(factory.Outbox.LinkFor(newEmail).Query);
        var confirmed = await factory.CreateClient().PostAsJsonAsync("/api/auth/confirm-email",
            new { userId = Guid.Parse(query["userId"].ToString()), email = query["email"].ToString(), token = query["token"].ToString() });
        Assert.Equal(HttpStatusCode.OK, confirmed.StatusCode);

        Assert.Equal(HttpStatusCode.OK, await LoginStatusAsync(newEmail, ApiFactory.Password));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginStatusAsync(oldEmail, ApiFactory.Password));
    }

    [Fact]
    public async Task The_name_can_be_changed_but_not_emptied()
    {
        var ana = await factory.NewUserAsync("Ana");

        var renamed = await ana.PutAsJsonAsync("/api/auth/me/name", new { displayName = "  Ana Maria " });
        Assert.Equal("Ana Maria", (await renamed.Content.ReadFromJsonAsync<MeResponse>(JsonSerializerOptions.Web))!.DisplayName);
        Assert.Equal(HttpStatusCode.BadRequest, (await ana.PutAsJsonAsync("/api/auth/me/name", new { displayName = " " })).StatusCode);
    }
}
