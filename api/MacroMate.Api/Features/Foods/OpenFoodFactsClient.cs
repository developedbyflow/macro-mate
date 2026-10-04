using System.Globalization;
using System.Text.Json;

namespace MacroMate.Api.Features.Foods;

public sealed record NutritionValues(
    double? Kcal,
    double? ProteinG,
    double? CarbsG,
    double? FatG,
    double? FiberG,
    double? SodiumMg);

public sealed record BarcodeProduct(string Barcode, string? Name, string? Brand, NutritionValues Values);

public sealed class OpenFoodFactsClient(HttpClient http)
{
    const string Fields = "code,product_name,product_name_ro,generic_name,brands,nutriments";

    public async Task<BarcodeProduct?> FindAsync(string barcode, CancellationToken ct)
    {
        using var response = await http.GetAsync($"api/v2/product/{Uri.EscapeDataString(barcode)}?fields={Fields}", ct);
        if (!response.IsSuccessStatusCode)
            return null;

        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var root = json.RootElement;
        if (!root.TryGetProperty("status", out var status) || status.GetInt32() != 1)
            return null;
        if (!root.TryGetProperty("product", out var product))
            return null;

        var name = Text(product, "product_name_ro") ?? Text(product, "product_name") ?? Text(product, "generic_name");
        var brand = Text(product, "brands")?.Split(',')[0].Trim();
        var n = product.TryGetProperty("nutriments", out var nutriments) ? nutriments : default;

        var kcal = Number(n, "energy-kcal_100g") ?? Number(n, "energy_100g") / 4.184;
        var sodiumMg = Number(n, "sodium_100g") * 1000 ?? Number(n, "salt_100g") * 400;

        var values = new NutritionValues(
            Round(kcal),
            Round(Number(n, "proteins_100g")),
            Round(Number(n, "carbohydrates_100g")),
            Round(Number(n, "fat_100g")),
            Round(Number(n, "fiber_100g")),
            Round(sodiumMg));

        return new BarcodeProduct(barcode, name, brand, values);
    }

    static string? Text(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(value.GetString())
            ? value.GetString()!.Trim()
            : null;

    static double? Number(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(property, out var value))
            return null;
        return value.ValueKind switch
        {
            JsonValueKind.Number => value.GetDouble(),
            JsonValueKind.String when double.TryParse(value.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null,
        };
    }

    static double? Round(double? value) => value is { } v ? Math.Round(v, 1) : null;
}
