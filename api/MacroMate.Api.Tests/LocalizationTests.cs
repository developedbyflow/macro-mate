using System.Collections;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Resources;
using MacroMate.Api.Features.Kitchens;
using Microsoft.AspNetCore.Mvc;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class LocalizationTests(ApiFactory factory)
{
    static async Task<(HttpStatusCode Status, string? Detail)> SendAsync(HttpClient client, HttpMethod method, string url, string? language, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        if (language is not null)
            request.Headers.Add("Accept-Language", language);

        using var response = await client.SendAsync(request);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        return (response.StatusCode, problem?.Detail);
    }

    [Theory]
    [InlineData("en", "Wrong email or password.")]
    [InlineData("en-US,en;q=0.9", "Wrong email or password.")]
    [InlineData("ro", "Email sau parolă greșită.")]
    [InlineData(null, "Email sau parolă greșită.")]
    public async Task A_wrong_login_answers_in_the_language_of_the_request(string? language, string expected)
    {
        var login = new { email = $"nimeni-{Guid.NewGuid():N}@macromate.local", password = "parola-gresita" };

        var (status, detail) = await SendAsync(factory.CreateClient(), HttpMethod.Post, "/api/auth/login", language, login);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal(expected, detail);
    }

    [Theory]
    [InlineData("en", "A barcode has only digits, between 6 and 32.")]
    [InlineData("ro", "Codul de bare are doar cifre, între 6 și 32.")]
    public async Task An_invalid_barcode_answers_in_the_language_of_the_request(string language, string expected)
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);

        var (status, detail) = await SendAsync(florin, HttpMethod.Get, "/api/barcode/abc", language);

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(expected, detail);
    }

    [Theory]
    [InlineData("en", "The password must have at least 10 characters.")]
    [InlineData("ro", "Parola trebuie să aibă cel puțin 10 caractere.")]
    public async Task A_short_password_at_sign_up_answers_in_the_language_of_the_request(string language, string expected)
    {
        var ana = await factory.NewUserAsync("Ana");
        var invite = await (await ana.PostAsync("/api/kitchen/invites", null)).Content.ReadFromJsonAsync<InviteCreated>();
        var token = invite!.Token;
        var signUp = new { token, email = $"maria-{Guid.NewGuid():N}@macromate.local", displayName = "Maria", password = "scurta" };

        var (status, detail) = await SendAsync(factory.CreateClient(), HttpMethod.Post, $"/api/invites/{token}/register", language, signUp);

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(expected, detail);
    }

    [Fact]
    public void Every_message_has_an_english_text()
    {
        var resources = new ResourceManager("MacroMate.Api.Resources.Messages", typeof(Messages).Assembly);

        var romanian = Keys(resources.GetResourceSet(CultureInfo.InvariantCulture, createIfNotExists: true, tryParents: false));
        var english = Keys(resources.GetResourceSet(CultureInfo.GetCultureInfo("en"), createIfNotExists: true, tryParents: false));

        Assert.NotEmpty(romanian);
        Assert.Equal(romanian, english);
    }

    static SortedSet<string> Keys(ResourceSet? set) =>
        new(set?.Cast<DictionaryEntry>().Select(e => (string)e.Key) ?? []);
}
