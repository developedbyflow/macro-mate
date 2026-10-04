using System.Security.Cryptography;
using MacroMate.Api.Data;
using MacroMate.Api.Features.Sync;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Localization;

namespace MacroMate.Api.Features.Kitchens;

public sealed record KitchenError(string Message, int Status);

public static class KitchenService
{
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);

    public static async Task<(AppUser? User, IEnumerable<string> Errors)> CreateUserAsync(
        UserManager<AppUser> users,
        AppDbContext db,
        string email,
        string displayName,
        string password,
        Guid? kitchenId,
        CancellationToken ct)
    {
        var user = new AppUser { Id = Guid.NewGuid(), UserName = email, Email = email, DisplayName = displayName };
        if (kitchenId is { } existing)
        {
            user.KitchenId = existing;
        }
        else
        {
            user.KitchenId = Guid.NewGuid();
            db.Kitchens.Add(new Kitchen { Id = user.KitchenId, OwnerId = user.Id, CreatedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync(ct);
        }

        var result = await users.CreateAsync(user, password);
        return result.Succeeded ? (user, []) : (null, result.Errors.Select(e => e.Description).Distinct());
    }

    public static async Task<KitchenInvite> CreateInviteAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var kitchenId = await KitchenOf(db, userId, ct);
        var now = DateTimeOffset.UtcNow;
        var invite = new KitchenInvite
        {
            Token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(24)),
            KitchenId = kitchenId,
            CreatedBy = userId,
            CreatedAt = now,
            ExpiresAt = now + InviteLifetime,
        };
        db.KitchenInvites.Add(invite);
        await db.SaveChangesAsync(ct);
        return invite;
    }

    public static async Task<KitchenInvite?> FindValidInviteAsync(AppDbContext db, string token, CancellationToken ct)
    {
        var invite = await db.KitchenInvites.FindAsync([token], ct);
        return invite is { UsedAt: null } && invite.ExpiresAt > DateTimeOffset.UtcNow ? invite : null;
    }

    public static async Task<KitchenError?> JoinAsync(AppDbContext db, Guid userId, string token, bool bringMine, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        KitchenError? error = null;
        await SyncWriter.WriteAsync(db, async (version, now) =>
        {
            var invite = await FindValidInviteAsync(db, token, ct);
            if (invite is null)
            {
                error = new KitchenError(messages["InviteExpired"], StatusCodes.Status410Gone);
                return;
            }

            var user = await db.Users.SingleAsync(u => u.Id == userId, ct);
            if (user.KitchenId == invite.KitchenId)
            {
                error = new KitchenError(messages["AlreadyInKitchen"], StatusCodes.Status409Conflict);
                return;
            }
            if (await db.Users.CountAsync(u => u.KitchenId == user.KitchenId, ct) > 1)
            {
                error = new KitchenError(messages["LeaveSharedKitchenFirst"], StatusCodes.Status409Conflict);
                return;
            }

            var previous = user.KitchenId;
            if (bringMine)
                await MoveContentsAsync(db, previous, invite.KitchenId, version, now, ct);
            else if (user.ArchiveKitchenId is { } archive)
                await MoveContentsAsync(db, previous, archive, version, now, ct);
            else if (await HasContentAsync(db, previous, ct))
                user.ArchiveKitchenId = previous;

            user.KitchenId = invite.KitchenId;
            invite.UsedAt = now;
            invite.UsedBy = userId;
        }, ct);
        return error;
    }

    public static async Task<KitchenError?> LeaveAsync(AppDbContext db, Guid userId, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        KitchenError? error = null;
        await SyncWriter.WriteAsync(db, async (version, now) =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == userId, ct);
            if (await db.Users.CountAsync(u => u.KitchenId == user.KitchenId, ct) < 2)
            {
                error = new KitchenError(messages["AloneInKitchen"], StatusCodes.Status409Conflict);
                return;
            }

            var shared = await db.Kitchens.SingleAsync(k => k.Id == user.KitchenId, ct);
            if (shared.OwnerId == userId)
                shared.OwnerId = await db.Users.Where(u => u.KitchenId == shared.Id && u.Id != userId).OrderBy(u => u.Id).Select(u => u.Id).FirstAsync(ct);

            var kitchen = new Kitchen { Id = Guid.NewGuid(), OwnerId = userId, CreatedAt = now };
            db.Kitchens.Add(kitchen);
            await CopyContentsAsync(db, user.KitchenId, kitchen.Id, userId, version, now, ct);
            user.KitchenId = kitchen.Id;
        }, ct);
        return error;
    }

    public static async Task<KitchenError?> RemoveMemberAsync(AppDbContext db, Guid userId, Guid memberId, IStringLocalizer<Messages> messages, CancellationToken ct)
    {
        if (userId == memberId)
            return new KitchenError(messages["CannotRemoveYourself"], StatusCodes.Status400BadRequest);
        var kitchenId = await KitchenOf(db, userId, ct);
        if (!await db.Users.AnyAsync(u => u.Id == memberId && u.KitchenId == kitchenId, ct))
            return new KitchenError(messages["MemberNotInKitchen"], StatusCodes.Status404NotFound);
        if (!await db.Kitchens.AnyAsync(k => k.Id == kitchenId && k.OwnerId == userId, ct))
            return new KitchenError(messages["OnlyOwnerCanRemove"], StatusCodes.Status403Forbidden);
        return await LeaveAsync(db, memberId, messages, ct);
    }

    public static async Task RestoreArchiveAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        await SyncWriter.WriteAsync(db, async (version, now) =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == userId, ct);
            if (user.ArchiveKitchenId is not { } archive)
                return;
            await MoveContentsAsync(db, archive, user.KitchenId, version, now, ct);
            user.ArchiveKitchenId = null;
        }, ct);
    }

    public static async Task<ArchiveSummary?> ArchiveSummaryAsync(AppDbContext db, Guid? archiveId, CancellationToken ct)
    {
        if (archiveId is not { } id)
            return null;
        return new ArchiveSummary(
            await db.Recipes.CountAsync(r => r.KitchenId == id && r.DeletedAt == null, ct),
            await db.MealPlans.CountAsync(p => p.KitchenId == id && p.DeletedAt == null, ct),
            await db.ShoppingLists.CountAsync(s => s.KitchenId == id && s.DeletedAt == null, ct),
            await db.PantryItems.CountAsync(p => p.KitchenId == id && p.DeletedAt == null, ct));
    }

    static Task<Guid> KitchenOf(AppDbContext db, Guid userId, CancellationToken ct) =>
        db.Users.Where(u => u.Id == userId).Select(u => u.KitchenId).SingleAsync(ct);

    static async Task<bool> HasContentAsync(AppDbContext db, Guid kitchenId, CancellationToken ct) =>
        await db.Recipes.AnyAsync(r => r.KitchenId == kitchenId && r.DeletedAt == null, ct)
        || await db.MealPlans.AnyAsync(p => p.KitchenId == kitchenId && p.DeletedAt == null, ct)
        || await db.ShoppingLists.AnyAsync(s => s.KitchenId == kitchenId && s.DeletedAt == null, ct)
        || await db.PantryItems.AnyAsync(p => p.KitchenId == kitchenId && p.DeletedAt == null, ct);

    static async Task MoveContentsAsync(AppDbContext db, Guid from, Guid to, long version, DateTimeOffset now, CancellationToken ct)
    {
        await MoveAsync(db.Recipes, from, to, version, now, ct);
        await MoveAsync(db.RecipeVariants, from, to, version, now, ct);
        await MoveAsync(db.MealPlans, from, to, version, now, ct);
        await MoveAsync(db.ShoppingLists, from, to, version, now, ct);

        var items = await db.PantryItems.Where(p => p.KitchenId == from && p.DeletedAt == null).ToListAsync(ct);
        foreach (var item in items)
        {
            await AddToPantryAsync(db, to, item.FoodId, item.CreatedBy, version, now, ct);
            item.DeletedAt = now;
            item.UpdatedAt = now;
            item.Version = version;
        }
    }

    static Task MoveAsync<T>(DbSet<T> set, Guid from, Guid to, long version, DateTimeOffset now, CancellationToken ct) where T : KitchenEntity =>
        set.Where(x => x.KitchenId == from && x.DeletedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.KitchenId, to).SetProperty(x => x.Version, version).SetProperty(x => x.UpdatedAt, now), ct);

    static async Task AddToPantryAsync(AppDbContext db, Guid kitchenId, Guid foodId, Guid createdBy, long version, DateTimeOffset now, CancellationToken ct)
    {
        var id = PantryItem.IdFor(kitchenId, foodId);
        var existing = await db.PantryItems.FindAsync([id], ct);
        if (existing is null)
        {
            db.PantryItems.Add(new PantryItem
            {
                Id = id,
                KitchenId = kitchenId,
                FoodId = foodId,
                CreatedBy = createdBy,
                CreatedAt = now,
                UpdatedAt = now,
                Version = version,
            });
        }
        else if (existing.DeletedAt is not null)
        {
            existing.DeletedAt = null;
            existing.UpdatedAt = now;
            existing.Version = version;
        }
    }

    static async Task CopyContentsAsync(AppDbContext db, Guid from, Guid to, Guid userId, long version, DateTimeOffset now, CancellationToken ct)
    {
        void Stamp(KitchenEntity row, Guid id)
        {
            row.Id = id;
            row.KitchenId = to;
            row.CreatedAt = now;
            row.UpdatedAt = now;
            row.Version = version;
        }

        var recipes = await db.Recipes.AsNoTracking().Where(r => r.KitchenId == from && r.DeletedAt == null).ToListAsync(ct);
        var recipeIds = recipes.ToDictionary(r => r.Id, _ => Guid.NewGuid());
        foreach (var recipe in recipes)
        {
            Stamp(recipe, recipeIds[recipe.Id]);
            db.Recipes.Add(recipe);
        }

        var variants = await db.RecipeVariants.AsNoTracking().Where(v => v.KitchenId == from && v.DeletedAt == null).ToListAsync(ct);
        var variantIds = new Dictionary<Guid, Guid>();
        foreach (var variant in variants.Where(v => recipeIds.ContainsKey(v.RecipeId)))
        {
            variantIds[variant.Id] = Guid.NewGuid();
            variant.RecipeId = recipeIds[variant.RecipeId];
            Stamp(variant, variantIds[variant.Id]);
            db.RecipeVariants.Add(variant);
        }

        var plans = await db.MealPlans.AsNoTracking().Where(p => p.KitchenId == from && p.DeletedAt == null).ToListAsync(ct);
        var planIds = plans.ToDictionary(p => p.Id, _ => Guid.NewGuid());
        foreach (var plan in plans)
        {
            foreach (var item in plan.Meals.SelectMany(m => m.Items))
                if (item.VariantId is { } variantId && variantIds.TryGetValue(variantId, out var copy))
                    item.VariantId = copy;
            Stamp(plan, planIds[plan.Id]);
            db.MealPlans.Add(plan);
        }

        var lists = await db.ShoppingLists.AsNoTracking().Where(s => s.KitchenId == from && s.DeletedAt == null).ToListAsync(ct);
        foreach (var list in lists)
        {
            foreach (var entry in list.Plans)
                if (planIds.TryGetValue(entry.MealPlanId, out var copy))
                    entry.MealPlanId = copy;
            Stamp(list, Guid.NewGuid());
            db.ShoppingLists.Add(list);
        }

        var pantry = await db.PantryItems.AsNoTracking().Where(p => p.KitchenId == from && p.DeletedAt == null).ToListAsync(ct);
        foreach (var item in pantry)
            await AddToPantryAsync(db, to, item.FoodId, item.CreatedBy, version, now, ct);

        foreach (var dayPlan in await db.DayPlans.Where(d => d.UserId == userId && d.MealPlanId != null).ToListAsync(ct))
        {
            if (!planIds.TryGetValue(dayPlan.MealPlanId!.Value, out var copy))
                continue;
            dayPlan.MealPlanId = copy;
            dayPlan.UpdatedAt = now;
            dayPlan.Version = version;
        }

        foreach (var entry in await db.JournalEntries.Where(j => j.UserId == userId && j.VariantId != null).ToListAsync(ct))
        {
            if (!variantIds.TryGetValue(entry.VariantId!.Value, out var copy))
                continue;
            entry.VariantId = copy;
            entry.UpdatedAt = now;
            entry.Version = version;
        }
    }
}

public sealed record ArchiveSummary(int Recipes, int MealPlans, int ShoppingLists, int PantryItems);
