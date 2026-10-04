using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class MealScanTests(ApiFactory factory)
{
    [Fact]
    public async Task Scanning_needs_a_login()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/ai/meals/scan", new { imageDataUrl = "data:image/jpeg;base64,AAAA" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Something_that_is_not_an_image_is_refused_before_calling_the_ai()
    {
        var ana = await factory.NewUserAsync("Ana");
        var response = await ana.PostAsJsonAsync("/api/ai/meals/scan", new { imageDataUrl = "https://example.com/plate.jpg" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var detail = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("detail").GetString();
        Assert.Equal("Poza trebuie să fie o imagine mai mică de 6 MB.", detail);
    }
}
