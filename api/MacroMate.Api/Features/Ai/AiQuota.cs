using MacroMate.Api.Data;
using MacroMate.Api.Features.Auth;
using MacroMate.Api.Features.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Options;

namespace MacroMate.Api.Features.Ai;

public sealed class AiQuotaFilter(AppDbContext db, CurrentUser me, IOptions<RateLimitOptions> options, IStringLocalizer<Messages> messages) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var ct = context.HttpContext.RequestAborted;
        var userId = me.Id;
        var day = DateOnly.FromDateTime(DateTime.UtcNow);

        if (await AppRoles.IsAdminAsync(db, userId, ct))
            return await next(context);

        var limits = options.Value;
        var isDemo = await db.Users.Where(u => u.Id == userId).Select(u => u.IsDemo).SingleAsync(ct);
        var perUser = isDemo ? limits.AiPerDemoPerDay : limits.AiPerUserPerDay;
        var used = await db.AiUsage.Where(u => u.UserId == userId && u.Day == day).Select(u => u.Count).SingleOrDefaultAsync(ct);
        if (used >= perUser)
            return Results.Problem(messages["AiDailyLimit", perUser], statusCode: StatusCodes.Status429TooManyRequests);
        var total = await db.AiUsage.Where(u => u.Day == day).SumAsync(u => u.Count, ct);
        if (total >= limits.AiTotalPerDay)
            return Results.Problem(messages["AiTotalLimit"], statusCode: StatusCodes.Status429TooManyRequests);

        await db.Database.ExecuteSqlAsync(
            $"INSERT INTO ai_usage (user_id, day, count) VALUES ({userId}, {day}, 1) ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1",
            ct);
        return await next(context);
    }
}
