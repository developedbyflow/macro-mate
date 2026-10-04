using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Data;

public static class AppRoles
{
    public const string Admin = "admin";

    public static async Task EnsureAsync(RoleManager<IdentityRole<Guid>> roles)
    {
        if (!await roles.RoleExistsAsync(Admin))
            await roles.CreateAsync(new IdentityRole<Guid>(Admin) { Id = Guid.NewGuid() });
    }

    public static Task<bool> IsAdminAsync(AppDbContext db, Guid userId, CancellationToken ct) =>
        db.UserRoles.AnyAsync(ur => ur.UserId == userId && db.Roles.Any(r => r.Id == ur.RoleId && r.NormalizedName == "ADMIN"), ct);

    public static IQueryable<Guid> AdminIds(AppDbContext db) =>
        db.UserRoles.Where(ur => db.Roles.Any(r => r.Id == ur.RoleId && r.NormalizedName == "ADMIN")).Select(ur => ur.UserId);
}
