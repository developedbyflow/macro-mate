using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MacroMate.Api.Features.Sync;

namespace MacroMate.Api.Tests;

public sealed class SyncTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    static async Task<SyncPullResponse> PullAsync(HttpClient client, long since) =>
        (await client.GetFromJsonAsync<SyncPullResponse>($"/api/sync?since={since}", JsonSerializerOptions.Web))!;

    static async Task<SyncPushResponse> PushAsync(HttpClient client, params object[] changes)
    {
        var response = await client.PostAsJsonAsync("/api/sync", new { changes });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SyncPushResponse>(JsonSerializerOptions.Web))!;
    }

    static object Upsert(string table, Guid id, object data) => new { table, op = "upsert", id, data };

    [Fact]
    public async Task Requests_without_login_are_rejected()
    {
        var response = await factory.CreateClient().GetAsync("/api/sync?since=0");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_recipe_written_by_one_user_reaches_the_other()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var second = await factory.LoginAsync(ApiFactory.SecondEmail);
        var cursor = (await PullAsync(second, 0)).Cursor;

        var recipeId = Guid.NewGuid();
        await PushAsync(florin, Upsert("recipes", recipeId, new { name = "Omletă", difficulty = "easy", ingredientFoodIds = Array.Empty<Guid>() }));

        var pulled = await PullAsync(second, cursor);
        var recipe = Assert.Single(pulled.Recipes, r => r.Id == recipeId);
        Assert.Equal("Omletă", recipe.Name);
        Assert.True(pulled.Cursor > cursor);
    }

    [Fact]
    public async Task Server_fields_sent_by_the_client_are_ignored()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var me = (await PullAsync(florin, 0)).UserProfiles.Single().UserId;

        var recipeId = Guid.NewGuid();
        await PushAsync(florin, Upsert("recipes", recipeId, new
        {
            name = "Supă",
            difficulty = "easy",
            createdBy = Guid.NewGuid(),
            version = 999999,
        }));

        var recipe = (await PullAsync(florin, 0)).Recipes.Single(r => r.Id == recipeId);
        Assert.Equal(me, recipe.CreatedBy);
        Assert.NotEqual(999999, recipe.Version);
    }

    [Fact]
    public async Task A_deleted_row_comes_back_as_a_tombstone()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var recipeId = Guid.NewGuid();
        await PushAsync(florin, Upsert("recipes", recipeId, new { name = "De șters", difficulty = "easy" }));
        var cursor = (await PullAsync(florin, 0)).Cursor;

        await PushAsync(florin, new { table = "recipes", op = "delete", id = recipeId });

        var deleted = Assert.Single((await PullAsync(florin, cursor)).Recipes);
        Assert.Equal(recipeId, deleted.Id);
        Assert.NotNull(deleted.DeletedAt);
    }

    [Fact]
    public async Task Personal_rows_stay_with_their_owner()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var second = await factory.LoginAsync(ApiFactory.SecondEmail);

        var entryId = Guid.NewGuid();
        var entry = new { date = "2026-10-04", mealLabel = "Breakfast", kind = "food", name = "Măr", kcal = 94 };
        await PushAsync(florin, Upsert("journalEntries", entryId, entry));

        Assert.DoesNotContain((await PullAsync(second, 0)).JournalEntries, j => j.Id == entryId);

        var result = await PushAsync(second, Upsert("journalEntries", entryId, entry with { }));
        Assert.Contains(result.Rejected, r => r.Id == entryId && r.Reason == "not-owner");
    }

    [Fact]
    public async Task Weight_entries_are_personal_and_checked()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var second = await factory.LoginAsync(ApiFactory.SecondEmail);

        var entryId = Guid.NewGuid();
        var invalidId = Guid.NewGuid();
        var result = await PushAsync(florin,
            Upsert("weightEntries", entryId, new { date = "2026-10-04", weightKg = 83.6 }),
            Upsert("weightEntries", invalidId, new { date = "2026-10-04", weightKg = 8.36 }));

        Assert.Contains(result.Rejected, r => r.Id == invalidId && r.Reason == "invalid-weight");
        var entry = Assert.Single((await PullAsync(florin, 0)).WeightEntries, w => w.Id == entryId);
        Assert.Equal(83.6, entry.WeightKg);
        Assert.DoesNotContain((await PullAsync(second, 0)).WeightEntries, w => w.Id == entryId);
    }

    [Fact]
    public async Task A_goal_with_an_impossible_rate_is_rejected()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var me = (await PullAsync(florin, 0)).UserProfiles.Single().UserId;

        var result = await PushAsync(florin, Upsert("userProfiles", me, new { goal = "lose", goalWeightKg = 75, weeklyRateKg = 3 }));

        Assert.Contains(result.Rejected, r => r.Id == me && r.Reason == "invalid-weekly-rate");
    }

    [Fact]
    public async Task Invalid_rows_are_rejected_with_a_reason()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var foodId = Guid.NewGuid();

        var result = await PushAsync(florin, Upsert("foods", foodId, new { name = "Ceva", category = "nu-exista", kcal = 10 }));

        var rejected = Assert.Single(result.Rejected);
        Assert.Equal("invalid-category", rejected.Reason);
    }

    [Fact]
    public async Task Meal_plans_keep_their_meals()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var planId = Guid.NewGuid();
        var foodId = (await PullAsync(florin, 0)).Foods.First().Id;

        await PushAsync(florin, Upsert("mealPlans", planId, new
        {
            name = "Plan A",
            meals = new[]
            {
                new { id = Guid.NewGuid(), label = "Breakfast", items = new[] { new { id = Guid.NewGuid(), kind = "food", foodId, grams = 120.0 } } },
            },
        }));

        var plan = (await PullAsync(florin, 0)).MealPlans.Single(p => p.Id == planId);
        var meal = Assert.Single(plan.Meals);
        Assert.Equal("Breakfast", meal.Label);
        Assert.Equal(120, Assert.Single(meal.Items).Grams);
    }
}
