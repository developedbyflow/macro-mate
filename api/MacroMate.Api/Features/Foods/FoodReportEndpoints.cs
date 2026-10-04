using MacroMate.Api.Data;
using MacroMate.Api.Features.Auth;
using MacroMate.Api.Features.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Foods;

public sealed record FoodReportRequest(string Message);

public static class FoodReportEndpoints
{
    public static void MapFoodReportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/foods/{foodId:guid}/reports", Report).RequireAuthorization().RequireRateLimiting(RateLimiting.Auth);
    }

    static async Task<IResult> Report(Guid foodId, FoodReportRequest request, AppDbContext db, CurrentUser me, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        var message = request.Message.Trim();
        if (message.Length is < 3 or > 500)
            return Results.Problem(messages["ReportMessageInvalid"], statusCode: StatusCodes.Status400BadRequest);
        if (!await db.Foods.AnyAsync(f => f.Id == foodId && f.KitchenId == null && f.DeletedAt == null, ct))
            return Results.NotFound();

        db.FoodReports.Add(new FoodReport { Id = Guid.NewGuid(), FoodId = foodId, UserId = me.Id, Message = message, CreatedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
}
