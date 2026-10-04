using MacroMate.Api.Data;
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
        AppUser? first = null;
        foreach (var seed in options.Users)
        {
            var user = await users.FindByEmailAsync(seed.Email);
            if (user is null)
            {
                user = new AppUser { UserName = seed.Email, Email = seed.Email, DisplayName = seed.Name };
                var result = await users.CreateAsync(user, options.Password);
                if (!result.Succeeded)
                    throw new InvalidOperationException(string.Join(" ", result.Errors.Select(e => e.Description)));
            }
            first ??= user;
        }

        await SeedFoods.RunAsync(services.GetRequiredService<AppDbContext>(), first!.Id, ct);
    }
}
