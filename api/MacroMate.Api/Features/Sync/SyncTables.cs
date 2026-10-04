using System.Text.Json;
using MacroMate.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Sync;

public interface ISyncTable
{
    Task<string?> ApplyAsync(AppDbContext db, Guid userId, SyncChange change, long version, DateTimeOffset now, CancellationToken ct);
}

public abstract class SyncTable<T>(Func<T, string?> validate) : ISyncTable where T : SyncEntity
{
    protected abstract bool IsOwnedBy(T entity, Guid userId);
    protected abstract void SetOwner(T entity, Guid userId);
    protected virtual bool CanCreate(Guid id, Guid userId) => true;

    public async Task<string?> ApplyAsync(AppDbContext db, Guid userId, SyncChange change, long version, DateTimeOffset now, CancellationToken ct)
    {
        var existing = await db.Set<T>().FindAsync([change.Id], ct);
        if (existing is not null && !IsOwnedBy(existing, userId))
            return "not-owner";

        if (change.Op == "delete")
        {
            if (existing is null || existing.DeletedAt is not null)
                return null;
            existing.DeletedAt = now;
            existing.UpdatedAt = now;
            existing.Version = version;
            return null;
        }

        if (change.Op != "upsert")
            return "unknown-op";
        if (change.Data is not { } data)
            return "missing-data";

        T? incoming;
        try
        {
            incoming = data.Deserialize<T>(JsonSerializerOptions.Web);
        }
        catch (JsonException)
        {
            return "invalid-data";
        }
        if (incoming is null)
            return "invalid-data";

        var error = validate(incoming);
        if (error is not null)
            return error;

        incoming.UpdatedAt = now;
        incoming.Version = version;

        if (existing is null)
        {
            if (!CanCreate(change.Id, userId))
                return "cannot-create";
            incoming.Id = change.Id;
            incoming.CreatedAt = now;
            incoming.DeletedAt = null;
            SetOwner(incoming, userId);
            db.Add(incoming);
            return null;
        }

        if (existing.DeletedAt is not null)
            return "deleted";

        incoming.KeepServerFieldsFrom(existing);
        db.Entry(existing).State = EntityState.Detached;
        db.Update(incoming);
        return null;
    }
}

public sealed class SharedTable<T>(Func<T, string?> validate) : SyncTable<T>(validate) where T : SharedEntity
{
    protected override bool IsOwnedBy(T entity, Guid userId) => true;
    protected override void SetOwner(T entity, Guid userId) => entity.CreatedBy = userId;
}

public sealed class PersonalTable<T>(Func<T, string?> validate, bool idMustBeUserId = false)
    : SyncTable<T>(validate) where T : PersonalEntity
{
    protected override bool IsOwnedBy(T entity, Guid userId) => entity.UserId == userId;
    protected override void SetOwner(T entity, Guid userId) => entity.UserId = userId;
    protected override bool CanCreate(Guid id, Guid userId) => !idMustBeUserId || id == userId;
}

public static class SyncTables
{
    public static readonly IReadOnlyDictionary<string, ISyncTable> All = new Dictionary<string, ISyncTable>
    {
        ["foods"] = new SharedTable<Food>(SyncRules.Food),
        ["recipes"] = new SharedTable<Recipe>(SyncRules.Recipe),
        ["recipeVariants"] = new SharedTable<RecipeVariant>(SyncRules.RecipeVariant),
        ["mealPlans"] = new SharedTable<MealPlan>(SyncRules.MealPlan),
        ["shoppingLists"] = new SharedTable<ShoppingList>(SyncRules.ShoppingList),
        ["dayPlans"] = new PersonalTable<DayPlan>(SyncRules.DayPlan),
        ["journalEntries"] = new PersonalTable<JournalEntry>(SyncRules.JournalEntry),
        ["userProfiles"] = new PersonalTable<UserProfile>(SyncRules.UserProfile, idMustBeUserId: true),
    };
}
