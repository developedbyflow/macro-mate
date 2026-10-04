using System.Globalization;
using System.Text;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Auth;
using MacroMate.Api.Features.Sync;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Admin;

public sealed record AdminUser(Guid Id, string DisplayName, string Email, bool IsAdmin, bool EmailConfirmed);

public sealed record SetRoleRequest(bool Admin);

public sealed record FoodDemand(Guid FoodId, string Name, string? NameEn, string? Brand, string? Barcode, string Category, int Kitchens, bool InBase);

public sealed record PromotedFood(Guid FoodId);

public sealed record OpenReport(Guid Id, Guid FoodId, string FoodName, string Message, string ReporterName, DateTimeOffset CreatedAt);

public sealed class AdminOnly(AppDbContext db, CurrentUser me) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next) =>
        await AppRoles.IsAdminAsync(db, me.Id, context.HttpContext.RequestAborted) ? await next(context) : Results.StatusCode(StatusCodes.Status403Forbidden);
}

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").RequireAuthorization().AddEndpointFilter<AdminOnly>();
        group.MapGet("/users", Users).Produces<List<AdminUser>>();
        group.MapPut("/users/{userId:guid}/role", SetRole).Produces<AdminUser>();
        group.MapGet("/food-demand", Demand).Produces<List<FoodDemand>>();
        group.MapPost("/food-demand/{foodId:guid}/promote", Promote).Produces<PromotedFood>();
        group.MapGet("/reports", Reports).Produces<List<OpenReport>>();
        group.MapPost("/reports/{reportId:guid}/resolve", Resolve);
    }

    static async Task<List<AdminUser>> Users(AppDbContext db, CancellationToken ct)
    {
        var admins = (await AppRoles.AdminIds(db).ToListAsync(ct)).ToHashSet();
        var users = await db.Users.AsNoTracking().Where(u => !u.IsDemo).OrderBy(u => u.DisplayName).ToListAsync(ct);
        return users.Select(u => new AdminUser(u.Id, u.DisplayName, u.Email!, admins.Contains(u.Id), u.EmailConfirmed)).ToList();
    }

    static async Task<IResult> SetRole(Guid userId, SetRoleRequest request, AppDbContext db, UserManager<AppUser> users, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null || user.IsDemo)
            return Results.NotFound();

        var isAdmin = await users.IsInRoleAsync(user, AppRoles.Admin);
        if (request.Admin && !isAdmin)
            await users.AddToRoleAsync(user, AppRoles.Admin);
        else if (!request.Admin && isAdmin)
        {
            if (await AccountService.IsLastAdminAsync(db, user.Id, ct))
                return Results.Problem(messages["LastAdmin"], statusCode: StatusCodes.Status409Conflict);
            await users.RemoveFromRoleAsync(user, AppRoles.Admin);
        }
        return Results.Ok(new AdminUser(user.Id, user.DisplayName, user.Email!, request.Admin, user.EmailConfirmed));
    }

    public static string NormalizeName(string name)
    {
        var decomposed = name.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                builder.Append(char.IsWhiteSpace(c) ? ' ' : c);
        return string.Join(' ', builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    static string KeyOf(Food food) => !string.IsNullOrWhiteSpace(food.Barcode) ? $"barcode:{food.Barcode}" : $"name:{NormalizeName(food.Name)}";

    static async Task<List<FoodDemand>> Demand(AppDbContext db, CancellationToken ct)
    {
        var demoKitchens = db.Users.Where(u => u.IsDemo).Select(u => u.KitchenId);
        var kitchenFoods = await db.Foods.AsNoTracking()
            .Where(f => f.KitchenId != null && f.DeletedAt == null && !demoKitchens.Contains(f.KitchenId!.Value))
            .ToListAsync(ct);
        var baseKeys = (await db.Foods.AsNoTracking().Where(f => f.KitchenId == null && f.DeletedAt == null).ToListAsync(ct))
            .SelectMany(f => new[] { KeyOf(f), $"name:{NormalizeName(f.Name)}" })
            .ToHashSet();

        return kitchenFoods
            .GroupBy(KeyOf)
            .Select(g =>
            {
                var sample = g.OrderByDescending(f => f.UpdatedAt).First();
                return new FoodDemand(sample.Id, sample.Name, sample.NameEn, sample.Brand, sample.Barcode, sample.Category,
                    g.Select(f => f.KitchenId).Distinct().Count(), baseKeys.Contains(g.Key));
            })
            .OrderBy(d => d.InBase)
            .ThenByDescending(d => d.Kitchens)
            .ThenBy(d => d.Name)
            .Take(100)
            .ToList();
    }

    static async Task<IResult> Promote(Guid foodId, AppDbContext db, CurrentUser me, CancellationToken ct)
    {
        var source = await db.Foods.AsNoTracking().SingleOrDefaultAsync(f => f.Id == foodId && f.KitchenId != null && f.DeletedAt == null, ct);
        if (source is null)
            return Results.NotFound();

        var id = Guid.NewGuid();
        await SyncWriter.WriteAsync(db, (version, now) =>
        {
            source.Id = id;
            source.KitchenId = null;
            source.CreatedBy = me.Id;
            source.CreatedAt = now;
            source.UpdatedAt = now;
            source.Version = version;
            db.Foods.Add(source);
            return Task.CompletedTask;
        }, ct);
        return Results.Ok(new PromotedFood(id));
    }

    static async Task<List<OpenReport>> Reports(AppDbContext db, CancellationToken ct) =>
        await (from r in db.FoodReports.AsNoTracking()
               where r.ResolvedAt == null
               join f in db.Foods on r.FoodId equals f.Id
               join u in db.Users on r.UserId equals u.Id
               orderby r.CreatedAt
               select new OpenReport(r.Id, r.FoodId, f.Name, r.Message, u.DisplayName, r.CreatedAt)).ToListAsync(ct);

    static async Task<IResult> Resolve(Guid reportId, AppDbContext db, CancellationToken ct)
    {
        var updated = await db.FoodReports.Where(r => r.Id == reportId && r.ResolvedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.ResolvedAt, DateTimeOffset.UtcNow), ct);
        return updated == 0 ? Results.NotFound() : Results.NoContent();
    }
}
