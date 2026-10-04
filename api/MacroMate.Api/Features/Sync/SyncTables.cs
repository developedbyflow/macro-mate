using System.Text.Json;
using MacroMate.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace MacroMate.Api.Features.Sync;

public sealed record SyncActor(Guid UserId, Guid KitchenId, bool IsAdmin);

public interface ISyncTable
{
    Task<string?> ApplyAsync(AppDbContext db, SyncActor actor, SyncChange change, long version, DateTimeOffset now, CancellationToken ct);
}

public abstract class SyncTable<T>(Func<T, string?> validate) : ISyncTable where T : SyncEntity
{
    protected abstract Task<bool> IsOwnedByAsync(AppDbContext db, T entity, SyncActor actor, CancellationToken ct);
    protected abstract void SetOwner(T entity, SyncActor actor);
    protected virtual bool CanCreate(Guid id, T incoming, SyncActor actor) => true;
    protected virtual bool CanRevive => false;

    public async Task<string?> ApplyAsync(AppDbContext db, SyncActor actor, SyncChange change, long version, DateTimeOffset now, CancellationToken ct)
    {
        var existing = await db.Set<T>().FindAsync([change.Id], ct);
        if (existing is not null && !await IsOwnedByAsync(db, existing, actor, ct))
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
            if (!CanCreate(change.Id, incoming, actor))
                return "cannot-create";
            incoming.Id = change.Id;
            incoming.CreatedAt = now;
            incoming.DeletedAt = null;
            SetOwner(incoming, actor);
            db.Add(incoming);
            return null;
        }

        if (existing.DeletedAt is not null && !CanRevive)
            return "deleted";

        incoming.KeepServerFieldsFrom(existing);
        incoming.DeletedAt = null;
        db.Entry(existing).State = EntityState.Detached;
        db.Update(incoming);
        return null;
    }
}

public sealed class FoodTable() : SyncTable<Food>(SyncRules.Food)
{
    protected override Task<bool> IsOwnedByAsync(AppDbContext db, Food food, SyncActor actor, CancellationToken ct) =>
        Task.FromResult(food.KitchenId is { } kitchenId ? kitchenId == actor.KitchenId : actor.IsAdmin);

    protected override void SetOwner(Food food, SyncActor actor)
    {
        food.CreatedBy = actor.UserId;
        food.KitchenId = actor.IsAdmin && food.KitchenId is null ? null : actor.KitchenId;
    }
}

public class KitchenTable<T>(Func<T, string?> validate) : SyncTable<T>(validate) where T : KitchenEntity
{
    protected override Task<bool> IsOwnedByAsync(AppDbContext db, T entity, SyncActor actor, CancellationToken ct) =>
        Task.FromResult(entity.KitchenId == actor.KitchenId);

    protected override void SetOwner(T entity, SyncActor actor)
    {
        entity.CreatedBy = actor.UserId;
        entity.KitchenId = actor.KitchenId;
    }
}

public sealed class PantryTable() : KitchenTable<PantryItem>(SyncRules.PantryItem)
{
    protected override bool CanRevive => true;
    protected override bool CanCreate(Guid id, PantryItem incoming, SyncActor actor) => id == PantryItem.IdFor(actor.KitchenId, incoming.FoodId);
}

public sealed class PersonalTable<T>(Func<T, string?> validate, bool idMustBeUserId = false)
    : SyncTable<T>(validate) where T : PersonalEntity
{
    protected override Task<bool> IsOwnedByAsync(AppDbContext db, T entity, SyncActor actor, CancellationToken ct) =>
        Task.FromResult(entity.UserId == actor.UserId);

    protected override void SetOwner(T entity, SyncActor actor) => entity.UserId = actor.UserId;
    protected override bool CanCreate(Guid id, T incoming, SyncActor actor) => !idMustBeUserId || id == actor.UserId;
}

public static class SyncTables
{
    public static readonly IReadOnlyDictionary<string, ISyncTable> All = new Dictionary<string, ISyncTable>
    {
        ["foods"] = new FoodTable(),
        ["recipes"] = new KitchenTable<Recipe>(SyncRules.Recipe),
        ["recipeVariants"] = new KitchenTable<RecipeVariant>(SyncRules.RecipeVariant),
        ["mealPlans"] = new KitchenTable<MealPlan>(SyncRules.MealPlan),
        ["shoppingLists"] = new KitchenTable<ShoppingList>(SyncRules.ShoppingList),
        ["pantryItems"] = new PantryTable(),
        ["dayPlans"] = new PersonalTable<DayPlan>(SyncRules.DayPlan),
        ["journalEntries"] = new PersonalTable<JournalEntry>(SyncRules.JournalEntry),
        ["userProfiles"] = new PersonalTable<UserProfile>(SyncRules.UserProfile, idMustBeUserId: true),
        ["weightEntries"] = new PersonalTable<WeightEntry>(SyncRules.WeightEntry),
    };
}
