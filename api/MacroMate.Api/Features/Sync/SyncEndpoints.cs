using System.Data;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Auth;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Sync;

public static class SyncEndpoints
{
    public static void MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sync").RequireAuthorization();
        group.MapGet("", Pull);
        group.MapPost("", Push).Produces<SyncPushResponse>();
    }

    static async Task<SyncPullResponse> Pull(long since, AppDbContext db, CurrentUser me, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct);
        var userId = me.Id;

        var users = await db.Users.AsNoTracking().Select(u => new SyncUser(u.Id, u.DisplayName)).ToListAsync(ct);
        var foods = await db.Foods.AsNoTracking().Where(x => x.Version > since).ToListAsync(ct);
        var recipes = await db.Recipes.AsNoTracking().Where(x => x.Version > since).ToListAsync(ct);
        var variants = await db.RecipeVariants.AsNoTracking().Where(x => x.Version > since).ToListAsync(ct);
        var mealPlans = await db.MealPlans.AsNoTracking().Where(x => x.Version > since).ToListAsync(ct);
        var shoppingLists = await db.ShoppingLists.AsNoTracking().Where(x => x.Version > since).ToListAsync(ct);
        var dayPlans = await db.DayPlans.AsNoTracking().Where(x => x.UserId == userId && x.Version > since).ToListAsync(ct);
        var journal = await db.JournalEntries.AsNoTracking().Where(x => x.UserId == userId && x.Version > since).ToListAsync(ct);
        var profiles = await db.UserProfiles.AsNoTracking().Where(x => x.UserId == userId && x.Version > since).ToListAsync(ct);
        var weights = await db.WeightEntries.AsNoTracking().Where(x => x.UserId == userId && x.Version > since).ToListAsync(ct);

        await tx.CommitAsync(ct);

        IEnumerable<SyncEntity> all = [.. foods, .. recipes, .. variants, .. mealPlans, .. shoppingLists, .. dayPlans, .. journal, .. profiles, .. weights];

        return new SyncPullResponse
        {
            Cursor = all.Select(x => x.Version).DefaultIfEmpty(since).Max(),
            Users = users,
            Foods = foods,
            Recipes = recipes,
            RecipeVariants = variants,
            MealPlans = mealPlans,
            ShoppingLists = shoppingLists,
            DayPlans = dayPlans,
            JournalEntries = journal,
            UserProfiles = profiles,
            WeightEntries = weights,
        };
    }

    static async Task<IResult> Push(SyncPushRequest request, AppDbContext db, CurrentUser me, CancellationToken ct)
    {
        if (request.Changes.Count > 2000)
            return Results.Problem("Prea multe modificări într-o singură cerere.", statusCode: 413);

        var latestPerRow = request.Changes
            .Select((change, index) => (change, index))
            .GroupBy(x => (x.change.Table, x.change.Id))
            .Select(g => g.MaxBy(x => x.index))
            .OrderBy(x => x.index)
            .Select(x => x.change)
            .ToList();

        var rejected = new List<SyncRejected>();
        var version = await SyncWriter.WriteAsync(db, async (version, now) =>
        {
            foreach (var change in latestPerRow)
            {
                if (!SyncTables.All.TryGetValue(change.Table, out var table))
                {
                    rejected.Add(new SyncRejected(change.Table, change.Id, "unknown-table"));
                    continue;
                }
                var reason = await table.ApplyAsync(db, me.Id, change, version, now, ct);
                if (reason is not null)
                    rejected.Add(new SyncRejected(change.Table, change.Id, reason));
            }
        }, ct);

        return Results.Ok(new SyncPushResponse(version, rejected));
    }
}
