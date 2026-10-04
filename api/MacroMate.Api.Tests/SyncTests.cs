using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static MacroMate.Api.Tests.SyncCalls;

namespace MacroMate.Api.Tests;

[Collection("api")]
public sealed class SyncTests(ApiFactory factory)
{
    [Fact]
    public async Task Requests_without_login_are_rejected()
    {
        var response = await factory.CreateClient().GetAsync("/api/sync?since=0");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_food_written_by_one_user_reaches_everyone()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var second = await factory.LoginAsync(ApiFactory.SecondEmail);
        var cursor = (await PullAsync(second, 0)).Cursor;

        var foodId = Guid.NewGuid();
        await PushAsync(florin, Upsert("foods", foodId, new { name = "Iaurt", nameEn = "Yogurt", category = "dairy", kcal = 60 }));

        var pulled = await PullAsync(second, cursor);
        var food = Assert.Single(pulled.Foods, f => f.Id == foodId);
        Assert.Equal("Iaurt", food.Name);
        Assert.Equal("Yogurt", food.NameEn);
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
    public async Task A_completed_day_keeps_its_time_and_stays_personal()
    {
        var florin = await factory.LoginAsync(ApiFactory.FlorinEmail);
        var second = await factory.LoginAsync(ApiFactory.SecondEmail);

        var dayId = Guid.NewGuid();
        await PushAsync(florin, Upsert("dayPlans", dayId, new { date = "2026-10-05", mealPlanId = (Guid?)null, completedAt = "2026-10-05T20:30:00+00:00" }));

        var day = Assert.Single((await PullAsync(florin, 0)).DayPlans, d => d.Id == dayId);
        Assert.Equal(new DateTimeOffset(2026, 10, 5, 20, 30, 0, TimeSpan.Zero), day.CompletedAt);
        Assert.DoesNotContain((await PullAsync(second, 0)).DayPlans, d => d.Id == dayId);
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
