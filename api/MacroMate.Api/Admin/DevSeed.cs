using MacroMate.Api.Data;
using MacroMate.Api.Features.Kitchens;
using Microsoft.AspNetCore.Identity;

namespace MacroMate.Api.Admin;

public sealed class DevSeedOptions
{
    public string Password { get; set; } = "";
    public List<DevSeedUser> Users { get; set; } = [];
}

public sealed class DevSeedUser
{
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
}

public static class DevSeed
{
    public static async Task RunAsync(IServiceProvider services, DevSeedOptions options, CancellationToken ct)
    {
        if (options.Users.Count == 0 || string.IsNullOrEmpty(options.Password))
            return;

        var users = services.GetRequiredService<UserManager<AppUser>>();
        var db = services.GetRequiredService<AppDbContext>();
        AppUser? first = null;
        foreach (var seed in options.Users)
        {
            var user = await users.FindByEmailAsync(seed.Email);
            if (user is null)
            {
                var (created, errors) = await KitchenService.CreateUserAsync(users, db, seed.Email, seed.Name, options.Password, null, true, ct);
                user = created ?? throw new InvalidOperationException(string.Join(" ", errors));
            }
            first ??= user;
        }

        if (!await users.IsInRoleAsync(first!, AppRoles.Admin))
            await users.AddToRoleAsync(first!, AppRoles.Admin);
        await SeedFoods.RunAsync(db, first!.Id, ct);
    }
}
