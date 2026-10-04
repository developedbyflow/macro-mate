using MacroMate.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Sync;

public static class SyncWriter
{
    const long WriteLockKey = 7151;

    public static async Task<long> WriteAsync(AppDbContext db, Func<long, DateTimeOffset, Task> write, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({WriteLockKey})", ct);
        var version = await db.Database
            .SqlQueryRaw<long>("SELECT nextval('sync_version') AS \"Value\"")
            .SingleAsync(ct);

        await write(version, DateTimeOffset.UtcNow);

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return version;
    }
}
