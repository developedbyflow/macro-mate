using MacroMate.Api.Data;
using MacroMate.Api.Features.Kitchens;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Auth;

public static class AccountService
{
    public static async Task<bool> IsLastAdminAsync(AppDbContext db, Guid userId, CancellationToken ct) =>
        await AppRoles.IsAdminAsync(db, userId, ct) && await AppRoles.AdminIds(db).CountAsync(ct) == 1;

    public static async Task DeleteAsync(AppDbContext db, UserManager<AppUser> users, AppUser user, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        await db.JournalEntries.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.DayPlans.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.WeightEntries.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.UserProfiles.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.FoodReports.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.AiUsage.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.KitchenInvites.Where(x => x.CreatedBy == user.Id).ExecuteDeleteAsync(ct);

        var others = await db.Users.Where(u => u.KitchenId == user.KitchenId && u.Id != user.Id).OrderBy(u => u.Id).Select(u => u.Id).ToListAsync(ct);
        if (others.Count == 0)
            await KitchenService.DeleteKitchenAsync(db, user.KitchenId, ct);
        else
            await db.Kitchens.Where(k => k.Id == user.KitchenId && k.OwnerId == user.Id).ExecuteUpdateAsync(s => s.SetProperty(k => k.OwnerId, others[0]), ct);

        if (user.ArchiveKitchenId is { } archive)
            await KitchenService.DeleteKitchenAsync(db, archive, ct);

        var result = await users.DeleteAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" ", result.Errors.Select(e => e.Description)));

        await tx.CommitAsync(ct);
    }
}
