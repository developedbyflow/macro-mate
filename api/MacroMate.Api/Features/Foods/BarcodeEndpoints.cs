namespace MacroMate.Api.Features.Foods;

public static class BarcodeEndpoints
{
    public static void MapBarcodeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/barcode/{code}", Lookup).RequireAuthorization().Produces<BarcodeProduct>();
    }

    static async Task<IResult> Lookup(string code, OpenFoodFactsClient off, CancellationToken ct)
    {
        if (code.Length is < 6 or > 32 || !code.All(char.IsAsciiDigit))
            return Results.Problem("Codul de bare are doar cifre, între 6 și 32.", statusCode: StatusCodes.Status400BadRequest);

        var product = await off.FindAsync(code, ct);
        return product is null
            ? Results.Problem("Produsul nu e în Open Food Facts.", statusCode: StatusCodes.Status404NotFound)
            : Results.Ok(product);
    }
}
