using System.Text.Json;
using MacroMate.Api.Data;

namespace MacroMate.Api.Features.Sync;

public sealed record SyncChange(string Table, string Op, Guid Id, JsonElement? Data);

public sealed record SyncPushRequest(List<SyncChange> Changes);

public sealed record SyncRejected(string Table, Guid Id, string Reason);

public sealed record SyncPushResponse(long Version, List<SyncRejected> Rejected);

public sealed record SyncUser(Guid Id, string DisplayName);

public sealed class SyncPullResponse
{
    public required long Cursor { get; init; }
    public required Guid KitchenId { get; init; }
    public required List<SyncUser> Users { get; init; }
    public required List<Food> Foods { get; init; }
    public required List<Recipe> Recipes { get; init; }
    public required List<RecipeVariant> RecipeVariants { get; init; }
    public required List<MealPlan> MealPlans { get; init; }
    public required List<ShoppingList> ShoppingLists { get; init; }
    public required List<PantryItem> PantryItems { get; init; }
    public required List<DayPlan> DayPlans { get; init; }
    public required List<JournalEntry> JournalEntries { get; init; }
    public required List<UserProfile> UserProfiles { get; init; }
    public required List<WeightEntry> WeightEntries { get; init; }
}
