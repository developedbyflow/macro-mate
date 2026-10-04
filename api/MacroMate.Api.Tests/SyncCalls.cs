using System.Net.Http.Json;
using System.Text.Json;
using MacroMate.Api.Features.Sync;

namespace MacroMate.Api.Tests;

public static class SyncCalls
{
    public static async Task<SyncPullResponse> PullAsync(HttpClient client, long since) =>
        (await client.GetFromJsonAsync<SyncPullResponse>($"/api/sync?since={since}", JsonSerializerOptions.Web))!;

    public static async Task<SyncPushResponse> PushAsync(HttpClient client, params object[] changes)
    {
        var response = await client.PostAsJsonAsync("/api/sync", new { changes });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SyncPushResponse>(JsonSerializerOptions.Web))!;
    }

    public static object Upsert(string table, Guid id, object data) => new { table, op = "upsert", id, data };
}
