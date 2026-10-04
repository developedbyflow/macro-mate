using MacroMate.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Auth;

public sealed class DemoCleanup(IServiceScopeFactory scopes, ILogger<DemoCleanup> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30));
        do
        {
            try
            {
                var deleted = await DeleteExpiredAsync(scopes, DateTimeOffset.UtcNow, stoppingToken);
                if (deleted > 0)
                    logger.LogInformation("Deleted {Count} expired demo accounts", deleted);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Deleting expired demo accounts failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public static async Task<int> DeleteExpiredAsync(IServiceScopeFactory scopes, DateTimeOffset now, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var expired = await db.Users.Where(u => u.IsDemo && u.DemoExpiresAt < now).ToListAsync(ct);
        foreach (var user in expired)
            await AccountService.DeleteAsync(db, users, user, ct);
        return expired.Count;
    }
}
