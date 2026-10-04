using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Features.Ai;

public sealed class DeepSeekOptions
{
    public string ApiKey { get; set; } = "";
    public string BaseUrl { get; set; } = "https://api.deepseek.com/";
    public string Model { get; set; } = "deepseek-flash";
}

public sealed class AiNotConfiguredException() : Exception("Cheia DeepSeek nu e setată.");

public sealed class AiFailedException(string message) : Exception(message);

public sealed class DeepSeekClient(HttpClient http, IOptions<DeepSeekOptions> options)
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ApiKey);

    public async Task<T> AskJsonAsync<T>(string system, string user, string? imageDataUrl, CancellationToken ct)
    {
        if (!IsConfigured)
            throw new AiNotConfiguredException();

        JsonNode userContent = imageDataUrl is null
            ? JsonValue.Create(user)
            : new JsonArray(
                new JsonObject { ["type"] = "text", ["text"] = user },
                new JsonObject
                {
                    ["type"] = "image_url",
                    ["image_url"] = new JsonObject { ["url"] = imageDataUrl, ["detail"] = "high" },
                });

        var body = new JsonObject
        {
            ["model"] = options.Value.Model,
            ["response_format"] = new JsonObject { ["type"] = "json_object" },
            ["messages"] = new JsonArray(
                new JsonObject { ["role"] = "system", ["content"] = system },
                new JsonObject { ["role"] = "user", ["content"] = userContent }),
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions")
        {
            Content = new StringContent(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ApiKey);

        using var response = await http.SendAsync(request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new AiFailedException($"DeepSeek a răspuns {(int)response.StatusCode}.");

        var content = JsonNode.Parse(raw)?["choices"]?[0]?["message"]?["content"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(content))
            throw new AiFailedException("DeepSeek a trimis un răspuns gol.");

        try
        {
            return JsonSerializer.Deserialize<T>(content, JsonSerializerOptions.Web)
                ?? throw new AiFailedException("DeepSeek a trimis JSON gol.");
        }
        catch (JsonException)
        {
            throw new AiFailedException("DeepSeek a trimis un JSON care nu se potrivește.");
        }
    }
}
