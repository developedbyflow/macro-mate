using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Foods;

public static class BarcodeEndpoints
{
    public static void MapBarcodeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/barcode/{code}", Lookup).RequireAuthorization().Produces<BarcodeProduct>();
    }

    static async Task<IResult> Lookup(string code, OpenFoodFactsClient off, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        if (code.Length is < 6 or > 32 || !code.All(char.IsAsciiDigit))
            return Results.Problem(messages["InvalidBarcode"], statusCode: StatusCodes.Status400BadRequest);

        var product = await off.FindAsync(code, ct);
        return product is null
            ? Results.Problem(messages["ProductNotFound"], statusCode: StatusCodes.Status404NotFound)
            : Results.Ok(product);
    }
}
